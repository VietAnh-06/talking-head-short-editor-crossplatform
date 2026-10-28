#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Tải thư viện SFX từ Mixkit (giấy phép Mixkit Free: dùng thương mại, không cần ghi công) theo
src/talking/sfx-library.json → public/sfx/<tên>.mp3, chuẩn hóa đỉnh về -1 dBFS để âm lượng trong code dễ đoán.
Một file lỗi thì in LỖI và tải tiếp file khác (new-project.py kiểm thiếu sau đó).
Dùng: uv run scripts/fetch-mixkit-sfx.py
"""
import json
import re
import sys
import tempfile
import urllib.request
from pathlib import Path

from cross_platform import duration, project_root, run

project_root(__file__)
Path("public/sfx").mkdir(parents=True, exist_ok=True)
library = json.loads(Path("src/talking/sfx-library.json").read_text(encoding="utf-8"))
for name, id_ in library.items():
    out = Path(f"public/sfx/{name}.mp3")
    if out.is_file() and out.stat().st_size:
        continue
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "raw.mp3"
        url = f"https://assets.mixkit.co/active_storage/sfx/{id_}/{id_}-preview.mp3"
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=120) as r:
                raw.write_bytes(r.read())
        except OSError:
            print(f"LỖI tải {name} ({id_})", file=sys.stderr)
            continue
        log = run(["ffmpeg", "-nostdin", "-hide_banner", "-nostats", "-i", raw, "-af", "volumedetect", "-f", "null", "-"],
                  capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
        m = re.search(r"max_volume: (-?[0-9.]+) dB", log)
        peak = float(m[1]) if m else 0.0
        gain = round(-1.0 - peak, 2)
        run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-af", f"volume={gain}dB",
             "-ar", "48000", "-b:a", "192k", out])
    print(f"{name:<18} {id_:>5}  {str(duration(out))[:5]}s  peak {peak} dB → +{gain} dB")
