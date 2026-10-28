#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Ghép nhiều file quay của cùng một video (nhiều cảnh, nhiều lần bấm máy) thành một file nguồn cho new-video.py.
Dùng: uv run concat-footage.py <file-ra.mov> <file1> <file2> ... (thứ tự = thứ tự cảnh; thường theo tên file máy quay C0001, C0002...)
ffmpeg tự xoay theo cờ rotation (máy ảnh quay dọc lưu 1920x1080 + rotate 90) nên ra đúng khung dọc. Giữ nguyên fps,
x264 CRF 12 + PCM để không mất chất lượng trước bước chỉnh màu; in ranh giới từng cảnh (giây) để dò cảnh không có người nói.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "assets/template/scripts"))
from cross_platform import die, duration, output, run  # noqa: E402

if len(sys.argv) < 4:
    die("cần ít nhất 2 file")
out, files = sys.argv[1], sys.argv[2:]
inputs, filt, t = [], "", 0.0
for i, f in enumerate(files):
    inputs += ["-i", f]
    filt += f"[{i}:v][{i}:a]"
    d = duration(f)
    print(f"cảnh {i + 1}  {Path(f).name:<24} {t:7.2f} – {t + d:7.2f} s")
    t += d
fps = output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate",
              "-of", "default=nw=1:nk=1", files[0]]).splitlines()[0]
run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", *inputs,
     "-filter_complex", f"{filt}concat=n={len(files)}:v=1:a=1[v][a]",
     "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "fast", "-crf", "12", "-pix_fmt", "yuv420p", "-r", fps,
     "-c:a", "pcm_s16le", out])
run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height:format=duration", "-of", "compact=p=0", out])
