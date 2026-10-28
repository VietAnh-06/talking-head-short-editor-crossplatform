#!/usr/bin/env python3
"""Kiểm đồ họa/tiêu đề/logo/phụ đề có che mặt người nói không, trên khung do qa-frames.mjs render (cả bản full và bare).

Dùng: uv run -p 3.12 --with mediapipe --with pillow --with numpy python scripts/face-check.py <thư-mục-qa> [ngưỡng]
  <thư-mục-qa>: out/qa/<slug> (có frames.json, full-*.jpg, bare-*.jpg)
Cách làm: dò mặt trên bản bare (chỉ footage người nói; khung B-roll ra đen nên mặt người trong B-roll không bị tính),
nới khung mặt lên trên (tóc, trán) và hai bên, rồi so full với bare trong vùng đó. Điểm ảnh lệch > 40/255 là có lớp phủ;
tỉ lệ điểm ảnh lệch vượt ngưỡng (mặc định 6%) → CHE MẶT. Ghi ảnh ghép các khung lỗi kèm khung mặt vào <thư-mục-qa>-face.jpg.
Model BlazeFace short-range (Google MediaPipe, ghim SHA-256) tải lần đầu vào .bin/; dò trên vùng giữa-trên phóng 2×
vì model short-range bỏ sót mặt nhỏ khi người nói đứng xa (độ tin cậy 0,56 → 0,95 trên clip-12).
"""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
QA = Path(sys.argv[1])
LIMIT = float(sys.argv[2]) if len(sys.argv) > 2 else 0.06
MODEL = ROOT / ".bin/blaze_face_short_range.tflite"
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite"
MODEL_SHA = "b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f"
PIXEL_DIFF = 40

if not MODEL.exists():
    MODEL.parent.mkdir(exist_ok=True)
    data = urllib.request.urlopen(MODEL_URL, timeout=60).read()
    if hashlib.sha256(data).hexdigest() != MODEL_SHA:
        sys.exit("Checksum model BlazeFace sai")
    MODEL.write_bytes(data)

detector = vision.FaceDetector.create_from_options(
    vision.FaceDetectorOptions(base_options=BaseOptions(model_asset_path=str(MODEL)), min_detection_confidence=0.6))


def find_face(im: Image.Image):
    w, h = im.size
    x0, y0, x1, y1 = int(w * 0.15), int(h * 0.08), int(w * 0.85), int(h * 0.72)
    crop = np.asarray(im.crop((x0, y0, x1, y1)).resize(((x1 - x0) * 2, (y1 - y0) * 2)))
    found = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(crop))).detections
    if not found:
        return None
    b = max(found, key=lambda d: d.categories[0].score).bounding_box
    bx, by, bw, bh = x0 + b.origin_x / 2, y0 + b.origin_y / 2, b.width / 2, b.height / 2
    # nới: tóc/trán 45%, hai bên 25%, cằm 20%
    return (max(0, int(bx - bw * 0.25)), max(0, int(by - bh * 0.45)), min(w, int(bx + bw * 1.25)), min(h, int(by + bh * 1.2)))


meta = json.loads((QA / "frames.json").read_text(encoding="utf-8"))
fps = meta["fps"]
issues, checked = [], 0
for f in meta["frames"]:
    bare_p, full_p = QA / f"bare-{f:05d}.jpg", QA / f"full-{f:05d}.jpg"
    if not (bare_p.exists() and full_p.exists()):
        continue
    bare = Image.open(bare_p).convert("RGB")
    box = find_face(bare)
    if not box:
        continue
    full = Image.open(full_p).convert("RGB")
    whole = float((np.abs(np.asarray(bare).astype(int) - np.asarray(full).astype(int)).max(axis=2) > PIXEL_DIFF).mean())
    if whole > 0.5:
        continue  # B-roll đang chiếu/đang chuyển vào: thay hẳn người nói là có chủ đích, không phải đè lên mặt
    checked += 1
    a = np.asarray(bare.crop(box)).astype(int)
    b = np.asarray(full.crop(box)).astype(int)
    covered = float((np.abs(a - b).max(axis=2) > PIXEL_DIFF).mean())
    if covered > LIMIT:
        issues.append((f, covered, box, full))

print(f"{checked} khung có mặt người nói được kiểm; {len(issues)} khung bị che (> {LIMIT:.0%} vùng mặt)")
for f, covered, box, _ in issues:
    print(f"  CHE MẶT khung {f} ({f / fps:.2f} s): {covered:.0%} vùng mặt bị lớp phủ đè")
if issues:
    tiles = []
    for f, covered, box, full in issues[:24]:
        im = full.copy()
        ImageDraw.Draw(im).rectangle(box, outline=(255, 0, 0), width=4)
        ImageDraw.Draw(im).text((8, 8), f"{f} ({f / fps:.1f}s) {covered:.0%}", fill=(255, 0, 0))
        tiles.append(im.resize((im.size[0] // 2, im.size[1] // 2)))
    cols = min(6, len(tiles))
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (tiles[0].size[0] * cols, tiles[0].size[1] * rows), (0, 0, 0))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * t.size[0], (i // cols) * t.size[1]))
    out = QA.parent / f"{QA.name}-face.jpg"
    sheet.save(out, quality=80)
    print(f"ảnh lỗi: {out}")
    sys.exit(1)
if checked == 0:
    print("CẢNH BÁO: không khung nào thấy mặt người nói (video toàn B-roll, hoặc dò mặt thất bại); kiểm bằng mắt")
