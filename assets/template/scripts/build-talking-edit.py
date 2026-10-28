#!/usr/bin/env python3
"""Dựng danh sách cắt (EDL) cho video talking head từ bản chép lời whisper và sóng âm giọng đã làm sạch.

Dùng: scripts/build-talking-edit.py <slug>   (cấu hình: scripts/edits/<slug>.json)
Cấu hình thêm được "drop" (bỏ khoảng âm thừa) và "keep" (giữ nguyên khoảng tiếng nhỏ như thở dài, tiếng cười).
Ghi src/talking/edits/<slug>.json: clips (đoạn nguồn → timeline, lượng tử theo khung hình) và cues
(mốc đồ họa trên timeline, giây). Phụ đề do caption-talking-edit.py điền sau.
"""
import json
import math
import wave
import sys
from pathlib import Path

import numpy as np

import voice_activity
from voice_activity import WIN, envelope, load_audio, speech_runs, syllable_bounds, voiced

ROOT = Path(__file__).resolve().parent.parent
SLUG = sys.argv[1]
voice_activity.configure_for(SLUG)
CONFIG = json.loads((ROOT / f"scripts/edits/{SLUG}.json").read_text(encoding="utf-8"))
VOICE = ROOT / f"public/footage/{SLUG}-voice.wav"
OUT = ROOT / f"src/talking/edits/{SLUG}.json"
EDIT_VOICE = ROOT / f"public/footage/{SLUG}-edit-voice.wav"
VOICE_SR = 48000
FADE = 0.012  # fade ở mọi mép cắt: không bật/tắt tiếng đột ngột (tiếng "bụp", chữ bị chặt ngang)

# khoảng nghỉ dài hơn MAX_PAUSE thì cắt còn KEEP_PAUSE. Giọng máy (có out/tts/<slug>-voice.wav) mặc định 1,0 / 0,45 s:
# khoảng nghỉ đã do kịch bản quyết định, rút hết chỗ ngắt ở dấu phẩy làm giọng liền một hơi, nghe lơ lớ (video 004, 21/10/2026)
TTS = (ROOT / f"out/tts/{SLUG}-voice.wav").exists()
MAX_PAUSE = float(CONFIG.get("maxPause", 1.0 if TTS else 0.28))
KEEP_PAUSE = float(CONFIG.get("keepPause", 0.45 if TTS else 0.10))
PAD_IN, PAD_OUT = 0.05, 0.09
EDGE_KEEP = 0.35    # tiếng nói kéo dài quá mốc ít hơn mức này là đầu/đuôi chữ cần giữ
FPS = 30  # điểm cắt lượng tử theo khung hình để hình, giọng và phụ đề không trôi qua nhiều lần cắt


def snap(sec: float) -> float:
    return round(sec * FPS) / FPS

# Mỗi đoạn: (nhãn, bắt đầu, kết thúc, ghi chú) theo giây nguồn, đúng thứ tự trên timeline.
# Mốc lấy từ bản chép lời rồi được bắt vào sóng âm.
SECTIONS = [tuple(sec[:3]) for sec in CONFIG["sections"]]
# Âm thừa whisper không chép ("em, em", "ờ", đuôi chữ đoạn bên cạnh) đã xác nhận bằng find-voice-leaks.py:
# [giây bắt đầu, giây kết thúc, ghi chú?] theo giây nguồn. Luôn bị cắt ra, dù nằm giữa một đoạn.
DROPS = [(float(d[0]), float(d[1])) for d in CONFIG.get("drop", [])]
# "keep": [[giây vào, giây ra, ghi chú]] coi là đang có tiếng, không rút khoảng nghỉ: tiếng thở dài, tiếng cười của thẻ âm thanh
# VieNeu ([thở dài], [cười]) nhỏ hơn ngưỡng dò tiếng nên bị cắt vụn thành mẩu 0,3–0,5 s nghe như giật
KEEPS = [(float(k[0]), float(k[1])) for k in CONFIG.get("keep", [])]


def retime_captions(old: dict, clips: list[dict]) -> list[dict]:
    """Phụ đề cũ (đã sửa tay) theo EDL mới: dời mốc theo giây nguồn, không chép lời lại.
    Chữ có mốc rơi vào âm đã bỏ (whisper hay gắn mốc chữ thật lên tiếng đệm đứng trước) được dời tới điểm nối kế tiếp
    trong cùng đoạn; chỉ bỏ chữ khi cả đoạn của nó không còn trong EDL."""
    def to_src(t: float):
        for c in old["clips"]:
            dur = c["srcOut"] - c["srcIn"]
            if c["at"] - 1e-6 <= t <= c["at"] + dur + 1e-6:
                return c["section"], c["srcIn"] + t - c["at"]
        return None

    def to_new(section: str, src: float):
        for prefer in (True, False):  # cùng khúc nguồn có thể dùng hai lần (cold open): ưu tiên đúng đoạn
            for c in clips:
                if (not prefer or c["section"] == section) and c["srcIn"] - 0.03 <= src <= c["srcOut"] + 0.03:
                    return round(c["at"] + min(max(src, c["srcIn"]), c["srcOut"]) - c["srcIn"], 3)
        later = [c for c in clips if c["section"] == section and c["srcIn"] >= src]
        if later:
            return round(min(later, key=lambda c: c["srcIn"])["at"], 3)
        earlier = [c for c in clips if c["section"] == section]
        return round(max(c["at"] + c["srcOut"] - c["srcIn"] for c in earlier), 3) if earlier else None

    out = []
    for w in old.get("captions", []):
        a, b = to_src(w["start"]), to_src(w["end"])
        if not a:
            continue
        start = to_new(*a)
        if start is None:
            continue  # chữ nằm trong phần đã bỏ
        end = to_new(*b) if b else None
        end = end if end is not None and end > start else start + max(0.08, w["end"] - w["start"])
        out.append({**w, "start": start, "end": round(end, 3)})
    return out


def valley(bounds: np.ndarray, t: float) -> float:
    """Ranh giới âm tiết cho mốc rơi giữa lời nói. Mốc chữ của whisper thường sớm hơn thật 0,1–0,2 s ("đây" hết ở 24,68
    chứ không phải 24,58; "nhà" hết ở 41,25 chứ không phải 41,02), nên mốc hay nằm trong đuôi chữ đứng trước: lấy ranh giới
    kế tiếp phía sau (≤ 0,35 s) để giữ trọn chữ cuối / bỏ trọn đuôi chữ trước; không có thì ranh giới phía trước ≤ 0,12 s."""
    ahead = bounds[(bounds >= t) & (bounds <= t + 0.35)]
    if len(ahead):
        return float(ahead[0])
    behind = bounds[(bounds < t) & (bounds >= t - 0.12)]
    return float(behind[-1]) if len(behind) else t


def write_edit_voice(clips: list[dict]) -> None:
    """Giọng đã ghép theo EDL, chính xác tới mẫu (1 khung = 1600 mẫu ở 48 kHz), fade 12 ms ở mỗi mép. Remotion phát file
    này thay cho từng đoạn rời (volume theo khung 33 ms không làm được fade ngắn)."""
    a = load_audio(VOICE, VOICE_SR)
    spf = VOICE_SR // FPS
    n = int(FADE * VOICE_SR)
    ramp = np.linspace(0.0, 1.0, n, dtype=np.float32)
    parts = []
    for c in clips:
        seg = a[c["inFrame"] * spf:c["outFrame"] * spf].copy()
        seg = np.pad(seg, (0, (c["outFrame"] - c["inFrame"]) * spf - len(seg)))
        if len(seg) > 2 * n:
            seg[:n] *= ramp
            seg[-n:] *= ramp[::-1]
        parts.append(seg)
    pcm = (np.clip(np.concatenate(parts), -1, 1) * 32767).astype("<i2")
    with wave.open(str(EDIT_VOICE), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(VOICE_SR)
        w.writeframes(pcm.tobytes())


def main() -> None:
    env = envelope(load_audio(VOICE))
    v = voiced(env)
    bounds = syllable_bounds(env, v)

    def on_bound(t: float) -> float:
        """Mép đang có tiếng mà cách ranh giới âm tiết > 30 ms: dời về ranh giới gần nhất trong ±80 ms (làm tròn khung)."""
        if not v[min(len(v) - 1, int(t / WIN))] or not len(bounds):
            return t
        d = np.abs(bounds - t)
        if d.min() <= 0.03 or d.min() > 0.08:
            return t
        return snap(float(bounds[np.argmin(d)]))
    for ds, de in DROPS:
        v[int(ds / WIN):math.ceil(de / WIN)] = False
    for ks, ke in KEEPS:
        v[int(ks / WIN):math.ceil(ke / WIN)] = True
    clips, t = [], 0.0
    section_starts = {}
    for label, lo, hi in SECTIONS:
        # Mốc rơi giữa lời nói: cắt ở ranh giới âm tiết, không chừa lề (chừa lề kéo theo âm của chữ bên cạnh: "Đây" thừa ở
        # đầu đoạn, đuôi "đình" phát lại). Tiếng sắp tắt sau mốc ra (≤ EDGE_KEEP) là đuôi chữ cuối: giữ hết rồi chừa lề.
        start, end = lo, hi
        in_speech = out_speech = False
        # mốc vào giữa lời nói: không lùi về trước mốc (mốc whisper sớm, phía trước là đuôi chữ cần bỏ), tiến tới ranh giới kế
        if v[min(len(v) - 1, int(lo / WIN))]:
            in_speech, start = True, valley(bounds, lo)
        i = min(len(v) - 1, int(hi / WIN))
        if v[i]:
            j = i
            while j < len(v) - 1 and v[j + 1]:
                j += 1
            if (j - i) * WIN > EDGE_KEEP:
                out_speech, end = True, valley(bounds, hi)
            else:
                end = (j + 1) * WIN
        # hai đoạn liền nhau trong nguồn (mốc vào = mốc ra đoạn trước): bắt đầu sau phần đoạn trước đã phát
        if clips and clips[-1]["srcIn"] < start < clips[-1]["srcOut"]:
            start, in_speech = clips[-1]["srcOut"], False
        runs = speech_runs(v, start, end)
        if not runs:
            raise SystemExit(f"{label}: không thấy tiếng nói")
        # gộp các đoạn nói, cắt bớt khoảng nghỉ dài
        pieces = []
        cur_s, cur_e = runs[0]
        for s, e in runs[1:]:
            if s - cur_e > MAX_PAUSE or any(cur_e <= ds < s for ds, _ in DROPS):
                pieces.append((cur_s, cur_e))
                cur_s = s
            cur_e = e
        pieces.append((cur_s, cur_e))
        section_starts[label] = t
        for k, (s, e) in enumerate(pieces):
            first, last = k == 0, k == len(pieces) - 1
            if first and in_speech:
                src_in = math.ceil(start * FPS - 1e-6) / FPS
            else:
                src_in = snap(max(0.0, s - (PAD_IN if first else KEEP_PAUSE / 2)))
            if last and out_speech:
                src_out = math.floor(end * FPS + 1e-6) / FPS
            else:
                src_out = snap(e + (PAD_OUT if last else KEEP_PAUSE / 2))
            # phần đệm không được lấn vào âm đã bỏ; làm tròn vào trong theo khung hình
            for ds, de in DROPS:
                if e - 1e-6 <= ds < src_out:
                    src_out = math.floor(ds * FPS + 1e-6) / FPS
                if src_in < de <= s + 1e-6:
                    src_in = math.ceil(de * FPS - 1e-6) / FPS
            # hai đoạn kề nhau trong nguồn: không phát lại phần đoạn trước đã phát
            if clips and clips[-1]["srcIn"] < src_in < clips[-1]["srcOut"]:
                src_in = clips[-1]["srcOut"]
            dur = src_out - src_in
            if dur < 1 / FPS - 1e-6:
                continue  # quãng nói kẹp giữa hai khoảng drop có thể co về 0 khung
            clips.append({
                "section": label, "piece": k,
                "inFrame": round(src_in * FPS), "outFrame": round(src_out * FPS), "atFrame": round(t * FPS),
                "srcIn": round(src_in, 4), "srcOut": round(src_out, 4), "at": round(t, 4),
            })
            t += dur

    # Mốc đồ họa theo giây nguồn của một từ trong một đoạn → giây trên timeline
    def at(label: str, src_time: float) -> float:
        for c in clips:
            if c["section"] == label and c["srcIn"] <= src_time < c["srcOut"]:
                return round(c["at"] + src_time - c["srcIn"], 3)
        cands = [c for c in clips if c["section"] == label]
        best = min(cands, key=lambda c: abs(c["srcIn"] - src_time))
        return best["at"]

    order = [label for label, _, _ in SECTIONS]
    cues = {
        # khóa chung cho mọi video: hết cold open = bắt đầu câu hỏi; hết câu hỏi = đoạn kế tiếp
        # không có đoạn "question" thì không có thẻ bình luận (hai mốc trùng nhau)
        "coldEnd": section_starts.get("question", 0.0),
        "questionEnd": section_starts[order[order.index("question") + 1]] if "question" in order[:-1] else section_starts.get("question", 0.0),
        "speechEnd": round(t, 3),
    }
    for name, ref in CONFIG["cues"].items():
        cues[name] = section_starts[ref] if isinstance(ref, str) else at(ref[0], ref[1])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    edit = {"slug": SLUG, "zoom": CONFIG.get("zoom", {}), "duration": round(t, 3), "clips": clips, "cues": cues, "captions": []}
    if OUT.exists():
        # giữ phụ đề cũ (có thể đã sửa tay), dời mốc theo EDL mới; chạy caption-talking-edit.py nếu muốn chép lời lại
        edit["captions"] = retime_captions(json.loads(OUT.read_text(encoding="utf-8")), clips)
    OUT.write_text(json.dumps(edit, ensure_ascii=False, indent=1), encoding="utf-8")
    write_edit_voice(clips)
    print(f"{len(clips)} clip, thời lượng thoại {t:.2f}s")
    for c in clips:
        print(f"  {c['section']:9s}#{c['piece']} {c['srcIn']:6.2f}-{c['srcOut']:6.2f} → {c['at']:6.2f}")
    print(json.dumps(cues, ensure_ascii=False))


if __name__ == "__main__":
    main()
