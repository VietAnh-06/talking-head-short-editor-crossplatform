"""So âm thanh bản cuối với bản trộn preflight đã nghe (uv run scripts/preflight-audio.py): giống thì verify-final khỏi chạy whisper lại.
Dùng: uv run -p .venv-align python -X utf8 -I scripts/audio-same.py <preflight-mix.wav> <final.mp4>   exit 0 giống, 1 khác (in lý do).

So đường bao âm lượng 50 ms (dB), bù độ lệch theo từng khúc 3 s: master-loudness đổi âm lượng cả bài, AAC làm lệch vài dB ở
khung nhỏ, nhưng mất/thêm chữ, SFX dời chỗ, đổi lần đọc thì lệch chục dB trên nhiều khung liền.
"""
import subprocess
import sys

import numpy as np

SR = 16000
HOP = int(0.05 * SR)
BLOCK = 60          # 3 s
ACTIVE_DB = -45     # bỏ khung im lặng: sàn nhiễu AAC dao động nhiều
DIFF_DB = 2       # bản giống nhau (master + AAC) lệch tối đa 0,8 dB, đo visa-017
RUN = 2             # 100 ms liền lệch > DIFF_DB thì coi là khác
LEN_SLACK = 0.1


def env(path: str) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32)
    a = a[: len(a) // HOP * HOP].reshape(-1, HOP)
    return 20 * np.log10(np.sqrt(np.mean(a ** 2, axis=1)) + 1e-6)


def main() -> int:
    ref, fin = env(sys.argv[1]), env(sys.argv[2])
    if abs(len(ref) - len(fin)) * HOP / SR > LEN_SLACK:
        print(f"khác độ dài: preflight {len(ref) * HOP / SR:.2f} s, bản cuối {len(fin) * HOP / SR:.2f} s")
        return 1
    n = min(len(ref), len(fin))
    ref, fin = ref[:n], fin[:n]
    active = np.maximum(ref, fin) > ACTIVE_DB
    d = fin - ref
    bad = np.zeros(n, bool)
    for s in range(0, n, BLOCK):
        m = active[s:s + BLOCK]
        if m.sum() < 5:
            continue
        off = np.median(d[s:s + BLOCK][m])
        bad[s:s + BLOCK] = m & (np.abs(d[s:s + BLOCK] - off) > DIFF_DB)
    runs, start = [], None
    for i, b in enumerate(np.append(bad, False)):
        if b and start is None:
            start = i
        elif not b and start is not None:
            if i - start >= RUN:
                runs.append((start, i))
            start = None
    if runs:
        print("khác ở: " + ", ".join(f"{a * HOP / SR:.1f}–{b * HOP / SR:.1f} s" for a, b in runs[:10]) + (" …" if len(runs) > 10 else ""))
        return 1
    print(f"giống bản trộn preflight ({bad.sum()} khung lẻ lệch > {DIFF_DB} dB trên {int(active.sum())} khung có tiếng)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
