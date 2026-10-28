"""SFX/nhạc có che chữ không: whisper nghe thành phẩm theo khúc rồi dóng hàng với phụ đề; in các chữ phụ đề không nghe ra.

Dùng: uv run -p .venv-align python scripts/check-masking.py <slug> <file.mp4> [file2.mp4 ...]
So bản trước/sau khi đổi mức SFX: số chữ mất tăng rõ ở chỗ có SFX thì hạ tiếng đó. Whisper vẫn nghe sai vài chữ dù không
có SFX (tên riêng, chữ đọc nhanh), nên xem chênh lệch giữa hai bản, không xem số tuyệt đối.
"""
import difflib
import json
import sys
from pathlib import Path

from faster_whisper import WhisperModel

from voice_activity import SR, load_audio

ROOT = Path(__file__).resolve().parent.parent
slug, files = sys.argv[1], sys.argv[2:]
caps = json.loads((ROOT / f"src/talking/edits/{slug}.json").read_text(encoding="utf-8"))["captions"]
norm = lambda w: w.strip(" .,?!…\"'").lower()
want = [norm(c["text"]) for c in caps]
model = WhisperModel("large-v3", device="cpu", compute_type="int8", local_files_only=True)
for f in files:
    a = load_audio(Path(f))
    heard = []
    for lo in range(0, int(caps[-1]["end"]) + 1, 15):  # khúc 15 s chồng 1 s, bỏ phần màn kết
        segs, _ = model.transcribe(a[lo * SR:(lo + 16) * SR], language="vi", beam_size=5, word_timestamps=True, condition_on_previous_text=False)
        heard += [(lo + w.start, norm(w.word)) for s in segs for w in s.words or [] if norm(w.word) and lo + w.start < lo + 15]
    words = [w for _, w in heard]
    miss = []
    for op, i1, i2, _, _ in difflib.SequenceMatcher(a=want, b=words, autojunk=False).get_opcodes():
        if op in ("delete", "replace"):
            miss += [(caps[i]["start"], want[i]) for i in range(i1, i2)]
    print(f"{f}: {len(miss)}/{len(want)} chữ không nghe ra")
    print("   " + " ".join(f"{w}@{t:.1f}" for t, w in miss))
