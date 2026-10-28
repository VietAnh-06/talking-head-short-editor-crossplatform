#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Chuẩn hóa độ to về -14 LUFS / true-peak -1.5 dBTP (chừa chỗ cho AAC) (chuẩn Reels, TikTok), giữ nguyên luồng hình.
Đọc các file truyền vào (mặc định out/*.mp4), ghi vào out/final/.
Dùng: uv run scripts/master-loudness.py [out/<slug>.mp4 ...]
"""
import json
import re
import sys
from pathlib import Path

from cross_platform import project_root, run


def ffmpeg_log(cmd) -> str:
    return run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace").stderr


def ebur128_summary(path) -> str:
    log = ffmpeg_log(["ffmpeg", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"])
    return " ".join(" ".join(l.split()) for l in log.splitlines() if re.match(r"^\s+(I|Peak):", l))


sources = [str(Path(a).resolve()) for a in sys.argv[1:]]
project_root(__file__)
Path("out/final").mkdir(parents=True, exist_ok=True)
sources = sources or sorted(str(p) for p in Path("out").glob("*.mp4"))
for src in sources:
    dst = f"out/final/{Path(src).name}"
    log = ffmpeg_log(["ffmpeg", "-hide_banner", "-nostats", "-i", src, "-af", "loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json", "-f", "null", "-"])
    s = json.loads(log[log.rindex("{"):log.rindex("}") + 1])
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-c:v", "copy",
         "-af", f"loudnorm=I=-14:TP=-1.5:LRA=7:measured_I={s['input_i']}:measured_TP={s['input_tp']}:measured_LRA={s['input_lra']}"
                f":measured_thresh={s['input_thresh']}:offset={s['target_offset']}:linear=true,aresample=48000",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", dst])
    print(f"{dst}  {ebur128_summary(dst)}")
