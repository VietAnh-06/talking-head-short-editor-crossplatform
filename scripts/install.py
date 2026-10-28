#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Cài skill vào tài khoản hiện tại và tạo (hoặc tiếp tục) project dựng video, rồi kiểm môi trường.
setup-windows.ps1 và setup-macos.sh gọi file này sau khi cài node, ffmpeg, ImageMagick, uv.
Dùng: uv run scripts/install.py [--project-name <tên>] [--skip-project]
  Skill: ~/.claude/skills/talking-head-short-editor (bản cũ chuyển vào ~/.local/share/talking-head-setup/backups/)
  Project: ~/videos/<tên> (mặc định talking-head-shorts)
"""
import argparse
import datetime
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path

SOURCE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SOURCE / "assets/template/scripts"))
from cross_platform import die, run, venv_cmd  # noqa: E402

ITEMS = ["SKILL.md", "README-CAI-DAT.md", "scripts", "assets", "references"]
IGNORE = shutil.ignore_patterns("node_modules", ".venv*", "__pycache__", ".bin", "out")


def step(msg: str):
    print(f"\n==> {msg}", flush=True)


parser = argparse.ArgumentParser()
parser.add_argument("--project-name", default="talking-head-shorts")
parser.add_argument("--skip-project", action="store_true")
args = parser.parse_args()
if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", args.project_name):
    die("Tên project chỉ gồm chữ thường, số và gạch nối (tối đa 64 ký tự).")
for item in ITEMS:
    if not (SOURCE / item).exists():
        die(f"Thiếu {item}. Hãy giải nén toàn bộ thư mục trước khi chạy setup.")

home = Path.home()
skill = home / ".claude/skills/talking-head-short-editor"
project = home / "videos" / args.project_name
marker = project / ".talking-head-setup"
# Từ chối project không liên quan trước khi chép hay tải gì.
if not args.skip_project and project.exists() and not marker.is_file():
    if not project.is_dir() or any(project.iterdir()):
        die(f"Thư mục project đã có dữ liệu: {project}. Chọn tên khác bằng --project-name / -ProjectName.")

step("Cài skill vào tài khoản hiện tại")
if skill.resolve() == SOURCE:
    print(f"Đang chạy từ chính thư mục skill, giữ nguyên: {skill}")
else:
    skill.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".talking-head-install-", dir=skill.parent))
    try:
        for item in ITEMS:
            src = SOURCE / item
            if src.is_dir():
                shutil.copytree(src, stage / item, ignore=IGNORE)
            else:
                shutil.copy2(src, stage / item)
        if skill.exists() or skill.is_symlink():
            backups = home / ".local/share/talking-head-setup/backups"
            backups.mkdir(parents=True, exist_ok=True)
            backup = backups / f"skill-{datetime.datetime.now():%Y%m%d-%H%M%S}-{os.getpid()}"
            shutil.move(str(skill), str(backup))
            print(f"Bản skill cũ lưu tại: {backup}")
        stage.rename(skill)
    finally:
        shutil.rmtree(stage, ignore_errors=True)
    print(f"Skill: {skill}")
run(["uv", "python", "install", "3.12"])
if args.skip_project:
    print(f"\nĐã cài skill. Tạo project sau bằng:\n  uv run \"{skill / 'scripts/new-project.py'}\" \"{project}\"")
    sys.exit(0)

step("Tạo hoặc tiếp tục project dựng video (có thể mất nhiều phút)")
if marker.is_file() and marker.read_text(encoding="utf-8").strip() == "complete":
    print(f"Giữ project đã có: {project}")
else:
    run(["uv", "run", skill / "scripts/new-project.py", project, "--resume"])
os.chdir(project)

step("Kiểm môi trường Python, TypeScript và trình duyệt render")
run(venv_cmd(".venv-align", "-c", 'import faster_whisper, numpy; print("Whisper OK")'))
run(venv_cmd(".venv-vieneu", "-c", 'from vieneu import Vieneu; import onnxruntime; print("VieNeu OK")'))
run(["npm", "run", "typecheck"])
run(["npx", "--no-install", "remotion", "browser", "ensure"])
# Mở Chrome thật: chỉ tải về thì không bắt được thiếu thư viện hệ thống.
run(["node", "--input-type=module", "-e",
     'import {openBrowser} from "@remotion/renderer"; const b = await openBrowser("chrome"); await b.close(); console.log("Render browser OK");'])
print(f"\nProject sẵn sàng: {project}\nModel whisper và VieNeu tải ở lần chép lời / đọc giọng đầu tiên.")
