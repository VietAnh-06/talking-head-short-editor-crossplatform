#!/usr/bin/env python3
"""Đọc mỗi câu kịch bản N lần bằng VieNeu-TTS v3 Turbo (giọng dựng sẵn) để chọn bản nghe khớp nhất bằng tts-pick.py.

Dùng (trong .venv-vieneu): python -I scripts/tts-takes.py <script.json> <thư-mục-ra> [--takes 3] [--only 1,7,18]
script.json: {"voice": "Đoan Trang", "lines": ["câu 1", ...], "sampling": {"temperature": 0.1, "top_k": 10}}; ra: <thư-mục>/LL-T.wav (LL câu, T lần đọc).
Lần đọc đã có thì bỏ qua, nên chạy lại được sau khi dừng giữa chừng.
"""
import argparse
import json
import os
import sys
import time

import numpy as np
from huggingface_hub import snapshot_download
from vieneu import Vieneu

# Mặc định của thư viện là 0,8 / 25. Người dùng chốt 0,1 / 10 tối 22/10/2026 ("ko cho vieneu sáng tác nhiều"): ở mức này mọi lần đọc
# gần như giống hệt nhau, nên chữ khó (Seoul, won) chọn cách viết bằng một file thử nghe tai một lần là xong; đọc lại không đổi được kết quả.
# "sampling" trong script.json ghi đè từng khóa.
DEFAULT_SAMPLING = {"temperature": 0.1, "top_k": 10}

ap = argparse.ArgumentParser()
ap.add_argument("script")
ap.add_argument("outdir")
ap.add_argument("--takes", type=int, default=3)
ap.add_argument("--only", default="")
ap.add_argument("--model-dir", default=os.path.join(os.getcwd(), ".bin/vieneu-v3-turbo"))
a = ap.parse_args()
cfg = json.load(open(a.script, encoding="utf-8"))
only = {int(x) for x in a.only.split(",") if x}
os.makedirs(a.outdir, exist_ok=True)
snapshot_download("pnnbao-ump/VieNeu-TTS-v3-Turbo", local_dir=a.model_dir, allow_patterns=["onnx_update/*", "*.json", "*.txt"])
tts = Vieneu(onnx_dir=f"{a.model_dir}/onnx_update")
sr = getattr(tts, "sample_rate", None) or 48000
for i, line in enumerate(cfg["lines"], 1):
    if only and i not in only:
        continue
    for t in range(1, a.takes + 1):
        out = os.path.join(a.outdir, f"{i:02d}-{t}.wav")
        if os.path.exists(out):
            continue
        t0 = time.time()
        audio = np.asarray(tts.infer(line, voice=cfg["voice"], **{**DEFAULT_SAMPLING, **cfg.get("sampling", {})}), dtype=np.float32).reshape(-1)
        tts.save(audio, out)
        print(f"{i:02d}-{t} {len(audio) / sr:5.1f} s âm ({time.time() - t0:4.0f} s): {line[:60]}", flush=True)
print("xong", file=sys.stderr)
