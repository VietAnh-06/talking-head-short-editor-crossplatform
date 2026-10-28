#!/usr/bin/env python3
"""Đo nền ồn so với giọng trên track giọng đã làm sạch, để quyết định có cần khử ồn mạnh (denoise-voice.py) không.

Dùng: uv run --with numpy python scripts/measure-voice-noise.py <slug> [đường-dẫn-wav]
Mức giọng: trung vị RMS 50 ms bên trong các chữ của bản chép lời. Mức nền: phân vị 10% RMS 50 ms của cả file
(không lấy khoảng trống giữa các chữ: whisper bỏ qua tiếng đếm "1, 2, 3", tiếng đệm nên khoảng trống thường có lời).
Quay ngoài trời có gió/lá: nền chỉ thấp hơn giọng 2–5 dB, afftdn không tách được vì ồn trùng dải 150–1500 Hz của giọng.
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from voice_activity import SR, load_audio  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SLUG = sys.argv[1]
WAV = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / f"public/footage/{SLUG}-voice.wav"
GOOD_GAP_DB = 15.0   # giọng to hơn nền từ mức này: nền gần như không nghe thấy dưới nhạc 0,07
NEED_GAP_DB = 10.0   # dưới mức này người xem nghe rõ "xào xạc" giữa các chữ

audio = load_audio(WAV)
hop = int(SR * 0.05)
frames = audio[: len(audio) // hop * hop].reshape(-1, hop)
rms = 20 * np.log10(np.sqrt((frames ** 2).mean(1)) + 1e-9)

words = [w for seg in json.loads((ROOT / f"scripts/data/{SLUG}-transcript.json").read_text(encoding="utf-8")) for w in seg["words"]]
inside = np.zeros(len(rms), bool)
for w in words:
    inside[int(w["s"] / 0.05): int(w["e"] / 0.05) + 1] = True
speech = float(np.median(rms[inside[: len(rms)]]))
noise = float(np.percentile(rms, 10))
gap = speech - noise

# phổ nền: các khung thấp nhất, để biết ồn nằm ở dải nào (gió/lá: 150–1500 Hz; quạt/điều hòa: dưới 300 Hz; xì: trên 4 kHz)
quiet = frames[rms <= np.percentile(rms, 10)]
spec = np.abs(np.fft.rfft(quiet * np.hanning(hop), axis=1)).mean(0)
freqs = np.fft.rfftfreq(hop, 1 / SR)
bands = [(0, 150), (150, 500), (500, 1500), (1500, 4000), (4000, 8000)]
band_db = {f"{lo}-{hi}": 20 * np.log10(spec[(freqs >= lo) & (freqs < hi)].mean() + 1e-9) for lo, hi in bands}

print(f"{WAV.name}: giọng {speech:.1f} dB, nền {noise:.1f} dB, chênh {gap:.1f} dB")
print("phổ nền (dB tương đối): " + "  ".join(f"{k} Hz: {v:.0f}" for k, v in band_db.items()))
if gap < NEED_GAP_DB:
    print(f"→ NỀN ỒN RÕ (chênh < {NEED_GAP_DB:.0f} dB): chạy uv run scripts/denoise-voice.py {SLUG} <file-nguồn> rồi dựng lại EDL")
elif gap < GOOD_GAP_DB:
    print(f"→ nền nghe được ở chỗ nghỉ: cân nhắc denoise-voice.py {SLUG} <file-nguồn> 24 (giới hạn giảm 24 dB, giữ phụ âm tốt hơn)")
else:
    print("→ ổn, không cần khử ồn thêm")
