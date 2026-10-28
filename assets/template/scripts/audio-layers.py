"""Kiểm âm trước khi render hình: chữ nào bị nghe sai, do lớp nào (giọng, SFX hay nhạc), và chỗ nào SFX lấn giọng.
Dùng: uv run -p .venv-align python -X utf8 -I scripts/audio-layers.py <slug> <mix.wav> <sfx.wav>
(mix.wav và sfx.wav lấy từ uv run scripts/preflight-audio.py: render chỉ âm thanh, không vẽ khung.)

- Whisper nghe giọng đã ghép (public/footage/<slug>-edit-voice.wav) và bản trộn, dóng hàng với phụ đề như check-masking.py.
- Chữ sai ở cả giọng lẫn bản trộn: lớp GIỌNG (TTS đọc lệch hoặc whisper chép theo ngữ cảnh), nghe lại câu đó, không sửa SFX.
- Chữ chỉ sai ở bản trộn: stem SFX đủ to quanh đầu chữ thì lớp SFX (in tên khung giờ để dời/hạ tiếng), không thì lớp NHẠC/ÂM NỀN.
- Liệt kê SFX dài hơn LONG_SFX giây dùng trong file video (tiếng đồng hồ 11 s, tiếng ký giấy đạt đỉnh sau 2 s): whisper không nghe
  ra nhưng người nghe thấy kéo lê dưới lời.
"""
import difflib
import json
import re
import sys
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

sys.path.insert(0, str(Path(__file__).resolve().parent))
from voice_activity import SR, load_audio  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
# SFX to hơn giọng − SFX_MASK_DB quanh đầu chữ (−0,05…+0,2 s) thì coi là SFX che chữ
SFX_MASK_DB = 10
# SFX dài hơn LONG_SFX giây (độ dài nghe thấy) thì liệt kê
LONG_SFX = 1.5

slug, mix_path, sfx_path = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
caps = json.loads((ROOT / f"src/talking/edits/{slug}.json").read_text(encoding="utf-8"))["captions"]
NUM = {"không": "0", "một": "1", "hai": "2", "ba": "3", "bốn": "4", "năm": "5", "sáu": "6", "bảy": "7", "tám": "8", "chín": "9", "mười": "10"}
# so theo cách đọc: bỏ dấu câu, gạch nối và %, số viết bằng chữ coi như chữ số ("D-4" = "d4", "sáu" = "6")
norm = lambda w: NUM.get(x := w.strip(" .,?!…\"'“”:%").lower().replace("-", ""), x)
want = [norm(c["text"]) for c in caps]
model = WhisperModel("large-v3", device="cpu", compute_type="int8", local_files_only=True)


# khúc nghe cắt ở đầu câu phụ đề (≤ CHUNK s): khúc bắt đầu giữa khoảng lặng làm whisper bịa câu ("Hãy subscribe cho kênh")
CHUNK = 15.0


def windows() -> list[tuple[float, float]]:
    out, start = [], caps[0]["start"]
    for prev, c in zip(caps, caps[1:]):
        if c.get("sentenceStart") and c["start"] - start > CHUNK * 0.6:
            out.append((start, prev["end"]))
            start = c["start"]
    out.append((start, caps[-1]["end"]))
    return out


def missed(audio: np.ndarray) -> dict[int, str]:
    heard = []
    for t0, t1 in windows():
        lo, hi = max(0, int((t0 - 0.15) * SR)), int((t1 + 0.3) * SR)
        segs, _ = model.transcribe(audio[lo:hi], language="vi", beam_size=5, word_timestamps=True, condition_on_previous_text=False)
        heard += [norm(w.word) for s in segs for w in s.words or [] if norm(w.word)]
    out = {}
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=want, b=heard, autojunk=False).get_opcodes():
        if op in ("delete", "replace"):
            got = " ".join(heard[j1:j2]) or "∅"
            out.update({i: got for i in range(i1, i2)})
    return out


def rms_db(a: np.ndarray, t0: float, t1: float) -> float:
    seg = a[max(0, int(t0 * SR)):max(0, int(t1 * SR))]
    return 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9) if len(seg) else -180.0


voice = load_audio(ROOT / f"public/footage/{slug}-edit-voice.wav")
mix, sfx = load_audio(mix_path), load_audio(sfx_path)
in_voice, in_mix = missed(voice), missed(mix)

print(f"== chữ nghe sai ({len(in_mix)}/{len(want)} ở bản trộn, {len(in_voice)} ở giọng riêng)")
for i in sorted(in_mix):
    c = caps[i]
    if i in in_voice:
        layer = "GIỌNG"
    else:
        s_db, v_db = rms_db(sfx, c["start"] - 0.05, c["start"] + 0.2), rms_db(voice, c["start"] - 0.05, c["start"] + 0.2)
        layer = f"SFX ({s_db:.0f} dB so với giọng {v_db:.0f} dB)" if s_db > v_db - SFX_MASK_DB else "NHẠC/ÂM NỀN"
    print(f"  {c['start']:6.2f}s  '{c['text']}' → nghe '{in_mix[i]}'  lớp {layer}")

# tiếng dài đặt vào chỗ có lời: đo năng lượng không tách được khỏi âm nền (clock-tick 11 s và âm nền đều thấp hơn giọng ~12 dB,
# truong-007), nên liệt kê theo độ dài nghe thấy trong sfx-meta.json; amb (âm nền cả cảnh) dài là chủ ý nên bỏ qua
meta = json.loads((ROOT / "src/talking/sfx-meta.json").read_text(encoding="utf-8"))
used = set()
for f in (ROOT / f"src/videos/{slug}").glob("*.tsx"):
    src = f.read_text(encoding="utf-8")
    used |= set(re.findall(r"""name=["']([a-z0-9-]+)["']""", src)) | set(re.findall(r"""hit: ["']([a-z0-9-]+)["']""", src))
long = sorted((n, meta[n]["end"]) for n in used if n in meta and meta[n]["end"] > LONG_SFX)
print(f"== SFX dài hơn {LONG_SFX} s (kéo đè sang chữ sau nếu đặt chỗ có lời)")
print("\n".join(f"  {n}: {e:.1f} s" for n, e in long) if long else "  không thấy")
