#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Chuẩn bị footage quay tay (talking head dọc 4K) để dựng:
  video 1440x2560@30 (đủ chỗ punch-in 1.33x khi xuất 1080x1920), chỉnh màu nhẹ, không tiếng;
  giọng làm sạch ghi riêng (giọng máy có out/tts/<slug>-voice.wav thì chép nguyên, không lọc): sửa clip micro cài áo,
  lọc ồn thích ứng, nén nhẹ, nhấn 3.4 kHz, giảm ù 250 Hz.
Dùng: uv run scripts/prepare-talking-footage.py <file-nguồn> <slug>
"""
import sys
from pathlib import Path

from cross_platform import die, project_root, run

if len(sys.argv) != 3:
    die("Dùng: uv run scripts/prepare-talking-footage.py <file-nguồn> <slug>")
src, slug = str(Path(sys.argv[1]).resolve()), sys.argv[2]
project_root(__file__)
Path("public/footage").mkdir(parents=True, exist_ok=True)
graded, voice = f"public/footage/{slug}-graded.mp4", f"public/footage/{slug}-voice.wav"
ff = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
run([*ff, "-i", src,
     "-vf", "scale=1440:2560:flags=lanczos,fps=30,eq=contrast=1.05:saturation=1.1:gamma=0.98,unsharp=5:5:0.35",
     "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", "-g", "30", "-an", "-movflags", "+faststart", graded])
tts = Path(f"out/tts/{slug}-voice.wav")
if tts.is_file():
    # giọng máy (tts-pick.py) đã sạch: không lọc ồn/nén/EQ như tiếng micro, afftdn trên giọng TTS làm giọng méo, nghe lơ lớ
    # (người dùng nghe video 004 thấy "lai lái tây", 21/10/2026)
    run([*ff, "-i", tts, "-ac", "1", "-ar", "48000", voice])
else:
    run([*ff, "-i", src, "-vn",
         "-af", "adeclip,highpass=f=85,lowpass=f=14500,afftdn=nr=20:nf=-30:tn=1,acompressor=threshold=-18dB:ratio=2.5:attack=8:release=120:makeup=1,equalizer=f=3400:t=q:w=1.2:g=2.5,equalizer=f=250:t=q:w=1:g=-2",
         "-ac", "1", "-ar", "48000", voice])
run([*ff, "-sseof", "-0.4", "-i", graded, "-frames:v", "1", "-q:v", "2", f"public/footage/{slug}-last-frame.jpg"])
run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height,r_frame_rate", "-show_entries", "format=duration",
     "-of", "compact=p=0", graded])
