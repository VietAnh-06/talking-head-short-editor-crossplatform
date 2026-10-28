#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Ghép thumbnail các clip Mixkit thành một bảng có nhãn mã số để duyệt bằng mắt trước khi tải.
Dùng: uv run scripts/mixkit-thumbs.py out/thumbs.jpg <mã> [<mã> ...]
Cần ImageMagick 7 (`magick`); ImageMagick 6 (chỉ có convert/montage) vẫn chạy.
"""
import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path

from cross_platform import die, run

if len(sys.argv) < 3:
    die("Dùng: uv run scripts/mixkit-thumbs.py <ảnh-ra.jpg> <mã> [<mã> ...]")
out, ids = Path(sys.argv[1]), sys.argv[2:]
magick = ["magick"] if shutil.which("magick") else []
convert, montage = magick or ["convert"], [*magick, "montage"]
with tempfile.TemporaryDirectory() as tmp:
    tiles = []
    for id_ in ids:
        jpg = Path(tmp) / f"{id_}.jpg"
        for s in ("720-0", "720-1", "720-2", "720-3", "360-0"):
            try:
                with urllib.request.urlopen(f"https://assets.mixkit.co/videos/{id_}/{id_}-thumb-{s}.jpg", timeout=60) as r:
                    jpg.write_bytes(r.read())
                break
            except OSError:
                continue
        if jpg.is_file() and jpg.stat().st_size:
            run([*convert, jpg, "-resize", "320x180^", "-gravity", "center", "-extent", "320x180", "-gravity", "south",
                 "-fill", "white", "-undercolor", "#000a", "-pointsize", "22", "-annotate", "+0+4", f" {id_} ", jpg])
            tiles.append(jpg)
    if not tiles:
        die("Không tải được thumbnail nào")
    out.parent.mkdir(parents=True, exist_ok=True)
    run([*montage, *tiles, "-tile", "6x", "-geometry", "+3+3", out])
print(out)
