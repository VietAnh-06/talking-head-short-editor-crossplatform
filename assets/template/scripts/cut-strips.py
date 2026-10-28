#!/usr/bin/env python3
"""Dải kiểm tra tại mọi điểm cắt của bản final: 7 khung trong ±1,5 s, sóng âm, vạch cắt, chữ phụ đề quanh đó.

Dùng: uv run --with numpy --with pillow python scripts/cut-strips.py <slug> [video]   (mặc định out/final/<slug>.mp4)
Điểm cắt = nhát cắt giọng trong EDL (src/talking/edits/<slug>.json) + đổi cảnh hình ffmpeg phát hiện (scene > 0,12; 0,3 bỏ sót chuyển B-roll trong bố cục thẻ vì nền mờ gần giống nhau),
gộp các điểm cách nhau < 0,25 s. Tự đánh dấu:
  KHUNG ĐEN: khung trong ±0,5 s có độ sáng trung bình < 12/255;
  BỤP: (trên giọng đã ghép <slug>-edit-voice.wav, không lẫn SFX) đỉnh |Δmẫu| trong ±25 ms quanh nhát cắt giọng > 2,5× phân vị 99% của ±0,5 s xung quanh (fade hỏng, cắt giữa dao động).
Ghi out/qa/<slug>-cuts-NN.jpg (8 điểm mỗi tờ) để đọc bằng mắt: nhảy hình, lớp phủ đứng yên, phụ đề bị che, chữ mất ở mép.
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SLUG = sys.argv[1]
VIDEO = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / f"out/final/{SLUG}.mp4"
EDIT = json.loads((ROOT / f"src/talking/edits/{SLUG}.json").read_text(encoding="utf-8"))
OUT = ROOT / "out/qa"
OUT.mkdir(parents=True, exist_ok=True)
SR = 16000
TILE_W, TILE_H = 150, 266
OFFSETS = [-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5]
WAVE_H, LABEL_H = 60, 44


# font có dấu tiếng Việt: fontconfig (Linux) hoặc font hệ thống có sẵn của Windows/macOS
FONT_FILES = ["C:/Windows/Fonts/arialbd.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf"]


def font(size: int):
    path = ""
    if shutil.which("fc-match"):
        path = subprocess.run(["fc-match", "-f", "%{file}", "Noto Sans:bold"], capture_output=True, text=True).stdout
    path = path or next((f for f in FONT_FILES if Path(f).is_file()), "")
    return ImageFont.truetype(path, size) if path else ImageFont.load_default()


FONT, FONT_S = font(16), font(13)
duration = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(VIDEO)]))
def load(path) -> np.ndarray:
    return np.frombuffer(subprocess.check_output(["ffmpeg", "-nostdin", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]), np.float32)


audio = load(VIDEO)
# bụp do cắt chỉ nằm trong giọng: dò trên giọng đã ghép (whoosh chuyển cảnh trùng nhát cắt là cố ý, không phải bụp)
voice_path = ROOT / f"public/footage/{SLUG}-edit-voice.wav"
voice = load(voice_path) if voice_path.exists() else audio

clips = EDIT["clips"]
cuts = [(c["at"], f"cắt giọng {clips[i - 1]['section']} -> {c['section']}") for i, c in enumerate(clips) if i > 0]
scene_log = subprocess.run(["ffmpeg", "-nostdin", "-i", str(VIDEO), "-vf", "select='gt(scene,0.12)',showinfo", "-an", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
scenes = [float(t) for t in re.findall(r"pts_time:([\d.]+)", scene_log)]
for t in scenes:
    if all(abs(t - c) >= 0.25 for c, _ in cuts):
        cuts.append((t, "đổi cảnh"))
cuts = sorted((t, k) for t, k in cuts if 0.2 < t < duration - 0.2)


def frame_at(t: float) -> Image.Image:
    t = min(max(t, 0), duration - 0.05)
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-ss", f"{t:.3f}", "-i", str(VIDEO), "-frames:v", "1",
                          "-vf", f"scale={TILE_W}:{TILE_H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    if len(raw) < TILE_W * TILE_H * 3:
        return Image.new("RGB", (TILE_W, TILE_H))
    return Image.frombytes("RGB", (TILE_W, TILE_H), raw[: TILE_W * TILE_H * 3])


def words_near(t: float) -> str:
    return " ".join(w["text"] for w in EDIT.get("captions", []) if t - 1.5 <= w["start"] <= t + 1.5)


strips, flags = [], []
for n, (t, kind) in enumerate(cuts, 1):
    tiles = [frame_at(t + o) for o in OFFSETS]
    notes = []
    if any(np.asarray(im).mean() < 12 for im, o in zip(tiles, OFFSETS) if abs(o) <= 0.5):
        notes.append("KHUNG ĐEN")
    if kind.startswith("cắt giọng"):
        i = int(t * SR)
        d = np.abs(np.diff(voice[max(0, i - SR // 2): i + SR // 2]))
        mid = len(d) // 2
        near = d[max(0, mid - int(0.025 * SR)): mid + int(0.025 * SR)]
        around = np.concatenate([d[: max(0, mid - int(0.05 * SR))], d[mid + int(0.05 * SR):]])
        # bụp thật vượt hẳn mọi đỉnh của lời nói quanh đó; phụ âm bật (đ, t, b) đầu chữ thì không
        if len(near) and len(around) and near.max() > 2.5 * np.percentile(around, 99) and near.max() > 0.02:
            notes.append("BỤP?")
    width = TILE_W * len(OFFSETS)
    strip = Image.new("RGB", (width, LABEL_H + TILE_H + WAVE_H), (20, 20, 24))
    draw = ImageDraw.Draw(strip)
    head = f"#{n}  {t:6.2f} s  {kind}" + (f"   !! {' / '.join(notes)}" if notes else "")
    draw.text((8, 4), head, font=FONT, fill=(255, 90, 90) if notes else (235, 235, 235))
    draw.text((8, 24), words_near(t)[:110], font=FONT_S, fill=(170, 200, 255))
    for k, im in enumerate(tiles):
        strip.paste(im, (k * TILE_W, LABEL_H))
    seg = audio[max(0, int((t - 1.75) * SR)): int((t + 1.75) * SR)]
    if len(seg):
        cols = np.array_split(np.abs(seg), width)
        peak = max(1e-6, float(np.abs(seg).max()))
        y0 = LABEL_H + TILE_H
        for x, c in enumerate(cols):
            h = int((float(c.max()) if len(c) else 0) / peak * (WAVE_H - 4))
            draw.line([(x, y0 + WAVE_H // 2 - h // 2), (x, y0 + WAVE_H // 2 + h // 2)], fill=(90, 200, 140))
    cx = width // 2
    draw.line([(cx, LABEL_H), (cx, LABEL_H + TILE_H + WAVE_H)], fill=(255, 60, 60), width=2)
    strips.append(strip)
    if notes:
        flags.append(f"#{n} {t:.2f} s {kind}: {', '.join(notes)}")

sheets = []
for s in range(0, len(strips), 8):
    group = strips[s: s + 8]
    sheet = Image.new("RGB", (group[0].size[0], sum(g.size[1] + 6 for g in group)), (0, 0, 0))
    y = 0
    for g in group:
        sheet.paste(g, (0, y))
        y += g.size[1] + 6
    path = OUT / f"{SLUG}-cuts-{s // 8 + 1:02d}.jpg"
    sheet.save(path, quality=78)
    sheets.append(path)

print(f"{len(cuts)} điểm cắt ({sum(k.startswith('cắt') for _, k in cuts)} cắt giọng, {sum(k == 'đổi cảnh' for _, k in cuts)} đổi cảnh) → {len(sheets)} tờ: {sheets[0].parent}/{SLUG}-cuts-*.jpg")
for f in flags:
    print("  " + f)
if not flags:
    print("không có khung đen / nghi bụp; vẫn phải đọc các tờ ảnh (nhảy hình, lớp phủ kẹt, phụ đề bị che)")
