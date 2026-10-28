"""Độ to cảm nhận của âm ngắn: RMS lớn nhất trên cửa sổ 100 ms (dBFS). LUFS momentary (400 ms) không đo được tiếng pop/click ngắn.

Dùng: uv run --with numpy python scripts/sfx_loudness.py <file...> [--voice]
--voice: in phân vị 50/90 của RMS 100 ms trên các khung có tiếng (giọng người nói), để đặt mức SFX theo giọng.
"""
import subprocess
import sys

import numpy as np

SR, WIN = 48000, 0.1


def rms_windows(path: str) -> np.ndarray:
    raw = subprocess.check_output(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"])
    a = np.frombuffer(raw, dtype=np.float32)
    hop, w = int(SR * WIN / 2), int(SR * WIN)
    if len(a) < w:
        a = np.pad(a, (0, w - len(a)))
    frames = np.lib.stride_tricks.sliding_window_view(a, w)[::hop]
    return 20 * np.log10(np.sqrt((frames ** 2).mean(1)) + 1e-9)


def peak_rms(path: str) -> float:
    return float(rms_windows(path).max())


if __name__ == "__main__":
    files = [f for f in sys.argv[1:] if not f.startswith("--")]
    for f in files:
        if "--voice" in sys.argv:
            r = rms_windows(f)
            r = r[r > -40]
            print(f"{f}: p50 {np.percentile(r, 50):.1f} p90 {np.percentile(r, 90):.1f} dBFS")
        else:
            print(f"{peak_rms(f):6.1f}  {f}")
