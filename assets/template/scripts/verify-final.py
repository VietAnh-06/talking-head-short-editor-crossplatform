#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Kiểm tra thành phẩm: thông số, khung đen, độ to, và whisper nghe lại toàn bộ lời (SFX/nhạc có che chữ không).
Whisper chép thường bỏ qua tiếng đệm/chữ lặp: âm thừa trong lời phải dò bằng find-voice-leaks.py trước khi render.
Dùng: uv run scripts/verify-final.py [--full] out/final/<slug>.mp4 [...]
Âm thanh giống bản trộn đã kiểm ở preflight-audio.py (out/qa/<slug>-mix.wav, so bằng audio-same.py) thì không chạy whisper lại
(~60 s mỗi vòng sửa): lời đã được nghe ở preflight. --full: luôn chạy whisper.
"""
import math
import re
import sys
import tempfile
from pathlib import Path

from cross_platform import duration, output, project_root, run, venv_cmd

WHISPER = r'''
import sys, numpy as np
from faster_whisper import WhisperModel
a = np.fromfile(sys.argv[1], dtype=np.float32)
m = WhisperModel("large-v3", device="cpu", compute_type="int8")
# vad_filter: nghe theo từng khúc có tiếng nói; chép cả file một lượt thì whisper hay bỏ sót đoạn cuối và bịa câu
s, _ = m.transcribe(a, language="vi", beam_size=5, condition_on_previous_text=False, vad_filter=True)
print("\n".join(f"{x.start:6.1f} {x.text.strip()}" for x in s))
'''


def ffmpeg_log(*args) -> str:
    return run(["ffmpeg", "-nostdin", "-nostats", *args], capture_output=True, text=True, encoding="utf-8", errors="replace").stderr


def lufs(f, a, b) -> float:
    m = re.findall(r"^\s+I:\s+(-?[\d.]+) LUFS", ffmpeg_log("-i", f, "-af", f"atrim={a}:{b},ebur128", "-f", "null", "-"), re.M)
    return float(m[-1]) if m else math.nan


args = sys.argv[1:]
full = bool(args) and args[0] == "--full"
files = [str(Path(a).resolve()) for a in args[full:]]
project_root(__file__)
for f in files:
    print(f"== {f}")
    print(" ".join(output(["ffprobe", "-v", "error", "-show_entries", "stream=width,height,r_frame_rate",
                           "-show_entries", "format=duration", "-of", "compact=p=0", f]).split("\n")))
    log = ffmpeg_log("-i", f, "-af", "ebur128=peak=true", "-f", "null", "-")
    print(" ".join(" ".join(l.split()) for l in log.splitlines() if re.match(r"^\s+(I|Peak):", l)))
    black = re.findall(r"black_start:[0-9.]* black_end:[0-9.]*", ffmpeg_log("-i", f, "-vf", "blackdetect=d=0.03:pix_th=0.06", "-an", "-f", "null", "-"))
    print(f"khung đen: {' '.join(black) or 'không có'}")
    # độ to từng đoạn: cold open 3 s đầu, phần thoại, màn kết (END_CARD_FRAMES = 110 khung cuối). Integrated -14 LUFS vẫn đạt
    # khi màn kết tụt hẳn (nhạc 0,3 dưới giọng): người xem nghe tiếng sụt ở 3–4 s cuối. Màn kết chỉ có nhạc nên cho lệch tới 8 LU.
    dur = duration(f)
    end = dur - 110 / 30
    cold, body, card = lufs(f, 0, 3), lufs(f, 3, end), lufs(f, end, dur)
    print(f"độ to từng đoạn: cold open {cold:.1f} | thoại {body:.1f} | màn kết {card:.1f} LUFS")
    if body - cold > 3:
        print(f"CẢNH BÁO: cold open nhỏ hơn phần thoại {body - cold:.1f} LU (hook phải to, rõ ngay)")
    if abs(card - body) > 8:
        print(f"CẢNH BÁO: màn kết lệch phần thoại {card - body:+.1f} LU (> 8): chỉnh âm lượng nhạc màn kết trong talking-short.tsx")
    mix = Path(f"out/qa/{Path(f).stem}-mix.wav")
    if not full and mix.is_file():
        same = run(venv_cmd(".venv-align", "scripts/audio-same.py", mix, f, isolated=True), check=False,
                   capture_output=True, text=True, encoding="utf-8", errors="replace")
        if same.returncode == 0:
            print(f"lời: không chạy whisper, âm thanh {same.stdout.strip()} ({mix.as_posix()})")
            continue
        print(f"âm thanh khác bản trộn preflight: {same.stdout.strip()} → whisper nghe lại toàn bộ")
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "audio.f32"
        run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", f, "-ac", "1", "-ar", "16000", "-f", "f32le", raw])
        run(venv_cmd(".venv-align", "-c", WHISPER, raw))
