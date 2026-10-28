"""Nghe lại track giọng ĐÃ CẮT theo EDL (đúng như người xem sẽ nghe) để bắt chữ thừa/thiếu ở điểm cắt.

Dùng: uv run -p .venv-align python scripts/verify-edit-voice.py <slug>
Clip quá ngắn chỉ có âm thừa thì whisper hay "nghe" thành câu bịa ("Hẹn gặp lại...") — dấu hiệu nên bỏ clip đó.
Bản này kiểm chữ thiếu/thừa ở điểm cắt; tiếng đệm và chữ lặp ("ừm", "em, em") whisper chép thường bỏ qua,
nên dò thêm bằng find-voice-leaks.py.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
slug = sys.argv[1]
edit = json.loads((ROOT / f"src/talking/edits/{slug}.json").read_text(encoding="utf-8"))
raw = subprocess.check_output(["ffmpeg", "-loglevel", "error", "-i", str(ROOT / f"public/footage/{slug}-voice.wav"), "-f", "f32le", "-ac", "1", "-ar", "16000", "-"])
a = np.frombuffer(raw, dtype=np.float32)
voice = np.concatenate([a[int(c["srcIn"] * 16000):int(c["srcOut"] * 16000)] for c in edit["clips"]])
model = WhisperModel("large-v3", device="cpu", compute_type="int8")
segs, _ = model.transcribe(voice, language="vi", beam_size=5, condition_on_previous_text=False, vad_filter=True)
for s in segs:
    print(f"{s.start:6.1f} {s.text.strip()}")
