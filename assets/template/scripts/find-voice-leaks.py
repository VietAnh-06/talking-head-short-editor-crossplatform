"""Dò âm thừa còn sót trong track giọng đã dựng: tiếng đệm ("ừm", "ờ", "à"), chữ lặp ("em, em").

Dùng: uv run -p .venv-align python scripts/find-voice-leaks.py <slug> [--write]
Chạy sau build-talking-edit.py. --write thêm các chỗ bỏ được vào "drop" của scripts/edits/<slug>.json; sau đó chạy lại
build-talking-edit.py (phụ đề cũ được dời mốc theo EDL mới, không cần chép lại).

Vì sao cần: whisper chép thường thì "dọn" lời. Nó bỏ tiếng đệm, gộp chữ lặp, kéo một chữ thật phủ lên cả giây tiếng
đệm đứng trước ("cướp" 50,06–53,08 s trong khi "ừm à ừm" chiếm 50,2–52,6 s), nên bản chép lời không cho biết chỗ cần bỏ.
Chép với gợi ý nguyên văn thì whisper ghi cả tiếng đệm kèm mốc khá đúng, nhưng hay bịa câu nếu cửa sổ không bắt đầu
bằng lời thật. Cách làm:
1. Chia track đã dựng thành cửa sổ 3–8 s, ngắt ở chỗ nghỉ.
2. Mỗi cửa sổ nghe hai lần: thường và nguyên văn. Bản nguyên văn có dấu hiệu bịa ("subscribe", "theo dõi"...) hoặc
   lệch nhiều so với bản thường thì nghe lại với gợi ý là chính lời vừa nghe, rồi tách đôi ở chỗ nghỉ; vẫn bịa thì
   báo "không kiểm được" (nghe khúc đó bằng listen-edit.py).
3. Tiếng đệm chỉ có ở bản nguyên văn, chữ lặp liền ("em, em") hoặc cụm lặp 2–3 chữ ("so với, so với") mà bản nghe
   thường có ít lần hơn, là âm thừa (với chữ/cụm lặp, bỏ bản nói đầu).
   Ranh giới bỏ = mốc chữ đó, dời về điểm năng lượng thấp nhất trong ±80 ms.
4. Chặn: khoảng cắt phải có tiếng thật (≥ 50% có năng lượng) và không nuốt phần lớn một chữ của bản nghe thường;
   xác nhận bằng hai cửa sổ lệch tâm vẫn nghe ra đúng tiếng đó ở đúng chỗ (nhiễu ở ranh giới cửa sổ không lặp lại).
5. Thử cắt: nghe nguyên văn lại cửa sổ đã bỏ âm đó, dóng hàng với bản nguyên văn trước khi cắt; số chữ thật giảm thì giữ.
Mép cắt rơi giữa quãng đang có tiếng (tiếng đệm nói liền vào chữ sau, "ừm so với") được lùi vào 30–40 ms để không
lẹm đầu/đuôi chữ bên cạnh; sót vài chục ms tiếng đệm không nghe ra, lẹm chữ thì nghe ra. Phép thử này không đủ một mình
   vì whisper đoán bù chữ dễ đoán ("cướp … bóc"), nên chỉ là lớp chặn cuối.
Chạy một lượt trên EDL chưa dò; dò lại lần hai trên track đã sạch dễ ra báo nhầm ở điểm nối mới.
Khúc nguồn dùng hai lần (cold open lấy từ lời khuyên) được báo hai lần; drop áp cho cả hai chỗ.
"""
import difflib
import json
import sys
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

import voice_activity
from voice_activity import SR, WIN, envelope, load_audio, speech_runs, voiced

ROOT = Path(__file__).resolve().parent.parent
SLUG = sys.argv[1]
voice_activity.configure_for(SLUG)
WRITE = "--write" in sys.argv
EDIT = json.loads((ROOT / f"src/talking/edits/{SLUG}.json").read_text(encoding="utf-8"))
CONFIG_PATH = ROOT / f"scripts/edits/{SLUG}.json"
CONFIG = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
VERBATIM = "Ờ, thì, em, em, cái, cái, là, ừm, à, thì là, nói chung là."
FILLERS = {"ờ", "ơ", "ừ", "ư", "à", "ừm", "ờm", "ơm", "ưm", "ầm", "hừm", "hửm", "hmm", "ừa"}  # whisper ghi cùng một tiếng đệm lúc thế này lúc thế kia
HALLUCINATION = ("subscribe", "đăng ký", "theo dõi", "kênh", "hẹn gặp lại", "cảm ơn các bạn")
WIN_MIN, WIN_MAX, PAUSE = 3.0, 8.0, 0.2
MIN_SPLIT = 1.5    # nửa cửa sổ ngắn nhất khi tách khúc bị bịa
SNAP = 0.08
SENTENCE_GAP = 0.3  # chữ/cụm lặp cách nhau khoảng lặng dài hơn (không tiếng đệm) là hai câu, không phải nói vấp
EDGE_IN, EDGE_OUT = 0.03, 0.04  # lề an toàn khi mép cắt rơi giữa quãng đang có tiếng


def norm(w: str) -> str:
    return w.strip(" .,?!…\"'").lower()


def render(audio: np.ndarray, drops: list[tuple[float, float]]):
    """Track giọng đã dựng theo EDL, bỏ thêm các quãng nguồn trong drops. Trả về (âm thanh, [(nguồn từ, nguồn đến, giây timeline)])."""
    parts, segs, t = [], [], 0.0
    for c in EDIT["clips"]:
        cur, pieces = c["srcIn"], []
        for ds, de in sorted(drops):
            if de <= cur or ds >= c["srcOut"]:
                continue
            if ds > cur:
                pieces.append((cur, ds))
            cur = max(cur, de)
        if cur < c["srcOut"]:
            pieces.append((cur, c["srcOut"]))
        for a, b in pieces:
            parts.append(audio[int(a * SR):int(b * SR)])
            segs.append((a, b, t))
            t += b - a
    return np.concatenate(parts), segs


def to_source(segs, lo: float, hi: float) -> list[tuple[float, float]]:
    """Khoảng trên timeline → các khoảng nguồn tương ứng (có thể vắt qua điểm cắt)."""
    out = []
    for a, b, t in segs:
        s, e = max(lo, t), min(hi, t + b - a)
        if e > s:
            out.append((round(a + s - t, 3), round(a + e - t, 3)))
    return out


def windows(edited: np.ndarray) -> list[tuple[float, float]]:
    runs = speech_runs(voiced(envelope(edited)), 0, len(edited) / SR)
    out, cur = [], None
    for s, e in runs:
        if cur is None:
            cur = [max(0.0, s - 0.1), e]
        elif e - cur[0] > WIN_MAX or (s - cur[1] >= PAUSE and cur[1] - cur[0] >= WIN_MIN):
            out.append((cur[0], cur[1] + 0.1))
            cur = [max(0.0, s - 0.1), e]
        else:
            cur[1] = e
    if cur:
        out.append((cur[0], cur[1] + 0.1))
    return out


def listen(model, clip: np.ndarray, prompt: str | None):
    segs, _ = model.transcribe(clip, language="vi", beam_size=5, word_timestamps=True, initial_prompt=prompt, condition_on_previous_text=False)
    return [(float(w.start), float(w.end), norm(w.word)) for seg in segs for w in seg.words or [] if norm(w.word)]


def hallucinated(words) -> bool:
    text = " ".join(w for _, _, w in words)
    return any(h in text for h in HALLUCINATION)


def similar(a, b) -> float:
    return difflib.SequenceMatcher(a=[w for *_, w in a], b=[w for *_, w in b], autojunk=False).ratio()


def extras(plain, verb) -> list[tuple[int, int, int]]:
    """(j0, j1, k): khoảng [j0, j1) trong bản nguyên văn là âm thừa: tiếng đệm, chữ lặp liền ("em, em") hoặc cụm lặp 2–3
    chữ nói lại ("so với, so với") mà bản nghe thường có ít lần hơn. Với chữ/cụm lặp, bỏ bản đầu (lần nói hỏng) và k là chữ
    đầu của bản thứ hai: cắt tới ngay trước nó (mốc chữ nguyên văn hẹp hơn chữ thật, cắt theo mốc chữ để sót mảnh vụn).
    Tiếng đệm thì k = j1."""
    p, v = [w for _, _, w in plain], [w for _, _, w in verb]
    out: list[tuple[int, int]] = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=p, b=v, autojunk=False).get_opcodes():
        if op in ("insert", "replace"):
            out += [(j, j + 1, j + 1) for j in range(j1, j2) if v[j] in FILLERS]
    count = lambda seq, g: sum(1 for i in range(len(seq) - len(g) + 1) if seq[i:i + len(g)] == g)
    # dò lặp trên chuỗi đã bỏ tiếng đệm: "so với, ờ, so với" vẫn là cụm lặp
    idx = [i for i, w in enumerate(v) if w not in FILLERS]
    vf, pf = [v[i] for i in idx], [w for w in p if w not in FILLERS]
    for n in (3, 2, 1):
        for i in range(len(vf) - 2 * n + 1):
            g = vf[i:i + n]
            if vf[i + n:i + 2 * n] != g or count(vf, g) <= count(pf, g):
                continue
            j0, j1 = idx[i], idx[i + n - 1] + 1
            # hai câu nối nhau ("…gọi là OIST. OIST là một viện…"): nghỉ hẳn, không tiếng đệm chen giữa → không phải nói vấp
            if idx[i + n] == j1 and verb[j1][0] - verb[j1 - 1][1] >= SENTENCE_GAP:
                continue
            if not any(a < j1 and j0 < b for a, b, _ in out if b - a > 1 or v[a] not in FILLERS):
                # bản đầu và tiếng đệm chen giữa bỏ một lần, tới ngay trước bản thứ hai
                k = idx[i + n]
                out = [x for x in out if not (j0 <= x[0] < k)]
                out.append((j0, k, k))
    return sorted(set(out))


def guard(on: np.ndarray, plain, s: float, e: float, repeat: bool) -> str:
    """Chặn trước khi tốn công nghe lại: khoảng cắt phải có tiếng thật, và không được nuốt phần lớn một chữ của bản nghe thường.
    Whisper nguyên văn đôi khi "bịa" tiếng đệm phủ lên khoảng lặng ngay trước một chữ ("Ờ" trước "Em")."""
    i0, i1 = int(s / WIN), max(int(s / WIN) + 1, int(e / WIN))
    if on[i0:i1].mean() < 0.5:
        return "khoảng cắt phần lớn là im lặng"
    if repeat:  # bản nghe thường giữ một bản của chữ/cụm lặp và hay đặt mốc vào lần nói đầu: không phải nuốt chữ
        return ""
    for ws, we, w in plain:
        if s - 0.02 <= ws < e - 0.03 and we <= e + 0.25 and w not in FILLERS:
            return f"sẽ nuốt chữ \"{w}\" của bản nghe thường"
    return ""


def lost_words(model, real_verb, plain, cut: np.ndarray, t_cut: float) -> list[str]:
    """Chữ thật bị mất khi cắt: dóng hàng bản nguyên văn trước (bỏ chữ thừa) và sau khi cắt, cùng một cách viết, rồi chỉ
    xét các chữ sát chỗ cắt (2 chữ trước, 1 chữ sau): whisper chép phần khác của cửa sổ lúc thế này lúc thế kia ("khá là"
    / "khá"), đó không phải chữ bị cắt. Bỏ qua chữ số ("500" / "năm trăm"). Bản nguyên văn sau cắt bị bịa thì so hai bản
    nghe thường."""
    again = listen(model, cut, VERBATIM)
    ref = real_verb
    if hallucinated(again) or similar(real_verb, again) < 0.6:
        again, ref = listen(model, cut, None), plain
    before = [w for *_, w in ref]
    after = [w for *_, w in again]
    at = next((i for i, (ws, _, _) in enumerate(ref) if ws >= t_cut), len(ref))
    near = range(at - 2, at + 1)
    lost = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=before, b=after, autojunk=False).get_opcodes():
        if op not in ("delete", "replace"):
            continue
        for i in range(i1, i2):
            w = before[i]
            if i not in near or w in FILLERS or any(ch.isdigit() for ch in w):
                continue
            # "replace" bằng biến thể chính tả đúng vị trí (tỉ/tỷ, nệ/lệ) không phải mất chữ
            pair = after[j1 + (i - i1)] if op == "replace" and j1 + (i - i1) < j2 else ""
            if not pair or difflib.SequenceMatcher(a=w, b=pair).ratio() < 0.5:
                lost.append(w)
    return lost


def confirmed(model, edited: np.ndarray, t0: float, t1: float, words: list[str]) -> bool:
    """Nghe lại ở hai cửa sổ đặt lệch tâm (lệch trái, lệch phải): âm thừa thật thì ít nhất một cửa sổ vẫn nghe ra ở đúng chỗ.
    Tiếng đệm được ghi lúc "ờ" lúc "à"/"ừm" nên chỉ cần cùng là tiếng đệm; chữ/cụm lặp thì phải đúng chữ và vẫn lặp liền."""
    n = len(words)
    for before, after in ((2.0, 1.0), (1.0, 2.0)):
        lo, hi = max(0.0, t0 - before), min(len(edited) / SR, t1 + after)
        clip = edited[int(lo * SR):int(hi * SR)]
        for prompt in (VERBATIM, None):
            verb = listen(model, clip, prompt)
            if hallucinated(verb):
                continue
            if n == 1 and words[0] in FILLERS:
                for ws, we, w in verb:
                    if w in FILLERS and max(0.0, min(lo + we, t1) - max(lo + ws, t0)) / max(t1 - t0, 0.01) >= 0.4:
                        return True
                break
            real = [x for x in verb if x[2] not in FILLERS]  # lặp có thể chen tiếng đệm
            v = [w for *_, w in real]
            for k in range(len(real) - n + 1):
                ws, we = real[k][0], real[k + n - 1][1]
                # khoảng cắt gồm cả tiếng đệm chen giữa: tính độ trùng theo chính bản lặp đầu
                inside = max(0.0, min(lo + we, t1) - max(lo + ws, t0)) / max(we - ws, 0.01)
                if inside >= 0.5 and v[k:k + n] == words and v[k + n:k + 2 * n] == words:
                    return True
            break
    return False


def split_at_pause(edited: np.ndarray, lo: float, hi: float):
    """Tách cửa sổ ở chỗ nghỉ dài nhất gần giữa; None nếu khúc đã ngắn."""
    if hi - lo < 2 * MIN_SPLIT:
        return None
    runs = speech_runs(voiced(envelope(edited[int(lo * SR):int(hi * SR)])), 0, hi - lo)
    gaps = [(b[0] - a[1], (a[1] + b[0]) / 2) for a, b in zip(runs, runs[1:]) if MIN_SPLIT <= (a[1] + b[0]) / 2 <= hi - lo - MIN_SPLIT]
    if gaps:
        mid = lo + max(gaps)[1]
    else:  # nói liền không có chỗ nghỉ: tách ở chỗ năng lượng thấp nhất trong khoảng giữa
        env = envelope(edited[int(lo * SR):int(hi * SR)])
        i0, i1 = int(MIN_SPLIT / WIN), len(env) - int(MIN_SPLIT / WIN)
        mid = lo + (i0 + int(np.argmin(env[i0:i1]))) * WIN
    return [(lo, mid), (mid, hi)]


def snap_low(env: np.ndarray, t: float) -> float:
    i0, i1 = max(0, int((t - SNAP) / WIN)), min(len(env), int((t + SNAP) / WIN) + 1)
    return (i0 + int(np.argmin(env[i0:i1]))) * WIN if i1 > i0 else t


def main() -> None:
    audio = load_audio(ROOT / f"public/footage/{SLUG}-voice.wav")
    existing = [(float(d[0]), float(d[1])) for d in CONFIG.get("drop", [])]
    model = WhisperModel("large-v3", device="cpu", compute_type="int8", local_files_only=True)
    accepted: list[tuple[float, float]] = []
    edited, segs = render(audio, existing)
    wins = windows(edited)
    print(f"{len(wins)} cửa sổ, track {len(edited) / SR:.1f}s", flush=True)
    unchecked = []
    queue = list(wins)  # các cửa sổ độc lập; mỗi cặp chữ lặp chỉ một tiếng được đánh dấu thừa
    while queue:
        lo, hi = queue.pop(0)
        clip = edited[int(lo * SR):int(hi * SR)]
        plain = listen(model, clip, None)
        verb = listen(model, clip, VERBATIM)
        if hallucinated(verb) or similar(plain, verb) < 0.6:
            # gợi ý bám đúng nội dung vừa nghe để whisper không bịa, vẫn kèm tiếng đệm để nó chép nguyên văn
            verb = listen(model, clip, "Ừm, à, ờ, " + " ".join(w for *_, w in plain))
        ratio = similar(plain, verb)
        if hallucinated(verb) or hallucinated(plain) or ratio < 0.6:
            halves = split_at_pause(edited, lo, hi)
            if halves:
                queue[:0] = halves  # khúc ngắn hơn ít bị bịa hơn
                continue
            unchecked.append((lo, hi))
            print(f"? {lo:6.2f}-{hi:6.2f} không kiểm được (whisper bịa/lệch, giống {ratio:.0%}): {' '.join(w for *_, w in verb)}")
            continue
        env = envelope(clip)
        on = voiced(env)
        for j, j1, k in extras(plain, verb):
            repeat = k > j + 1 or verb[j][2] not in FILLERS
            words = [x[2] for x in verb[j:j1] if x[2] not in FILLERS] if repeat else [verb[j][2]]
            ws = verb[j][0]
            we = verb[k][0] if repeat and k < len(verb) else verb[j1 - 1][1]
            w = " ".join(x[2] for x in verb[j:j1])
            s, e = snap_low(env, ws), snap_low(env, we)
            if 0 < int(s / WIN) < len(on) and on[int(s / WIN) - 1]:
                s += EDGE_IN
            if int(e / WIN) < len(on) and on[int(e / WIN)]:
                e -= EDGE_OUT
            if e - s < 0.06:
                continue
            ctx = " ".join(x for _, _, x in verb[max(0, j - 4):max(j1, k) + 4])
            head = f"timeline {lo + s:6.2f}-{lo + e:6.2f} ({(e - s) * 1000:3.0f} ms) \"{w}\"  …{ctx}…"
            why = guard(on, plain, s, e, repeat=repeat)
            if not why and not confirmed(model, edited, lo + s, lo + e, words):
                why = "cửa sổ lệch tâm không nghe lại thấy"
            if why:
                print(f"bỏ qua  {head}  [{why}]", flush=True)
                continue
            cut = np.concatenate([clip[:int(s * SR)], clip[int(e * SR):]])
            lost = lost_words(model, verb[:j] + verb[k if repeat else j1:], plain, cut, s)
            src = to_source(segs, lo + s, lo + e)
            print(f"{'giữ    ' if lost else 'BỎ ĐƯỢC'} {head}  nguồn {src}" + (f"  [cắt thử mất: {' '.join(lost)}]" if lost else ""), flush=True)
            if not lost:
                accepted.extend(src)
    print(f"\n{len(accepted)} chỗ bỏ được: " + json.dumps([list(x) for x in accepted]))
    if unchecked:
        print(f"{len(unchecked)} cửa sổ không kiểm được, nghe tay: " + ", ".join(f"{a:.1f}-{b:.1f}s" for a, b in unchecked))
    if WRITE and accepted:
        merged = sorted({tuple(d[:2]) for d in CONFIG.get("drop", [])} | set(accepted))
        CONFIG["drop"] = [list(d) for d in merged]
        CONFIG_PATH.write_text(json.dumps(CONFIG, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Đã ghi vào {CONFIG_PATH.relative_to(ROOT)} → chạy lại build-talking-edit.py (tự dời mốc phụ đề)")


if __name__ == "__main__":
    main()
