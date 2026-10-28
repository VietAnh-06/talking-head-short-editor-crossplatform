"""Phụ đề cho video talking head: chép lời từ track giọng ĐÃ DỰNG nên chữ và mốc khớp đúng cái người xem nghe.

Dùng: uv run -p .venv-align python scripts/caption-talking-edit.py <slug>   (sau build-talking-edit.py)
Từ vựng gợi ý, bảng sửa chữ, cụm từ khóa lấy từ scripts/edits/<slug>.json → "captions".
Ghi đè trường captions trong src/talking/edits/<slug>.json (mất mọi sửa tay trong file đó; sửa trong cấu hình thay vì sửa tay).
Sau khi đã có phụ đề, build-talking-edit.py tự dời mốc phụ đề theo EDL mới, nên chỉ chạy lại script này khi lời đổi nhiều.

Chép theo khúc ~20 s, ngắt ở ranh giới clip: chép cả track một lượt với word_timestamps thì whisper hay bịa câu
("Hãy đăng ký kênh…") ở cửa sổ 30 s đầu và bỏ sót đoạn cuối.

Có kịch bản (video giọng máy, "captions.script"): chữ và dấu câu lấy từ kịch bản, whisper chỉ cho mốc thời gian, nên không
cần fixes/phraseFixes cho chữ máy đọc theo phiên âm ("Tô pích hai" → "TOPIK II", "bốn mươi phần trăm" → "40%").
"""
import difflib
import json
import re
import sys
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

from voice_activity import SR, load_audio

ROOT = Path(__file__).resolve().parent.parent
SLUG = sys.argv[1]
CONFIG = json.loads((ROOT / f"scripts/edits/{SLUG}.json").read_text(encoding="utf-8"))["captions"]
EDIT = ROOT / f"src/talking/edits/{SLUG}.json"
VOICE = ROOT / f"public/footage/{SLUG}-voice.wav"
VOCAB = CONFIG.get("vocab") or None
FIXES = CONFIG.get("fixes", {})
# Sửa nhiều chữ: [["cụm whisper nghe", "cụm đúng", giây timeline tìm từ (tùy chọn)], ...]; cụm mới chia đều thời gian cụm cũ.
PHRASE_FIXES = CONFIG.get("phraseFixes", [])
# Tô sáng theo cụm trọn vẹn để không bắt nhầm âm tiết lẻ ("động" trong "động từ")
EMPHASIS = CONFIG.get("emphasis", [])
# Âm còn sót ở điểm cắt mà whisper nghe thành chữ: bỏ khỏi phụ đề (bỏ hẳn âm thì dùng "drop" trong EDL)
DROP_AT_SENTENCE_START = set(CONFIG.get("dropAtSentenceStart", []))
# Kịch bản hiển thị: <slug>-script.json (khóa "show": các câu viết chữ chuẩn; "lines" là cách viết cho máy đọc) hoặc file .txt
SCRIPT = CONFIG.get("script")
# Dưới tỉ lệ chữ kịch bản khớp này thì kịch bản không phải lời của track giọng (sai file, sửa kịch bản sau khi đọc)
SCRIPT_MIN_MATCH = 0.6
# Chữ kịch bản whisper không nghe ra mà khoảng trống giữa hai chữ khớp kề nhau nhỏ hơn mức này mỗi chữ: chữ đã bị EDL cắt
SCRIPT_MIN_WORD_SEC = 0.12
CHUNK = 20.0
HALLUCINATION = ("subscribe", "đăng ký kênh", "theo dõi", "hẹn gặp lại", "cảm ơn các bạn đã")


def bare(text: str) -> str:
    return text.strip(".,?!").lower()


def key(text: str) -> str:
    return re.sub(r"[^\w]", "", text.lower())


def load_script(path: str) -> list[str]:
    src = ROOT / path
    if src.suffix == ".json":
        cfg = json.loads(src.read_text(encoding="utf-8"))
        if "show" not in cfg:
            raise SystemExit(f'{path}: thiếu khóa "show" (các câu viết chữ chuẩn để hiện phụ đề); "lines" là cách viết cho máy đọc')
        text = " ".join(cfg["show"])
    else:
        text = src.read_text(encoding="utf-8")
    # thẻ âm thanh của VieNeu ([cười], [thở dài]) ra tiếng, không ra chữ
    return [w for w in re.sub(r"\[[^\]]*\]", " ", text).split() if key(w)]


def spread(words: list[str], t0: float, t1: float) -> list[dict]:
    step = (t1 - t0) / len(words)
    return [{"text": w, "start": round(t0 + k * step, 3), "end": round(t0 + (k + 1) * step, 3), "emph": False, "sentenceStart": False}
            for k, w in enumerate(words)]


def align(script: list[str], heard: list[dict], borrow: bool = True) -> tuple[list[dict], int]:
    """Chữ kịch bản mang mốc của chữ whisper khớp; đoạn lệch chia đều khoảng thời gian whisper nghe được ở đó.
    Trả phụ đề và số chữ kịch bản khớp thẳng."""
    sk, hk = [key(w) for w in script], [key(h["text"]) for h in heard]
    out, matched = [], 0
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, sk, hk, autojunk=False).get_opcodes():
        if op == "equal":
            matched += i2 - i1
            out += [{**heard[j1 + k], "text": script[i1 + k]} for k in range(i2 - i1)]
        elif op == "replace":
            # chữ đọc theo phiên âm, số đọc thành chữ: nhóm chữ kịch bản phủ đúng khoảng whisper nghe nhóm đó
            out += spread(script[i1:i2], heard[j1]["start"], heard[j2 - 1]["end"])
        elif op == "delete":
            lo = heard[j1 - 1]["end"] if j1 > 0 else 0.0
            hi = heard[j1]["start"] if j1 < len(heard) else lo
            if hi - lo >= SCRIPT_MIN_WORD_SEC * (i2 - i1):
                out += spread(script[i1:i2], lo, hi)  # whisper bỏ sót chữ trong khoảng có tiếng
            else:
                print(f"CẢNH BÁO script: bỏ '{' '.join(script[i1:i2])}' ở {lo:.1f}s (không có trong giọng đã dựng)", file=sys.stderr)
        else:  # insert: lời ngoài thứ tự kịch bản (cold open dời câu lên đầu) hoặc chữ whisper bịa
            run = heard[j1:j2]
            m = difflib.SequenceMatcher(None, sk, hk[j1:j2], autojunk=False).find_longest_match(0, len(sk), 0, j2 - j1)
            if borrow and j2 - j1 >= 3 and m.size >= 0.6 * (j2 - j1):
                # mượn đoạn kịch bản tương ứng, nới hai đầu theo phần whisper nghe trước/sau đoạn khớp
                a0, a1 = max(0, m.a - m.b), min(len(script), m.a + m.size + (j2 - j1 - m.b - m.size))
                part, _ = align(script[a0:a1], run, borrow=False)
                out += part
                print(f"script: {run[0]['start']:.1f}s nằm ngoài thứ tự kịch bản, lấy chữ câu '{' '.join(script[a0:a1])[:50]}'", file=sys.stderr)
            elif not any(re.search(r"\w", h["text"]) for h in run):
                pass  # ký hiệu whisper tách rời ("90 %"): kịch bản đã viết liền vào chữ trước ("90%")
            else:
                out += run
                print(f"CẢNH BÁO script: giữ chữ whisper '{' '.join(h['text'] for h in run)}' ở {run[0]['start']:.1f}s (không có trong kịch bản)", file=sys.stderr)
    return out, matched


def chunks(audio: np.ndarray, clips: list[dict]) -> list[tuple[float, np.ndarray]]:
    pieces = [audio[int(c["srcIn"] * SR):int(c["srcOut"] * SR)] for c in clips]
    out, cur, start, t = [], [], 0.0, 0.0
    for p in pieces:
        if cur and (sum(len(x) for x in cur) + len(p)) / SR > CHUNK:
            out.append((start, np.concatenate(cur)))
            start, cur = t, []
        cur.append(p)
        t += len(p) / SR
    out.append((start, np.concatenate(cur)))
    return out


def apply_phrase_fixes(captions: list[dict]) -> None:
    for rule in PHRASE_FIXES:
        old, new = [bare(t) for t in rule[0].split()], rule[1].split()
        after = rule[2] if len(rule) > 2 else 0
        for i in range(len(captions) - len(old) + 1):
            if captions[i]["start"] >= after - 0.01 and [bare(c["text"]) for c in captions[i:i + len(old)]] == old:
                span = captions[i:i + len(old)]
                t0, t1 = span[0]["start"], span[-1]["end"]
                step = (t1 - t0) / max(1, len(new))
                captions[i:i + len(old)] = [
                    {"text": w, "start": round(t0 + k * step, 3), "end": round(t0 + (k + 1) * step, 3), "emph": False, "sentenceStart": False}
                    for k, w in enumerate(new)]
                break
        else:  # lần chép này whisper nghe khác: báo để sửa luật, không dừng
            print(f"CẢNH BÁO phraseFixes: không thấy cụm '{rule[0]}' sau {after}s", file=sys.stderr)


def finalize(captions: list[dict]) -> None:
    """Đầu câu theo dấu câu và khoảng nghỉ thật (không theo cách whisper chia đoạn); viết hoa đầu câu; tô sáng cụm từ khóa."""
    kept = []
    for c in captions:
        prev = kept[-1] if kept else None
        c["sentenceStart"] = prev is None or prev["text"].endswith((".", "?", "!")) or c["start"] - prev["end"] > 0.6
        if c["sentenceStart"] and bare(c["text"]) in DROP_AT_SENTENCE_START:
            continue
        if c["sentenceStart"]:
            c["text"] = c["text"][:1].upper() + c["text"][1:]
        c["emph"] = False
        kept.append(c)
    captions[:] = kept
    low = [bare(c["text"]) for c in captions]
    for phrase in EMPHASIS:
        toks = phrase.lower().split()
        for i in range(len(low) - len(toks) + 1):
            if low[i:i + len(toks)] == toks:
                for j in range(i, i + len(toks)):
                    captions[j]["emph"] = True


def main() -> None:
    edit = json.loads(EDIT.read_text(encoding="utf-8"))
    audio = load_audio(VOICE)
    total = sum(c["srcOut"] - c["srcIn"] for c in edit["clips"])
    model = WhisperModel("large-v3", device="cpu", compute_type="int8", local_files_only=True)
    captions = []
    for off, voice in chunks(audio, edit["clips"]):
        segs, _ = model.transcribe(voice, language="vi", beam_size=5, word_timestamps=True, initial_prompt=VOCAB, condition_on_previous_text=False)
        for seg in segs:
            # whisper hay bịa câu ("Cảm ơn các bạn đã theo dõi...") ở chỗ không có tiếng nói
            if seg.no_speech_prob > 0.6 or off + seg.start >= total - 0.3 or any(h in seg.text.lower() for h in HALLUCINATION):
                continue
            for w in seg.words or []:
                for part in w.word.strip().replace("-", " ").split():
                    b = bare(part)
                    if b in FIXES:
                        part = part.lower().replace(b, FIXES[b])
                    captions.append({"text": part, "start": round(off + float(w.start), 3), "end": round(off + float(w.end), 3),
                                     "emph": False, "sentenceStart": False})
    if SCRIPT:
        words = load_script(SCRIPT)
        captions, matched = align(words, captions)
        ratio = matched / max(1, len(words))
        print(f"script: {matched}/{len(words)} chữ kịch bản khớp thẳng ({ratio:.0%})", file=sys.stderr)
        if ratio < SCRIPT_MIN_MATCH:
            raise SystemExit(f"{SCRIPT}: chỉ {ratio:.0%} chữ khớp giọng đã dựng, kịch bản không phải lời của track này")
    apply_phrase_fixes(captions)
    finalize(captions)
    edit["captions"] = captions
    EDIT.write_text(json.dumps(edit, ensure_ascii=False, indent=1), encoding="utf-8")
    print(" ".join(("|" if c["sentenceStart"] else "") + (c["text"].upper() if c["emph"] else c["text"]) + f"@{c['start']:.1f}" for c in captions))


if __name__ == "__main__":
    main()
