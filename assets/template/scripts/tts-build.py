#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Giọng máy cho một video, đọc thêm chỉ khi cần: mỗi câu đọc 1 lần, whisper chấm chữ + đo lên giọng cuối câu, câu nào whisper
nghe lệch dù một chữ (thường là đọc lơ lớ, người dùng xác nhận 22/10/2026) hoặc lên giọng sai thanh mới đọc thêm 2 lần rồi chọn
(tts-pick.py). Câu lần 1 đã khớp hết thì không đọc 3 lần như trước.
Dùng: uv run scripts/tts-build.py <slug> <ảnh-nền.jpg>    kịch bản: scripts/data/<slug>-script.json (xem tts-takes.py)
Ra: out/tts/<slug>-voice.wav, -source.mov, -picks.json, -lines.txt (giây bắt đầu từng câu) và file nghe
    du-lieu/video-xuat/nghe-thu-giong/<slug>-giong.mp3: gửi người dùng nghe TRƯỚC khi dựng hình (whisper chỉ bắt lơ lớ khi nó làm lệch chữ).
"""
import os
import re
import sys
from pathlib import Path

from cross_platform import die, project_root, run, venv_cmd

if len(sys.argv) != 3:
    die("Dùng: uv run scripts/tts-build.py <slug> <ảnh-nền.jpg>", 2)
slug, bg = sys.argv[1], str(Path(sys.argv[2]).resolve())
if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", slug):
    die(f"slug không hợp lệ: '{slug}'", 2)
root = project_root(__file__)
S, T = f"scripts/data/{slug}-script.json", f"out/tts/{slug}-takes"
if not Path(S).is_file():
    die(f"Thiếu {S}")
# HF_HOME riêng chỉ cho VieNeu; whisper dùng cache mặc định (đặt HF_HOME cho whisper thì nó tải lại 3 GB vào project)
vieneu_env = {**os.environ, "HF_HOME": str(root / ".bin/hf")}


def takes(*args):
    run(venv_cmd(".venv-vieneu", "scripts/tts-takes.py", S, T, *args, isolated=True), env=vieneu_env)


def pick(*args):
    run(venv_cmd(".venv-align", "scripts/tts-pick.py", S, T, slug, *args, isolated=True))


takes("--takes", "1")
pick("--score-only")
retake = Path(f"out/tts/{slug}-retake.txt").read_text(encoding="utf-8").strip()
if retake:
    print(f"Đọc thêm 2 lần cho câu: {retake}")
    takes("--takes", "3", "--only", retake)
pick("--bg", bg)

listen = Path(f"du-lieu/video-xuat/nghe-thu-giong/{slug}-giong.mp3")
listen.parent.mkdir(parents=True, exist_ok=True)
run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", f"out/tts/{slug}-voice.wav",
     "-c:a", "libmp3lame", "-q:a", "2", listen])
print(f"File nghe: {listen.as_posix()} (mốc từng câu ở out/tts/{slug}-lines.txt). Chờ người dùng nghe xong mới dựng hình.")
