#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Kiểm âm trước khi render hình: render bản trộn và stem SFX chỉ âm thanh (song song), rồi audio-layers.py quy chữ nghe sai về lớp.
Chạy sau khi đặt xong BEATS + đồ họa (SFX), trước render video. Sửa hết lỗi lớp SFX ở đây thì render hình một lần.
Dùng: uv run scripts/preflight-audio.py <Composition> <slug>
"""
import os
import subprocess
import sys
from pathlib import Path

from cross_platform import die, popen, project_root, run, venv_cmd

if len(sys.argv) != 3:
    die("Dùng: uv run scripts/preflight-audio.py <Composition> <slug>")
comp, slug = sys.argv[1:]
project_root(__file__)
Path("out/qa").mkdir(parents=True, exist_ok=True)
env = {**os.environ, "AUDIO_ONLY": "1"}
render = ["npx", "remotion", "render", "src/index.ts", comp]
jobs = [popen([*render, f"out/qa/{slug}-mix.wav", "--codec=wav", "--log=error"], env=env),
        popen([*render, f"out/qa/{slug}-sfx.wav", "--codec=wav", '--props={"stem":"sfx"}', "--log=error"], env=env)]
for job in jobs:
    try:
        code = job.wait(timeout=600)
    except subprocess.TimeoutExpired:
        for j in jobs:
            j.kill()
        die("Render âm thanh quá 600 s", 124)
    if code != 0:
        for j in jobs:
            j.kill()
        raise SystemExit(code)
run(venv_cmd(".venv-align", "scripts/audio-layers.py", slug, f"out/qa/{slug}-mix.wav", f"out/qa/{slug}-sfx.wav", isolated=True))
