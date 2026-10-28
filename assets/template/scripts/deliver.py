#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Giao một video: mỗi video chỉ có MỘT file thành phẩm, nằm ở du-lieu/video-xuat/.
Dùng: uv run scripts/deliver.py <slug> [tên-giao]   (chạy sau master-loudness.py và verify-final.py đạt)
  - chuyển out/final/<slug>.mp4 → du-lieu/video-xuat/<tên-giao>.mp4, ghi đè bản trước đó;
  - ảnh bìa out/final/<slug>-cover.jpg hoặc out/<slug>-cover.jpg → <tên-giao>-cover.jpg
    (xuất bằng: npx remotion still src/index.ts <Id>Poster out/final/<slug>-cover.jpg);
  - mô tả TikTok out/final/<slug>-caption.txt → <tên-giao>.txt (1–2 câu trả lời hook, 1 dòng nguồn ngắn, 3–5 hashtag);
  thiếu bìa hoặc mô tả thì vẫn giao video nhưng in CẢNH BÁO để làm bù;
  - xoá bản render thô out/<slug>.mp4.
Bỏ trống tên-giao thì dùng lại tên đang có (video-NNN-<slug>.mp4 hoặc <slug>.mp4); video mới phải truyền tên (vd. video-007-tien-021).
"""
import os
import re
import sys
from pathlib import Path

from cross_platform import die, project_root

if not 2 <= len(sys.argv) <= 3:
    die("Dùng: uv run scripts/deliver.py <slug> [tên-giao]", 2)
slug = sys.argv[1]
name = sys.argv[2] if len(sys.argv) == 3 else ""
if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", slug):
    die(f"slug không hợp lệ: '{slug}'", 2)
project_root(__file__)
X = Path("du-lieu/video-xuat")
src = Path(f"out/final/{slug}.mp4")
if not name:
    found = [f for f in X.glob(f"video-[0-9][0-9][0-9]-{slug}.mp4")] + ([X / f"{slug}.mp4"] if (X / f"{slug}.mp4").is_file() else [])
    if len(found) != 1:
        die(f"Không đoán được tên giao cho '{slug}' (tìm thấy {len(found)} file); truyền tên, vd. video-007-{slug}", 2)
    name = found[0].stem
X.mkdir(parents=True, exist_ok=True)
video = X / f"{name}.mp4"
if src.is_file():
    replaced = " (ghi đè bản trước)" if video.is_file() else ""
    os.replace(src, video)
    print(f"Giao: {video.as_posix()}{replaced}")
elif video.is_file():
    print(f"Video đã giao trước đó: {video.as_posix()} (chỉ bổ sung bìa, mô tả)")
else:
    die(f"Chưa có {src.as_posix()}: chạy master-loudness.py và verify-final.py trước")
cover_out = X / f"{name}-cover.jpg"
for cover in (Path(f"out/final/{slug}-cover.jpg"), Path(f"out/{slug}-cover.jpg")):
    if cover.is_file():
        os.replace(cover, cover_out)
        print(f"Bìa:  {cover_out.as_posix()}")
        break
else:
    if not cover_out.is_file():
        print(f"CẢNH BÁO: chưa có ảnh bìa; xuất <Id>Poster ra out/final/{slug}-cover.jpg rồi chạy lại", file=sys.stderr)
caption, caption_out = Path(f"out/final/{slug}-caption.txt"), X / f"{name}.txt"
if caption.is_file():
    os.replace(caption, caption_out)
    print(f"Mô tả: {caption_out.as_posix()}")
elif not caption_out.is_file():
    print(f"CẢNH BÁO: chưa có mô tả TikTok; viết out/final/{slug}-caption.txt rồi chạy lại", file=sys.stderr)
Path(f"out/{slug}.mp4").unlink(missing_ok=True)
