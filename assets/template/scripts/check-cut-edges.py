"""Kiểm mọi điểm cắt bằng năng lượng (không dùng whisper): đoạn không được bắt đầu/kết thúc giữa một âm tiết.

Dùng: uv run --with numpy python scripts/check-cut-edges.py <slug> [--edit đường-dẫn-edit.json]
Báo: mép vào/ra đang có tiếng mà cách ranh giới âm tiết gần nhất > 30 ms (âm tiết bị cắt ngang: nghe thành mảnh chữ
"đây", "đình"), và hai đoạn liền nhau trong nguồn mà chồng lên nhau (một khúc phát hai lần). Lời nói liền thì chỗ trũng
giữa hai âm tiết vẫn −20…−28 dB, nên không xét theo mức tuyệt đối.
"""
import json
import sys
from pathlib import Path

import numpy as np

import voice_activity
from voice_activity import SR, WIN, envelope, load_audio, syllable_bounds, voiced

ROOT = Path(__file__).resolve().parent.parent
slug = sys.argv[1]
voice_activity.configure_for(slug)
edit_path = Path(sys.argv[sys.argv.index("--edit") + 1]) if "--edit" in sys.argv else ROOT / f"src/talking/edits/{slug}.json"
clips = json.loads(edit_path.read_text(encoding="utf-8"))["clips"]
# mép trùng khoảng "drop" là chỗ bỏ tiếng đệm/chữ lặp: âm bên cạnh là âm đã bỏ, đếm riêng
drops = [tuple(d[:2]) for d in json.loads((ROOT / f"scripts/edits/{slug}.json").read_text(encoding="utf-8")).get("drop", [])]
at_drop = lambda t: any(abs(t - ds) <= 0.05 or abs(t - de) <= 0.05 for ds, de in drops)
audio = load_audio(ROOT / f"public/footage/{slug}-voice.wav")
EDGE = 0.035  # làm tròn theo khung hình (33 ms) không tính là lệch
env = envelope(audio)
v = voiced(env)
bounds = syllable_bounds(env, v)


def mid_syllable(t: float) -> float:
    """Khoảng cách tới ranh giới âm tiết gần nhất nếu t đang có tiếng, 0 nếu im lặng."""
    if not v[min(len(v) - 1, int(t / WIN))]:
        return 0.0
    return float(np.abs(bounds - t).min()) if len(bounds) else 9.0


def level(t0: float, t1: float) -> float:
    x = audio[max(0, int(t0 * SR)):int(t1 * SR)]
    return float(20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-9)) if len(x) else -99.0


bad = 0
for k, c in enumerate(clips):
    din, dout = mid_syllable(c["srcIn"]), mid_syllable(c["srcOut"])
    notes = []
    if din > EDGE and not at_drop(c["srcIn"]):
        notes.append(f"vào giữa âm tiết (cách ranh giới {din * 1000:.0f} ms, {level(c['srcIn'], c['srcIn'] + 0.02):.0f} dB)")
    if dout > EDGE and not at_drop(c["srcOut"]):
        notes.append(f"ra giữa âm tiết (cách ranh giới {dout * 1000:.0f} ms, {level(c['srcOut'] - 0.02, c['srcOut']):.0f} dB)")
    prev = clips[k - 1] if k else None
    if prev and prev["srcIn"] < c["srcIn"] < prev["srcOut"]:
        notes.append(f"chồng đoạn trước {prev['srcOut'] - c['srcIn']:.2f}s (phát lại)")
    if notes:
        bad += 1
        print(f"{c['section']:>10}#{c['piece']} nguồn {c['srcIn']:7.2f}-{c['srcOut']:7.2f} timeline {c['at']:6.2f}: {'; '.join(notes)}")
print(f"{slug}: {bad}/{len(clips)} đoạn có mép cần xem")
