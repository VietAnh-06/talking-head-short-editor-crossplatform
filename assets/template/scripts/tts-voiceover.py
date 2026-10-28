#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Phiên bản giọng đọc máy (VieNeu-TTS v3 Turbo, giọng dựng sẵn) cho một video: đọc kịch bản từng câu, ghép, rồi tạo
"nguồn" giả (ảnh nền tĩnh + giọng) để chạy new-video.py như một clip thường (chép lời, EDL, phụ đề, composition).
Dùng: uv run scripts/tts-voiceover.py <slug-mới> "<giọng>" <ảnh-nền.jpg>
  kịch bản: scripts/data/<slug-mới>-script.json  {"pauseSec": 0.28, "lines": ["câu 1", ...]}
  ra: out/tts/<slug-mới>-voice.wav, out/tts/<slug-mới>-source.mov  → new-video.py <project> out/tts/<slug-mới>-source.mov <slug-mới>
Giấy phép: mô hình + giọng dựng sẵn Apache-2.0, model card cho phép dùng âm thanh tạo ra trong nội dung thương mại
(giữ ghi công pnnbao97/VieNeu-TTS). KHÔNG nhân bản giọng người thật nếu chưa có đồng ý bằng văn bản của họ.
Giọng Bắc: Minh Đức, Phạm Tuyên, Xuân Vĩnh, Thanh Bình, Ngọc Linh, Đoan Trang, Quỳnh Anh, Quốc Tuấn.
"""
import os
import sys
from pathlib import Path

from cross_platform import die, duration, project_root, run, venv_cmd, venv_python

READ_SCRIPT = r'''
import json, sys, time
import numpy as np
from huggingface_hub import snapshot_download
from vieneu import Vieneu
script, voice, out, model_dir = sys.argv[1:5]
cfg = json.load(open(script, encoding="utf-8"))
# tải backbone thành file thật (không symlink) cho onnx_dir
snapshot_download("pnnbao-ump/VieNeu-TTS-v3-Turbo", local_dir=model_dir, allow_patterns=["onnx_update/*", "*.json", "*.txt"])
tts = Vieneu(onnx_dir=f"{model_dir}/onnx_update")
sr = getattr(tts, "sample_rate", None) or 48000
pause = np.zeros(int(sr * float(cfg.get("pauseSec", 0.28))), np.float32)
parts = []
for i, line in enumerate(cfg["lines"], 1):
    t0 = time.time()
    a = np.asarray(tts.infer(line, voice=voice), dtype=np.float32).reshape(-1)
    print(f"{i:2d}/{len(cfg['lines'])} {len(a) / sr:5.1f} s âm ({time.time() - t0:4.0f} s): {line[:60]}", flush=True)
    parts += [a, pause]
audio = np.concatenate(parts[:-1])
tts.save(audio, out)
print(f"→ {out}: {len(audio) / sr:.1f} s, {sr} Hz")
'''

if len(sys.argv) != 4:
    die('Dùng: uv run scripts/tts-voiceover.py <slug-mới> "<giọng>" <ảnh-nền.jpg>')
slug, voice, bg = sys.argv[1], sys.argv[2], str(Path(sys.argv[3]).resolve())
root = project_root(__file__)
script = f"scripts/data/{slug}-script.json"
if not Path(script).is_file():
    die(f"Thiếu {script}")
if not venv_python(".venv-vieneu").is_file():
    run(["uv", "venv", "-q", "-p", "3.12", ".venv-vieneu"])
    # onnxruntime ≥ 1.23 chặn "external data" nằm ngoài thư mục model → cache symlink của Hugging Face không nạp được
    run(["uv", "pip", "install", "-q", "-p", ".venv-vieneu", "vieneu==3.8.3", "onnxruntime==1.22.1"])
Path("out/tts").mkdir(parents=True, exist_ok=True)
Path(".bin").mkdir(exist_ok=True)
wav = f"out/tts/{slug}-voice.wav"
run(venv_cmd(".venv-vieneu", "-c", READ_SCRIPT, script, voice, wav, root / ".bin/vieneu-v3-turbo", isolated=True),
    env={**os.environ, "HF_HOME": str(root / ".bin/hf")})
# nguồn giả 1080x1920 dọc: ảnh nền tĩnh suốt thời lượng + giọng; video thật do B-roll/đồ họa phủ kín (bản không có mặt người nói)
run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-framerate", "30", "-i", bg, "-i", wav,
     "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", "-t", str(duration(wav)),
     "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "pcm_s16le", f"out/tts/{slug}-source.mov"])
print(f"Tiếp: uv run <skill>/scripts/new-video.py . out/tts/{slug}-source.mov {slug}")
