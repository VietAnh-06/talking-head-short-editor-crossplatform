"""Nghe một khúc của track giọng đã cắt theo EDL: bản thường và bản NGUYÊN VĂN (cả tiếng đệm, chữ lặp), để duyệt chỗ vừa sửa.

Dùng: uv run -p .venv-align python scripts/listen-edit.py <slug> <giây-timeline-bắt-đầu> <giây-kết-thúc>
Khúc 3–6 s, bắt đầu bằng lời thật. Bản nguyên văn bị bịa ("Hãy subscribe…") thì nghe lại với gợi ý là chính lời vừa nghe.
"""
import json
import sys
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

from voice_activity import SR, load_audio

ROOT = Path(__file__).resolve().parent.parent
VERBATIM = "Ờ, thì, em, em, cái, cái, là, ừm, à, thì là, nói chung là."
HALLUCINATION = ("subscribe", "đăng ký", "theo dõi", "kênh", "hẹn gặp lại", "cảm ơn các bạn")
slug, lo, hi = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
edit = json.loads((ROOT / f"src/talking/edits/{slug}.json").read_text(encoding="utf-8"))
a = load_audio(ROOT / f"public/footage/{slug}-voice.wav")
voice = np.concatenate([a[int(c["srcIn"] * SR):int(c["srcOut"] * SR)] for c in edit["clips"]])[int(lo * SR):int(hi * SR)]
model = WhisperModel("large-v3", device="cpu", compute_type="int8", local_files_only=True)


def listen(prompt):
    segs, _ = model.transcribe(voice, language="vi", beam_size=5, word_timestamps=True, condition_on_previous_text=False, initial_prompt=prompt)
    return [(lo + w.start, w.word.strip()) for s in segs for w in s.words or []]


plain = listen(None)
print("thường:   ", " ".join(f"{w}@{t:.2f}" for t, w in plain))
verb = listen(VERBATIM)
if any(h in " ".join(w for _, w in verb).lower() for h in HALLUCINATION):
    verb = listen("Ừm, à, ờ, " + " ".join(w for _, w in plain))
    print("(bản nguyên văn đầu bị bịa, nghe lại với gợi ý là lời vừa nghe)")
print("nguyên văn:", " ".join(f"{w}@{t:.2f}" for t, w in verb))
