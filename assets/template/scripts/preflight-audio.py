#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Kiểm âm trước khi render hình: render bản trộn và stem SFX nối tiếp, rồi audio-layers.py quy chữ nghe sai về lớp.
Chạy sau khi đặt xong BEATS + đồ họa (SFX), trước render video. Sửa hết lỗi lớp SFX ở đây thì render hình một lần.
Dùng: uv run scripts/preflight-audio.py <Composition> <slug>
"""
import os
import re
import signal
import subprocess
import sys
from pathlib import Path

from cross_platform import die, popen, project_root, run, venv_cmd

def render_audio(command, env, timeout=600):
    options = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt" else {"start_new_session": True}
    job = popen(command, env=env, **options)
    try:
        code = job.wait(timeout=timeout)
    except BaseException:
        # npm/npx tạo node/chrome con; chỉ dọn cây tiến trình vừa tạo.
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(job.pid), "/T", "/F"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        else:
            try:
                os.killpg(job.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        job.wait()
        raise
    if code:
        raise SystemExit(code)


def main():
    if len(sys.argv) != 3:
        die("Dùng: uv run scripts/preflight-audio.py <Composition> <slug>")
    comp, slug = sys.argv[1:]
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
        die("slug không hợp lệ", 2)
    project_root(__file__)
    Path("out/qa").mkdir(parents=True, exist_ok=True)
    env = {**os.environ, "AUDIO_ONLY": "1"}
    render = ["npx", "--no-install", "remotion", "render", "src/index.ts", comp]
    try:
        render_audio([*render, f"out/qa/{slug}-mix.wav", "--codec=wav", "--log=error"], env)
        render_audio([*render, f"out/qa/{slug}-sfx.wav", "--codec=wav", '--props={"stem":"sfx"}', "--log=error"], env)
    except subprocess.TimeoutExpired:
        die("Render âm thanh quá 600 s", 124)
    run(venv_cmd(".venv-align", "scripts/audio-layers.py", slug, f"out/qa/{slug}-mix.wav", f"out/qa/{slug}-sfx.wav", isolated=True))


if __name__ == "__main__":
    main()
