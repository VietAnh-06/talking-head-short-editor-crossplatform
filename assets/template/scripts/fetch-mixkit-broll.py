#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Tải clip B-roll miễn phí từ Mixkit (giấy phép Mixkit Free: dùng thương mại, không cần ghi công;
bản miễn phí tối đa 720p) và ảnh thumbnail làm nền mờ. Bỏ qua clip đã có.
Dùng: uv run scripts/fetch-mixkit-broll.py <id> [<id> ...]
"""
import sys
import urllib.request
from pathlib import Path

from cross_platform import output, project_root, run

UA = {"User-Agent": "Mozilla/5.0"}


def download(url: str, dest: Path) -> bool:
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
            dest.write_bytes(r.read())
        return dest.stat().st_size > 0
    except OSError:
        dest.unlink(missing_ok=True)
        return False


ids = sys.argv[1:]
project_root(__file__)
Path("public/broll").mkdir(parents=True, exist_ok=True)
for id_ in ids:
    mp4 = Path(f"public/broll/mixkit-{id_}.mp4")
    if not (mp4.is_file() and mp4.stat().st_size):
        if not download(f"https://assets.mixkit.co/videos/{id_}/{id_}-720.mp4", mp4):
            print(f"LỖI tải {id_}", file=sys.stderr)
            continue
    thumb = Path(f"public/broll/mixkit-{id_}.jpg")
    if not (thumb.is_file() and thumb.stat().st_size):
        if not any(download(f"https://assets.mixkit.co/videos/{id_}/{id_}-thumb-{s}.jpg", thumb) for s in ("720-0", "720-1", "720-2", "720-3")):
            run(["ffmpeg", "-loglevel", "error", "-y", "-ss", "1", "-i", mp4, "-frames:v", "1", "-q:v", "3", thumb])
    info = output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                   "-show_entries", "format=duration", "-of", "csv=p=0:s=x", mp4])
    print(f"{id_:<8} {' '.join(info.split())}")
# clip chưa gắn nhãn người (people-tags.jsonl) thì cổng check-style-novelty.py chặn: xem thumbnail rồi gắn nhãn
tags = Path("public/broll/people-tags.jsonl")
tagged = tags.read_text(encoding="utf-8") if tags.is_file() else ""
for id_ in ids:
    if f'"id": "{id_}"' not in tagged:
        print(f"CHƯA GẮN NHÃN NGƯỜI: {id_} (public/broll/mixkit-{id_}.jpg)")
