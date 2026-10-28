"""Chuẩn hóa SFX một lần (chuyển cảnh, hit, pop, impact) theo độ to cảm nhận để cùng một `volume` cho cùng độ to thật.

Dùng: uv run --with numpy python scripts/normalize-sfx.py   → public/sfx-norm/<tên>.mp3 (bản gốc trong public/sfx/ giữ nguyên)
Bản gốc chỉ chuẩn hóa đỉnh −1 dBFS nên độ to thật chênh nhau ~23 dB (page-turn −26,5 … bass-hit −3,2 dBFS RMS 100 ms):
cùng volume 0,3 mà tiếng này át lời, tiếng kia mất hút. Đích: RMS 100 ms lớn nhất = −12 dBFS; limiter giữ đỉnh ≤ −1 dBFS
cho tiếng có độ vọt lớn. Âm nền (Ambience) vẫn dùng bản gốc vì phát kéo dài, đo theo trung bình.
Ghi thêm src/talking/sfx-meta.json: onset (âm đầu tiên vượt đỉnh −30 dB), peak (đỉnh RMS 10 ms), end (lần cuối vượt
đỉnh −30 dB), tính bằng giây. Sfx dùng onset/peak để tiếng rơi đúng khung hình (Mixkit có tới 0,2–0,9 s lặng đầu file,
whoosh đạt đỉnh 0,45–1,6 s sau đầu file); end cho biết tiếng kéo dài bao lâu (tiếng > 1,5 s dễ đè sang chữ kế tiếp).
"""
import json
import subprocess
from pathlib import Path

import numpy as np

from sfx_loudness import peak_rms

ROOT = Path(__file__).resolve().parent.parent
TARGET = -12.0
SRC, DST = ROOT / "public/sfx", ROOT / "public/sfx-norm"
DST.mkdir(exist_ok=True)
for f in sorted(SRC.glob("*.mp3")):
    gain = TARGET - peak_rms(str(f))
    out = DST / f.name
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(f),
                    "-af", f"volume={gain:.2f}dB,alimiter=limit=0.89:attack=1:release=40:level=disabled",
                    "-ar", "48000", "-b:a", "192k", str(out)], check=True)
    print(f"{f.stem:18s} {gain:+6.1f} dB → {peak_rms(str(out)):6.1f} dBFS")


def timing(path: Path) -> dict:
    a = np.frombuffer(subprocess.check_output(["ffmpeg", "-nostdin", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "16000",
                                               "-f", "f32le", "-"]), np.float32)
    env = 20 * np.log10(np.sqrt(np.convolve(a ** 2, np.ones(160) / 160, "same")) + 1e-9)
    loud = np.where(env > env.max() - 30)[0]
    return {"onset": round(loud[0] / 16000, 3), "peak": round(int(np.argmax(env)) / 16000, 3), "end": round(loud[-1] / 16000, 3)}


meta = {f.stem: timing(f) for f in sorted(DST.glob("*.mp3"))}
(ROOT / "src/talking/sfx-meta.json").write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")
print(f"sfx-meta.json: {len(meta)} tiếng")
