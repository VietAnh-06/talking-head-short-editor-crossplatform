"""Chép lời giọng đã làm sạch kèm mốc từng từ: nguồn để chọn đoạn giữ/bỏ khi dựng EDL.

Dùng: uv run -p .venv-align python scripts/transcribe-source.py <slug>
Ghi scripts/data/<slug>-transcript.json và in từng câu kèm mốc giây của từng từ.
Lưu ý: mốc từ của whisper hay "nuốt" khoảng lặng, và whisper hay bịa câu kết kiểu
"Cảm ơn các bạn đã theo dõi" ở đoạn im lặng; build-talking-edit.py bắt điểm cắt theo sóng âm.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
slug = sys.argv[1]
raw = subprocess.check_output(["ffmpeg", "-loglevel", "error", "-i", str(ROOT / f"public/footage/{slug}-voice.wav"), "-f", "f32le", "-ac", "1", "-ar", "16000", "-"])
audio = np.frombuffer(raw, dtype=np.float32)
model = WhisperModel("large-v3", device="cpu", compute_type="int8")
segs, _ = model.transcribe(audio, language="vi", beam_size=5, word_timestamps=True, condition_on_previous_text=False, vad_filter=True)
out = []
for s in segs:
    words = [{"w": w.word, "s": float(w.start), "e": float(w.end), "p": float(w.probability)} for w in s.words or []]
    out.append({"start": float(s.start), "end": float(s.end), "text": s.text.strip(), "words": words})
    print(" ".join(f"{w['w'].strip()}@{w['s']:.2f}" for w in words), f"|end {s.end:.2f}")
dest = ROOT / f"scripts/data/{slug}-transcript.json"
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"→ {dest}")
