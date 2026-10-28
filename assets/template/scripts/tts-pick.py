#!/usr/bin/env python3
"""Chọn lần đọc khớp kịch bản nhất cho từng câu (whisper nghe lại), ghép thành giọng và nguồn giả cho new-video.py.

Dùng (trong .venv-align): python -I scripts/tts-pick.py <script.json> <thư-mục-lần-đọc> <slug> [--bg ảnh.jpg] [--score-only] [--from-picks]
script.json thêm được: "force": {"6": "06-3.wav"} (chọn tay khi whisper chấm hòa mà nghe sai thanh), "tempo": 1.12 (tăng tốc khi ghép,
giữ cao độ), "pauses": {"<câu>": giây} (nghỉ sau câu đó), "emph": {"<câu>": {"tempo": 1.0, "gain": 2}} (nhấn câu chốt:
đọc chậm hơn tempo chung và to hơn gain dB), "paceMax" (mặc định 1,12: câu đọc nhanh hơn 1,12 × tốc độ trung vị của bài thì
hãm lại cho bằng, chậm nhất ×0,85; 0 thì tắt, chỉ báo). Chọn lần đọc khớp chữ nhất; hòa điểm thì lấy lần đầu.
Tốc độ từng câu (chữ/giây trên phần có tiếng) so với trung vị luôn được in: câu NHANH/CHẬM lệch > 15 % thì nghe lại.
Khoảng cao độ p10–p90 (nửa cung) chỉ in ra để tham khảo: chọn theo ngữ điệu rộng làm giọng lơ lớ. --from-picks: ghép lại từ out/tts/<slug>-picks.json, không chấm lại.
Lần đọc lấy từ tts-takes.py (<thư-mục>/LL-T.wav). Điểm = độ khớp chữ (bỏ dấu câu, số đổi ra chữ) trừ phạt khi độ dài
lệch xa tốc độ đọc thường (VieNeu đôi khi nói thêm hoặc nuốt chữ). In điểm từng lần để nghe lại câu nào điểm thấp.
Ra: out/tts/<slug>-voice.wav, out/tts/<slug>-source.mov (ảnh nền tĩnh + giọng), out/tts/<slug>-picks.json,
out/tts/<slug>-lines.txt (giây bắt đầu từng câu trong voice.wav, để người dùng nghe rồi chỉ câu),
out/tts/<slug>-retake.txt (câu cần đọc thêm: lần tốt nhất khớp chữ < ACCEPT, hoặc lên giọng cuối câu sai thanh; uv run scripts/tts-build.py dùng).
Điểm từng lần đọc lưu ở <thư-mục-lần-đọc>/scores.json theo cỡ + mtime file: chấm lại chỉ nghe lần đọc mới.
"""
import argparse
import difflib
import unicodedata
import json
import re
import subprocess
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

SR = 16000
# Câu ngắn hơn số chữ này không vào trung vị tốc độ: vài chữ thì chữ/giây nhiễu
PACE_MIN_WORDS = 8
PACE_FLAG = 0.15
# Câu nhanh hơn PACE_MAX × trung vị thì hãm (người dùng chọn bật mặc định 21/10/2026); script.json "paceMax": 0 để tắt
PACE_MAX = 1.12
# Hãm tốc sâu hơn mức này thì giọng nghe kéo, méo
PACE_FLOOR = 0.85
# Hãm nhẹ hơn mức này thì tai không nghe khác, chỉ thêm một lượt atempo
PACE_MIN_SLOW = 0.98
DIGITS = "không một hai ba bốn năm sáu bảy tám chín".split()


def read_int(n: int) -> str:
    if n < 10:
        return DIGITS[n]
    if n < 20:
        return "mười" + ("" if n == 10 else " " + ("lăm" if n == 15 else DIGITS[n - 10]))
    if n < 100:
        t, u = divmod(n, 10)
        tail = "" if u == 0 else " " + {1: "mốt", 4: "tư", 5: "lăm"}.get(u, DIGITS[u])
        return DIGITS[t] + " mươi" + tail
    if n < 1000:
        h, r = divmod(n, 100)
        tail = "" if r == 0 else (" linh " + DIGITS[r] if r < 10 else " " + read_int(r))
        return DIGITS[h] + " trăm" + tail
    k, r = divmod(n, 1000)
    tail = "" if r == 0 else " " + (("không trăm " + (("linh " + DIGITS[r]) if r < 10 else read_int(r))) if r < 100 else read_int(r))
    return read_int(k) + " nghìn" + tail


def norm(s: str) -> list[str]:
    # thẻ âm thanh của VieNeu v3 Turbo ([cười], [thở dài], [hắng giọng]) ra tiếng, không ra chữ: bỏ khi so
    s = re.sub(r"\[[^\]]*\]", " ", s)
    s = s.lower().replace("-", " ")
    s = re.sub(r"(\d)[.,](\d{3})", r"\1\2", s)
    s = re.sub(r"\d+", lambda m: " " + read_int(int(m.group())) + " ", s)
    return re.findall(r"[^\W\d_]+", s)


def load(path: Path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def pitch_range(audio: np.ndarray) -> float:
    """Khoảng cao độ p10–p90 (nửa cung) của các khung có tiếng, đo bằng tự tương quan; 0 nếu quá ít khung."""
    win, hop = int(0.04 * SR), int(0.01 * SR)
    lo, hi = SR // 400, SR // 110  # giọng nữ 110–400 Hz
    f0 = []
    rms_all = np.sqrt(np.mean(audio ** 2)) + 1e-9
    for i in range(0, len(audio) - win, hop):
        x = audio[i:i + win] - np.mean(audio[i:i + win])
        if np.sqrt(np.mean(x ** 2)) < 0.5 * rms_all:
            continue
        ac = np.correlate(x, x, "full")[win - 1:]
        if ac[0] <= 0:
            continue
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] / ac[0] > 0.45:
            f0.append(SR / lag)
    if len(f0) < 15:
        return 0.0
    st = 12 * np.log2(np.array(f0) / np.median(f0))
    return float(np.percentile(st, 90) - np.percentile(st, 10))


TONE_MARKS = {"\u0300": "huyền", "\u0301": "sắc", "\u0309": "hỏi", "\u0303": "ngã", "\u0323": "nặng"}
# chữ cuối thanh ngang/huyền/nặng mà cuối câu lên giọng quá RISE_MAX nửa cung thì nghe như câu hỏi tiếng Anh, lơ lớ
# (truong-007 lúc còn temperature 0,8: "…giúp không?" lên +6 nửa cung). Ở 0,3/10 dấu hỏi không làm lên giọng hơn (đo 6 câu
# × 3 lần, người dùng nghe "hai kiểu như nhau", 22/10/2026), nhưng từng lần đọc vẫn có lần lên giọng nên vẫn chọn theo cuối câu
RISE_MAX = 1.5
ENDING_SLACK = 0.05
# Lần đọc whisper nghe lệch dù một chữ thì đọc thêm. Người dùng nghe 12 cặp (22/10/2026): lần bị chấm thấp nào cũng lơ lớ,
# lần được chọn đều mượt; máy đọc lơ lớ thì whisper nghe ra chữ khác, nên điểm khớp bắt được cả lơ lớ chứ không chỉ sai chữ.
# Câu có tên riêng/mã whisper luôn nghe nhầm ("D4", "Pyeongtaek") chỉ tốn thêm 2 lần đọc.
ACCEPT = 0.999


def last_tone(line: str) -> str:
    words = norm(line)
    marks = [TONE_MARKS[c] for c in unicodedata.normalize("NFD", words[-1]) if c in TONE_MARKS] if words else []
    return marks[0] if marks else "ngang"


def end_rise(audio: np.ndarray) -> float:
    """Trung vị F0 của 0,3 s có tiếng cuối so với trung vị cả câu (nửa cung, dương = lên giọng); 0 nếu quá ít khung."""
    win, hop = int(0.04 * SR), int(0.01 * SR)
    lo, hi = SR // 400, SR // 110
    rms_all = np.sqrt(np.mean(audio ** 2)) + 1e-9
    ts, f0 = [], []
    for i in range(0, len(audio) - win, hop):
        x = audio[i:i + win] - np.mean(audio[i:i + win])
        if np.sqrt(np.mean(x ** 2)) < 0.5 * rms_all:
            continue
        ac = np.correlate(x, x, "full")[win - 1:]
        if ac[0] <= 0:
            continue
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] / ac[0] > 0.45:
            ts.append(i / SR)
            f0.append(SR / lag)
    if len(f0) < 15:
        return 0.0
    ts, f0 = np.array(ts), np.array(f0)
    return float(12 * np.log2(np.median(f0[ts >= ts[-1] - 0.3]) / np.median(f0)))


def speech_sec(audio: np.ndarray) -> float:
    """Thời lượng từ tiếng đầu đến tiếng cuối (RMS 20 ms trên −40 dBFS): VieNeu để im lặng dài ngắn khác nhau ở hai đầu lần đọc."""
    win = int(0.02 * SR)
    loud = np.flatnonzero(np.sqrt(np.convolve(audio ** 2, np.ones(win) / win, "same")) > 10 ** (-40 / 20))
    return (loud[-1] - loud[0]) / SR if len(loud) > 1 else len(audio) / SR


def pace_check(cfg: dict, takes: str, picks: list[dict]) -> dict[int, float]:
    """Ghi tốc độ từng lần đọc đã chọn vào picks, in câu lệch trung vị; trả hệ số hãm tốc theo câu khi có "paceMax"."""
    for p in picks:
        words = len(norm(cfg["lines"][p["line"] - 1]))
        p["pace"] = round(words / max(speech_sec(load(Path(takes) / p["take"])), 0.1), 2)
        p["words"] = words
    base = float(np.median([p["pace"] for p in picks if p["words"] >= PACE_MIN_WORDS] or [p["pace"] for p in picks]))
    cap = cfg.get("paceMax", PACE_MAX)
    slow = {}
    print(f"Tốc độ trung vị {base:.2f} chữ/s" + (f", hãm câu nhanh hơn ×{cap}" if cap else ""))
    for p in picks:
        ratio = p["pace"] / base
        if p["words"] < PACE_MIN_WORDS or abs(ratio - 1) <= PACE_FLAG and not (cap and cap / ratio < PACE_MIN_SLOW):
            continue
        note = "NHANH" if ratio > 1 else "CHẬM"
        if cap and ratio > cap and cap / ratio < PACE_MIN_SLOW:
            slow[p["line"]] = max(cap / ratio, PACE_FLOOR)
            note += f" → hãm ×{slow[p['line']]:.2f}"
        elif ratio < 1:
            note += " (không tăng tốc riêng câu; nghe lại, chọn lần đọc khác bằng force nếu lê thê)"
        print(f"  câu {p['line']:02d} {p['take']}: {p['pace']:.2f} chữ/s, ×{ratio:.2f} trung vị, {p['words']} chữ  {note}")
    return slow


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("takes")
    ap.add_argument("slug")
    ap.add_argument("--bg")
    ap.add_argument("--score-only", action="store_true")
    ap.add_argument("--from-picks", action="store_true")
    a = ap.parse_args()
    cfg = json.loads(Path(a.script).read_text(encoding="utf-8"))
    out = Path("out/tts")
    picks_file = out / f"{a.slug}-picks.json"
    picks = json.loads(picks_file.read_text(encoding="utf-8")) if a.from_picks else score(cfg, a.takes)
    if not a.from_picks:
        retake = [p["line"] for p in picks if needs_retake(cfg["lines"][p["line"] - 1], p) and str(p["line"]) not in cfg.get("force", {})]
        (out / f"{a.slug}-retake.txt").write_text(",".join(map(str, retake)), encoding="utf-8")
        print(f"Câu cần đọc thêm / nghe lại: {', '.join(map(str, retake)) or 'không có'}")
    for line, take in cfg.get("force", {}).items():
        picks[int(line) - 1].update(take=take, forced=True)
        print(f"→ câu {int(line):02d}: chọn tay {take}")
    slow = pace_check(cfg, a.takes, picks)
    picks_file.write_text(json.dumps(picks, ensure_ascii=False, indent=1), encoding="utf-8")
    if a.score_only:
        return
    assemble(cfg, a, picks, out, slow)


def needs_retake(line: str, best: dict) -> bool:
    return best["score"] < ACCEPT or (last_tone(line) in ("ngang", "huyền", "nặng") and best.get("rise", 0.0) > RISE_MAX)


def score(cfg: dict, takes: str) -> list[dict]:
    cache_file = Path(takes) / "scores.json"
    cache = json.loads(cache_file.read_text(encoding="utf-8")) if cache_file.exists() else {}
    model = None
    picks = []
    for i, line in enumerate(cfg["lines"], 1):
        want = norm(line)
        cands = []
        for wav in sorted(Path(takes).glob(f"{i:02d}-*.wav")):
            st = wav.stat()
            key = f"{st.st_size}:{st.st_mtime_ns}:{' '.join(want)}"
            if cache.get(wav.name, {}).get("key") == key:
                c = cache[wav.name]["cand"]
                print(f"{wav.name}: {c['score']:.2f} (đã chấm, ngữ điệu {c['expr']:.1f} nửa cung, cuối câu {c['rise']:+.1f}) {c['heard']}", flush=True)
                cands.append(c)
                continue
            if model is None:
                model = WhisperModel("large-v3", device="cpu", compute_type="int8", local_files_only=True)
            audio = load(wav)
            segs, _ = model.transcribe(audio, language="vi", beam_size=5, vad_filter=False, condition_on_previous_text=False)
            heard = " ".join(s.text.strip() for s in segs)
            match = difflib.SequenceMatcher(None, want, norm(heard)).ratio()
            dur = len(audio) / SR
            pace = len(want) / max(dur, 0.1)
            score = match - (0.15 if pace < 2.8 or pace > 6.0 else 0.0)
            expr = pitch_range(audio)
            rise = end_rise(audio)
            print(f"{wav.name}: {score:.2f} (khớp {match:.2f}, {pace:.1f} chữ/s, ngữ điệu {expr:.1f} nửa cung, cuối câu {rise:+.1f}) {heard}", flush=True)
            cands.append({"line": i, "take": wav.name, "score": round(score, 3), "expr": round(expr, 2), "rise": round(rise, 1), "heard": heard})
            cache[wav.name] = {"key": key, "cand": cands[-1]}
            cache_file.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
        if not cands:
            raise SystemExit(f"Câu {i} chưa có lần đọc nào trong {takes}")
        top = max(c["score"] for c in cands)
        # chọn theo độ khớp chữ, không theo ngữ điệu rộng (làm giọng lơ lớ, video 004, 21/10/2026). Trong các lần khớp ngang nhau,
        # chữ cuối thanh ngang/huyền/nặng thì lấy lần cuối câu không lên giọng; rồi lấy lần khớp chữ cao nhất (tien-015: lần 1
        # "Luật hàng" 0,95 thắng lần 2 khớp 1,00 vì nằm trong ENDING_SLACK); còn hòa thì lấy lần đầu tiên
        near = [c for c in cands if c["score"] >= top - ENDING_SLACK]
        flat_end = last_tone(line) in ("ngang", "huyền", "nặng")
        best = min(near, key=lambda c: (max(0.0, c["rise"] - RISE_MAX) if flat_end else 0.0, -c["score"]))
        if flat_end and best["rise"] > RISE_MAX and len(cands) > 1:
            print(f"  câu {i:02d}: mọi lần đọc đều lên giọng cuối câu ({best['rise']:+.1f} nửa cung) trên chữ thanh {last_tone(line)}: đọc thêm lần", flush=True)
        picks.append(dict(best))
        flag = "  ← NGHE LẠI" if best["score"] < 0.9 else ""
        print(f"→ câu {i:02d}: {best['take']} {best['score']:.2f}, ngữ điệu {best['expr']:.1f}{flag}\n", flush=True)
    return picks


def assemble(cfg: dict, a: argparse.Namespace, picks: list[dict], out: Path, slow: dict[int, float]) -> None:
    pauses = cfg.get("pauses", {})
    emph = cfg.get("emph", {})
    tempo = float(cfg.get("tempo", 1.0))
    parts, starts = [], []
    for p in picks:
        e = emph.get(str(p["line"]), {})
        t, gain = float(e.get("tempo", tempo)) * slow.get(p["line"], 1.0), float(e.get("gain", 0))
        # mỗi câu đổi tốc độ riêng (atempo giữ cao độ) để câu chốt đọc chậm hơn phần còn lại
        audio = load(Path(a.takes) / p["take"])
        if abs(t - 1.0) > 1e-3:
            audio = np.frombuffer(subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                                                  "-af", f"atempo={t}", "-f", "f32le", "-"], input=audio.tobytes(), capture_output=True, check=True).stdout, np.float32)
        starts.append(sum(len(x) for x in parts) / SR)
        parts.append(audio * (10 ** (gain / 20)))
        parts.append(np.zeros(int(SR * float(pauses.get(str(p["line"]), cfg.get("pauseSec", 0.3))) / tempo), np.float32))
    voice = np.clip(np.concatenate(parts[:-1]), -1, 1)
    wav = out / f"{a.slug}-voice.wav"
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-ar", "48000", "-c:a", "pcm_s16le", str(wav)], input=voice.tobytes(), check=True)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(wav)], capture_output=True, text=True, check=True).stdout)
    print(f"→ {wav}: {dur:.1f} s (tốc độ ×{tempo})")
    lines = [f"{p['line']:02d}  {int(t // 60)}:{t % 60:04.1f}  {cfg['lines'][p['line'] - 1]}" + ("  ← nghe kỹ" if needs_retake(cfg["lines"][p["line"] - 1], p) else "")
             for p, t in zip(picks, starts)]
    (out / f"{a.slug}-lines.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    if a.bg:
        mov = out / f"{a.slug}-source.mov"
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-loop", "1", "-framerate", "30", "-i", a.bg, "-i", str(wav),
                        "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", "-t", f"{dur:.3f}",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "pcm_s16le", str(mov)], check=True)
        print(f"→ {mov}")


if __name__ == "__main__":
    main()
