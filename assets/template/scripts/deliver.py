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
import json
import re
import sys
import tempfile
from pathlib import Path

from cross_platform import die, project_root

if not 2 <= len(sys.argv) <= 3:
    die("Dùng: uv run scripts/deliver.py <slug> [tên-giao]", 2)
slug = sys.argv[1]
name = sys.argv[2] if len(sys.argv) == 3 else ""
if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
    die(f"slug không hợp lệ: '{slug}'", 2)
def valid_name(value):
    reserved = {"con", "prn", "aux", "nul", *[f"{p}{i}" for p in ("com", "lpt") for i in range(1, 10)]}
    return (isinstance(value, str) and 0 < len(value) <= 180 and value not in (".", "..")
            and not any(c in '<>:"/\\|?*' or ord(c) < 32 for c in value)
            and value[-1] not in ". " and value.split(".")[0].casefold() not in reserved
            and not value.casefold().endswith(".mp4"))


if name and not valid_name(name):
    die("Tên giao phải là tên file hợp lệ, không có đường dẫn hoặc đuôi .mp4", 2)
project_root(__file__)
X = Path("du-lieu/video-xuat")
src = Path(f"out/final/{slug}.mp4")
names_path = X / ".deliveries.json"
try:
    names = json.loads(names_path.read_text(encoding="utf-8")) if names_path.exists() else {}
    if not isinstance(names, dict) or not all(isinstance(k, str) and valid_name(v) for k, v in names.items()):
        raise ValueError("cần ánh xạ slug → tên giao")
except (OSError, ValueError) as error:
    die(f"Không đọc được {names_path}: {error}")
previous = names.get(slug)
if previous and name and name != previous:
    die(f"Video đã có tên giao {previous}; dùng lại tên đó để tránh tạo nhiều bản", 2)
name = name or previous or ""
found = [f for f in X.glob("*.mp4")
         if re.fullmatch(rf"(?:video-[0-9]{{3,}}-)?{re.escape(slug)}", f.stem)]
if not name:
    if len(found) != 1:
        die(f"Không đoán được tên giao cho '{slug}' (tìm thấy {len(found)} file); truyền tên, vd. video-007-{slug}", 2)
    name = found[0].stem
if any(f.stem != name for f in found):
    die(f"Video đã có tên giao khác: {', '.join(f.stem for f in found)}; dùng lại tên đó để tránh tạo nhiều bản", 2)
if any(s != slug and n.casefold() == name.casefold() for s, n in names.items()):
    die(f"Tên giao {name} đã thuộc video khác", 2)
root = Path.cwd().resolve()
targets = [X, names_path, X / f"{name}.mp4", X / f"{name}-cover.jpg", X / f"{name}.txt"]
targets.extend([src, Path(f"out/{slug}.mp4"), Path(f"out/final/{slug}-cover.jpg"),
                Path(f"out/{slug}-cover.jpg"), Path(f"out/final/{slug}-caption.txt")])
if any(p.resolve() != root / p for p in targets):
    die("Đường dẫn giao không được đi qua symlink/junction", 2)
X.mkdir(parents=True, exist_ok=True)
video = X / f"{name}.mp4"
delivered_new = False
if src.is_file():
    if src.stat().st_size == 0:
        die(f"Video rỗng: {src}")
    replaced = " (ghi đè bản trước)" if video.is_file() else ""
    os.replace(src, video)
    delivered_new = True
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
names[slug] = name
with tempfile.NamedTemporaryFile(dir=X, prefix=".deliveries-", suffix=".json", mode="w", encoding="utf-8", delete=False) as handle:
    pending = Path(handle.name)
    json.dump(names, handle, ensure_ascii=False, indent=2)
try:
    os.replace(pending, names_path)
finally:
    pending.unlink(missing_ok=True)
if delivered_new:
    Path(f"out/{slug}.mp4").unlink(missing_ok=True)
