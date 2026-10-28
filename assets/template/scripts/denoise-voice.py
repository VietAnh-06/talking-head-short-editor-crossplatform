#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Khử ồn mạnh cho giọng quay ngoài trời (gió, lá xào xạc, đường phố) bằng DeepFilterNet3 (mạng nơ-ron, chạy CPU),
thay cho afftdn của prepare-talking-footage.py khi measure-voice-noise.py báo nền chỉ thấp hơn giọng < 10 dB.
Dùng: uv run scripts/denoise-voice.py <slug> <file-nguồn> [giới-hạn-dB]
  giới-hạn-dB: bỏ trống = khử hết (nền ≈ -45 dB); 24 = giữ lại ít nền, phụ âm xát (ch, s, x) đỡ yếu hơn.
Ghi đè public/footage/<slug>-voice.wav (bản cũ giữ ở <slug>-voice-afftdn.wav), đặt "vadThresholdDb": -40 trong
scripts/edits/<slug>.json (ngưỡng -30 mặc định coi phụ âm yếu là im lặng → cắt lẹm). Sau đó dựng lại EDL và chạy lại
verify-edit-voice / check-cut-edges / find-voice-leaks / caption-talking-edit: các khoảng nghỉ thật lộ ra nên nhịp cắt đổi.

Dùng file chạy Rust chính thức của DeepFilterNet (~36 MB, không cần torch), cho kết quả trùng bản Python tới từng dB.
BẮT BUỘC -D (compensate delay): thiếu nó giọng trễ 30 ms so với hình (lệch khẩu hình, lệch mép cắt).
"""
import hashlib
import json
import os
import platform
import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path

from cross_platform import die, project_root, run, uv_python

VER = "0.5.6"
# (hệ điều hành, kiến trúc) → (tên file phát hành, SHA-256)
ASSETS = {
    ("Linux", "x86_64"): ("x86_64-unknown-linux-musl", "70775e251eee44c0f2451a1e833326cf8bcbbe304d3e7cd12851e6fce72ef7da"),
    ("Darwin", "arm64"): ("aarch64-apple-darwin", "4601e7f4e4c03e59a4c5b5000216ef3add3e808799cfccd95e14e83ea4611081"),
    ("Darwin", "x86_64"): ("x86_64-apple-darwin", "d3be84003acb7c23e738ad7f70a158ec779a8d233a82e7fa3e717d112eb5b50f"),
    ("Windows", "AMD64"): ("x86_64-pc-windows-msvc.exe", "75e11fa16445f560cb6b021521ddb89e89270d13b83089705d98776f58fd7915"),
}

if len(sys.argv) not in (3, 4):
    die("Dùng: uv run scripts/denoise-voice.py <slug> <file-nguồn> [giới-hạn-dB]")
slug, src = sys.argv[1], str(Path(sys.argv[2]).resolve())
lim = sys.argv[3] if len(sys.argv) == 4 else ""
project_root(__file__)
voice = Path(f"public/footage/{slug}-voice.wav")
key = (platform.system(), platform.machine())
if key not in ASSETS:
    die(f"DeepFilterNet {VER} không có bản cho {key[0]} {key[1]} (hỗ trợ: Windows x64, macOS Intel/Apple Silicon, Linux x64)")
asset, sha = ASSETS[key]
binary = Path(".bin") / f"deep-filter-{VER}{'.exe' if asset.endswith('.exe') else ''}"
if not binary.is_file():
    binary.parent.mkdir(exist_ok=True)
    part = binary.with_name(binary.name + ".part")
    url = f"https://github.com/Rikorose/DeepFilterNet/releases/download/v{VER}/deep-filter-{VER}-{asset}"
    with urllib.request.urlopen(url, timeout=300) as r, open(part, "wb") as f:
        shutil.copyfileobj(r, f)
    if hashlib.sha256(part.read_bytes()).hexdigest() != sha:
        part.unlink()
        die("Checksum deep-filter sai")
    os.replace(part, binary)
    binary.chmod(0o755)

with tempfile.TemporaryDirectory() as tmp:
    pre, out = Path(tmp) / "pre.wav", Path(tmp) / "out"
    ff = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y"]
    run([*ff, "-i", src, "-vn", "-af", "adeclip,highpass=f=85", "-ac", "1", "-ar", "48000", pre])
    run([binary.resolve(), "-D", *(["-a", lim] if lim else []), "-o", out, pre], capture_output=True)
    backup = Path(f"public/footage/{slug}-voice-afftdn.wav")
    if voice.is_file() and not backup.is_file():
        shutil.copy2(voice, backup)
    # cùng chuỗi nén/EQ như prepare-talking-footage.py, bỏ afftdn
    run([*ff, "-i", out / "pre.wav",
         "-af", "lowpass=f=14500,acompressor=threshold=-18dB:ratio=2.5:attack=8:release=120:makeup=1,equalizer=f=3400:t=q:w=1.2:g=2.5,equalizer=f=250:t=q:w=1:g=-2",
         "-ac", "1", "-ar", "48000", voice])
cfg_path = Path(f"scripts/edits/{slug}.json")
if cfg_path.exists():
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    cfg.setdefault("vadThresholdDb", -40)
    cfg_path.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
run(uv_python("scripts/measure-voice-noise.py", slug, deps=["numpy"]))
print(f"Tiếp: uv run --with numpy python scripts/build-talking-edit.py {slug} rồi kiểm lại mép cắt, âm thừa, phụ đề")
