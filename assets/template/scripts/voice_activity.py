"""Đo tiếng nói theo năng lượng (cửa sổ 10 ms) trên giọng đã làm sạch. Dùng chung cho dựng EDL và dò âm lọt."""
import subprocess
from pathlib import Path

import numpy as np

SR = 16000
WIN = 0.01          # cửa sổ đo năng lượng 10 ms
THRESH_DB = -30.0   # trên ngưỡng này là có tiếng nói (nền ồn sau lọc ≈ -34 dB)


def configure_for(slug: str) -> None:
    """Ngưỡng riêng của video: giọng khử ồn mạnh (DeepFilterNet, nền ≈ -44 dB) làm phụ âm xát yếu (ch, s, x ≈ -35 dB)
    dưới -30 nên bị coi là im lặng và bị cắt lẹm; khai "vadThresholdDb" trong scripts/edits/<slug>.json."""
    import json
    global THRESH_DB
    cfg = Path(__file__).resolve().parent / "edits" / f"{slug}.json"
    if cfg.exists():
        THRESH_DB = float(json.loads(cfg.read_text(encoding="utf-8")).get("vadThresholdDb", THRESH_DB))


def load_audio(path: Path, sr: int = SR) -> np.ndarray:
    raw = subprocess.check_output(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"])
    return np.frombuffer(raw, dtype=np.float32)


def envelope(audio: np.ndarray) -> np.ndarray:
    w = int(SR * WIN)
    n = len(audio) // w
    return 20 * np.log10(np.sqrt((audio[: n * w].reshape(n, w) ** 2).mean(1)) + 1e-9)


def voiced(env: np.ndarray) -> np.ndarray:
    """Mặt nạ có tiếng nói; lấp lỗ hổng < 60 ms bên trong một tiếng."""
    out = env > THRESH_DB
    i = 0
    while i < len(out):
        if not out[i]:
            j = i
            while j < len(out) and not out[j]:
                j += 1
            if j - i < 6 and i > 0 and j < len(out):
                out[i:j] = True
            i = j
        else:
            i += 1
    return out


def speech_runs(v: np.ndarray, lo: float, hi: float, min_len: float = 0.04) -> list[tuple[float, float]]:
    i0, i1 = max(0, int(lo / WIN)), min(len(v), int(hi / WIN))
    runs, i = [], i0
    while i < i1:
        if v[i]:
            j = i
            while j < i1 and v[j]:
                j += 1
            if (j - i) * WIN >= min_len:
                runs.append((i * WIN, j * WIN))
            i = j
        else:
            i += 1
    return runs


def syllable_bounds(env: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Ranh giới âm tiết (giây): điểm trũng trên đường năng lượng đã làm mượt, thấp hơn đỉnh hai bên (trong 150 ms) ≥ 4 dB,
    cộng mọi khung im lặng. Cắt ở đây thì âm tiết được giữ trọn hoặc bỏ trọn, không còn nửa chữ."""
    sm = np.convolve(env, np.ones(3) / 3, mode="same")
    out = []
    for i in range(15, len(sm) - 15):
        if not v[i]:
            out.append(i)
        elif sm[i] <= sm[i - 3:i + 4].min() and sm[i - 15:i].max() - sm[i] >= 4 and sm[i + 1:i + 16].max() - sm[i] >= 4:
            out.append(i)
    return np.array(out) * WIN
