"""Dò kho Mixkit theo từ khóa (tiếng Anh, gạch nối) để chọn B-roll hoặc SFX.

Dùng: uv run python scripts/mixkit-scout.py video kitchen washing-dishes seoul
      uv run python scripts/mixkit-scout.py sfx whoosh pop cash-register
In "mã:tên" từng mục. Video: tải bằng fetch-mixkit-broll.py <mã>; xem trước bằng mixkit-thumbs.py.
SFX: thêm "tên-gọi": mã vào src/talking/sfx-library.json rồi chạy fetch-mixkit-sfx.py.
"""
import html
import re
import sys
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 Chrome/141"}
kind, terms = sys.argv[1], sys.argv[2:]
base = {"video": "https://mixkit.co/free-stock-video/{}/", "sfx": "https://mixkit.co/free-sound-effects/{}/"}[kind]
for term in terms:
    try:
        page = urllib.request.urlopen(urllib.request.Request(base.format(term), headers=UA), timeout=30).read().decode()
    except Exception as exc:  # trang không tồn tại với từ khóa này
        print(f"== {term}: lỗi {exc}")
        continue
    items = []
    if kind == "video":
        for slug, vid in re.findall(r'href="/free-stock-video/([a-z0-9-]+)-(\d+)/"', page):
            if vid not in [i[0] for i in items]:
                items.append((vid, slug))
    else:
        for card in page.split('item-grid__item"')[1:]:
            m = re.search(r'item-id-value="(\d+)"', card)
            t = re.search(r'item-grid-card__title[^>]*>\s*([^<]+)<', card)
            d = re.search(r'(\d+:\d\d)', card)
            if m:
                items.append((m.group(1), f"{html.unescape(t.group(1).strip()) if t else '?'} ({d.group(1) if d else ''})"))
    print(f"== {term} ({len(items)})")
    print("  " + " | ".join(f"{i}:{n[:48]}" for i, n in items[:30]))
