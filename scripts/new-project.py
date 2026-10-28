#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Tạo project dựng short talking head từ template của skill.
Dùng: uv run <skill>/scripts/new-project.py <thư-mục-đích> [--resume]
Cần: node/npm, ffmpeg, uv, mạng (npm, Mixkit, model whisper large-v3 lần đầu ~3 GB).
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SKILL / "assets/template/scripts"))
from cross_platform import die, run, this_python, tool, uv_python, venv_python  # noqa: E402

args = sys.argv[1:]
if not args:
    die("Dùng: uv run new-project.py <thư-mục-đích> [--resume]")
if len(args) > 2 or (len(args) == 2 and args[1] != "--resume"):
    die("Cờ không hợp lệ; chỉ hỗ trợ --resume")
dest, resume = Path(args[0]).absolute(), len(args) == 2
for name in ("npm", "npx", "uv", "ffmpeg", "ffprobe"):
    tool(name)
marker = dest / ".talking-head-setup"
if dest.exists() and (not dest.is_dir() or any(dest.iterdir())):
    if not (resume and marker.is_file() and marker.read_text(encoding="utf-8").strip() == "installing"):
        die(f"Thư mục {dest} đã có dữ liệu, chọn thư mục trống")
else:
    shutil.copytree(SKILL / "assets/template", dest, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns("node_modules", ".venv*", "__pycache__"))
    marker.write_text("installing\n", encoding="utf-8")
os.chdir(dest)
quiet = {"stdout": subprocess.DEVNULL}
print("Cài npm theo package-lock.json...", flush=True)
run(["npm", "ci", "--no-audit", "--no-fund"])
print("Cài Python cho Whisper và VieNeu...", flush=True)
if not venv_python(".venv-align").is_file():
    run(["uv", "venv", "-q", "-p", "3.12", ".venv-align"])
run(["uv", "pip", "install", "-q", "-p", ".venv-align", "faster-whisper", "numpy"])
# giọng máy VieNeu-TTS (tts-build.py); model tự tải vào .bin/hf lần đọc đầu tiên
if not venv_python(".venv-vieneu").is_file():
    run(["uv", "venv", "-q", "-p", "3.12", ".venv-vieneu"])
run(["uv", "pip", "install", "-q", "-p", ".venv-vieneu", "vieneu==3.8.3", "onnxruntime==1.22.1"])
# nhạc nền theo style + SFX tổng hợp nhỏ (không bản quyền)
print("Sinh nhạc nền và tải SFX Mixkit (có thể mất vài phút)...", flush=True)
run(uv_python("scripts/generate-music-and-sfx.py", deps=["numpy", "scipy"]), **quiet)
run(uv_python("scripts/generate-music-beds.py", deps=["numpy", "scipy"]), **quiet)
run(this_python("scripts/fetch-mixkit-sfx.py"), **quiet)
# fetch-mixkit-sfx.py tiếp tục khi một file lỗi; setup phải báo thiếu để chạy lại.
try:
    sfx_names = list(json.loads(Path("src/talking/sfx-library.json").read_text(encoding="utf-8")))
except (OSError, ValueError, TypeError) as e:
    die(f"src/talking/sfx-library.json không đọc được: {e}")
for name in sfx_names:
    sfx = Path(f"public/sfx/{name}.mp3")
    if not (sfx.is_file() and sfx.stat().st_size):
        die(f"Thiếu SFX {name}; chạy lại new-project.py '{dest}' --resume")
# bản chuẩn hóa theo độ to cảm nhận cho SFX một lần (public/sfx-norm/); âm nền dùng bản gốc
run(uv_python("scripts/normalize-sfx.py", deps=["numpy"]), **quiet)
run(["npx", "--no-install", "tsc", "--noEmit"])
marker.write_text("complete\n", encoding="utf-8")
print(f"Đã tạo project tại {dest}. Video mới: uv run {SKILL / 'scripts/new-video.py'} {dest} <file-quay.mp4> <slug> [style]")
