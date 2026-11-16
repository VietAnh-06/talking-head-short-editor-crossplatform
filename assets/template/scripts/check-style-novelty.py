#!/usr/bin/env python3
"""Cổng bắt buộc trước khi render: video phải mang một style MỚI, không chỉ xoay vòng style có sẵn.

Dùng: uv run --with numpy python scripts/check-style-novelty.py <slug>
FAIL (thoát mã 1) khi:
  1. style của video đã được video khác trong registry dùng;
  2. style khác style của MỘT trong HISTORY video gần nhất dưới MIN_DIFF trục (caption, broll, transition, headline,
     nhạc, font, màu nhấn);
  3. không có kiểu hình nào (broll/transition/headline) mới, tức chưa style nào khác dùng: chỉ đổi màu thì người xem vẫn
     thấy cùng khuôn;
  4. bộ khung (nền + chỗ đặt hình, suy từ bố cục B-roll) trùng video liền trước: người dùng thấy video 2 "styled giống
     video trước" dù khác 7/7 tên trục, vì cả hai đều là nền B-roll mờ + thẻ giấy ở giữa + phụ đề dưới (21/10/2026);
  5. dùng lại clip B-roll của video liền trước;
  6. clip chưa gắn nhãn trong public/broll/people-tags.jsonl hoặc không khớp allowedPeople khi brief có cấu hình;
  7. khung B-roll của bố cục nhỏ hơn MIN_BROLL_AREA diện tích khung dọc 1080×1920: clip Mixkit gần hết là 16:9 nên khung nhỏ
     làm hình minh họa bé tí (video 3–5 chỉ ~21%, người dùng chê 22/10/2026). Khung lớn thì cắt clip 16:9 sát chủ thể bằng
     focusX; ưu tiên clip dọc (dò Mixkit `vertical-<từ khóa>`).
CẢNH BÁO (không chặn) về nhịp trong chính video: độ dài cảnh B-roll quá đều (hệ số biến thiên < 0,2), cảnh B-roll > 5 s,
một tiếng SFX viết cứng trong file video/overlays dùng > 2 lần.
Chính sách .style-policy.json: requireNewStyle=false cho phép giữ nhận diện; allowedPeople mặc định null không lọc thị trường.
Khai báo variants={"clip-12-vieneu":"clip-12"} để bản giọng máy được dùng style gốc; tiền tố slug không xác định quan hệ.
"""
import json
import re
import statistics
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if len(sys.argv) != 2 or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", sys.argv[1]):
    sys.exit("Dùng: uv run scripts/check-style-novelty.py <slug>")
SLUG = sys.argv[1]
policy_path = ROOT / ".style-policy.json"
try:
    policy = json.loads(policy_path.read_text(encoding="utf-8")) if policy_path.exists() else {}
    if not isinstance(policy, dict) or set(policy) - {"requireNewStyle", "allowedPeople", "variants"}:
        raise ValueError("chỉ hỗ trợ requireNewStyle, allowedPeople và variants")
    require_new_style = policy.get("requireNewStyle", True)
    allowed_people = policy.get("allowedPeople")
    variants = policy.get("variants", {})
    if not isinstance(require_new_style, bool):
        raise ValueError("requireNewStyle phải là boolean")
    if allowed_people is not None and (not isinstance(allowed_people, list)
                                       or not all(isinstance(p, str) for p in allowed_people)):
        raise ValueError("allowedPeople phải là danh sách nhãn hoặc null")
    if not isinstance(variants, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in variants.items()):
        raise ValueError("variants phải là ánh xạ slug phiên bản → slug gốc")
except (OSError, ValueError) as error:
    sys.exit(f"{policy_path.name} không hợp lệ: {error}")
MIN_DIFF = 4
HISTORY = 3
AXES = ("caption", "broll", "transition", "headline", "music", "fonts", "accent")
KINDS = ("broll", "transition", "headline")
# bộ khung màn hình theo bố cục B-roll: (nền, chỗ đặt hình, vùng phụ đề); thêm bố cục mới thì thêm dòng ở đây
SKELETON = {
    "card": ("nền B-roll mờ tối", "thẻ giữa", "dưới"), "polaroid": ("nền B-roll mờ tối", "thẻ giữa", "dưới"),
    "ticket": ("nền B-roll mờ tối", "thẻ giữa", "dưới"), "receipt": ("nền B-roll mờ tối", "thẻ giữa", "dưới"),
    "omr": ("nền B-roll mờ tối", "thẻ giữa", "dưới"), "envelope": ("nền B-roll mờ tối", "thẻ giữa", "dưới"),
    "fullbleed": ("video tràn khung", "tràn khung", "dưới"), "split": ("chia đôi", "nửa trên", "đường nối"),
    "passbook": ("trang giấy sáng", "dải ngang trên", "giữa trang"), "phone": ("giao diện app sáng", "bài đăng trong app", "bong bóng chat"),
    "film": ("nền đen đặc", "dải phim giữa", "dưới dải phim"),
    "dossier": ("bìa kraft + tờ hồ sơ sáng", "ảnh kẹp ghim nửa dưới", "giữa trang trên ảnh"),
    "storefront": ("mặt tiền cửa hàng đêm, mái hiên sọc", "ô kính tràn bề ngang giữa trên", "vỉa hè dưới ô kính"),
    "tray": ("khay cơm inox sáng trên bàn gỗ", "ngăn lớn của khay sát mép trên", "thép khay dưới ngăn dài"),
    "payslip": ("phiếu lương sáng trên bàn tối", "ô chi tiết giữa trên tờ", "dòng phiếu dưới ô"),
    "console": ("tủ điện thép tối", "màn hình giám sát nửa dưới", "dải công tắc phía trên"),
    "lightbox": ("thảm cắt xanh kẻ ô", "hộp đèn soi giữa trang", "tab hồ sơ phía trên"),
    "citation": ("biên bản giấy than vàng nhạt", "ảnh hiện trường tràn mép trên", "ô điền biên bản dưới ảnh"),
    "track": ("đường chạy tartan đỏ cam", "dải ảnh tràn ngang giữa trang", "số áo thi đấu phía trên"),
    "platform": ("tường gạch men ga tàu điện sáng", "cửa kính chắn tàu nửa trên", "bảng giờ tàu lật chữ dưới cửa"),
}

# diện tích khung B-roll (rộng × cao của ô hiện clip) / (1080 × 1920); thêm bố cục mới thì đo và thêm dòng ở đây
BROLL_AREA = {
    "card": 0.36, "polaroid": 0.26, "ticket": 0.28, "receipt": 0.21, "omr": 0.23, "envelope": 0.20,
    "fullbleed": 1.0, "split": 0.52, "passbook": 0.31, "phone": 0.21, "film": 0.21, "dossier": 0.22,
    "storefront": 0.49, "tray": 0.46, "payslip": 0.45, "console": 0.45,
    "lightbox": 0.455,
    "citation": 0.469,
    "track": 0.49,
    "platform": 0.454,
}
MIN_BROLL_AREA = 0.45
style_src = (ROOT / "src/talking/style.tsx").read_text(encoding="utf-8")
block = style_src[style_src.index("const STYLES = {"): style_src.index("} satisfies")]
heads = list(re.finditer(r"^  '?([a-z][a-z0-9-]*)'?: \{$", block, re.M))
styles: dict[str, dict[str, str]] = {}
for i, h in enumerate(heads):
    body = block[h.end(): heads[i + 1].start() if i + 1 < len(heads) else len(block)]
    spec = {k: (re.search(rf"\b{k}: '([^']+)'", body) or [None, ""])[1] for k in ("caption", "broll", "transition", "headline", "music")}
    spec["accent"] = (re.search(r"\baccent: '([^']+)'", body) or [None, ""])[1].lower()
    styles[h.group(1)] = spec

loaders = style_src[style_src.index("const FONT_LOADERS"):]
for h in heads:
    key = h.group(1)
    m = re.search(rf"^  '?{re.escape(key)}'?: \(\) => (.*?)(?=^  '?[a-z][a-z0-9-]*'?: \(\) =>|^\}};)", loaders, re.M | re.S)
    styles[key]["fonts"] = ",".join(sorted(set(re.findall(r"\b(load[A-Za-z0-9]+|BE_VIETNAM)\b", m.group(1))))) if m else ""

registry = (ROOT / "src/videos/registry.tsx").read_text(encoding="utf-8")
const_to_slug = {c: s for c, s in re.findall(r"import \{(\w+)(?:, \w+)+\} from '\./([a-z0-9-]+)/", registry)}
entries = [(const_to_slug.get(d, d), st) for d, st in re.findall(r"data: (\w+), style: '([a-z0-9-]+)'", registry)]
order = [s for s, _ in entries]
if SLUG not in order:
    sys.exit(f"Không thấy {SLUG} trong src/videos/registry.tsx")
mine = dict(entries)[SLUG]
if mine not in styles:
    sys.exit(f"Style {mine} của {SLUG} không có trong STYLES")

fails: list[str] = []
def same_video(a: str, b: str) -> bool:
    return variants.get(a, a) == variants.get(b, b)


shared = [s for s, st in entries if st == mine and s != SLUG and not same_video(s, SLUG)]
if shared and require_new_style:
    fails.append(f"style '{mine}' đã dùng cho {', '.join(shared)}: tạo style mới cho {SLUG}")

idx = order.index(SLUG)
history = [(s, st) for s, st in entries[:idx] if not same_video(s, SLUG)][-HISTORY:]
for prev_slug, prev_style in history:
    if prev_style == mine:
        continue  # đã báo ở luật 1
    a, b = styles[mine], styles[prev_style]
    same = [k for k in AXES if a[k] and a[k] == b[k]]
    diff = len(AXES) - len(same)
    print(f"so với {prev_slug} ({prev_style}): khác {diff}/{len(AXES)} trục" + (f", trùng: {', '.join(same)}" if same else ""))
    if diff < MIN_DIFF and require_new_style:
        fails.append(f"chỉ khác {diff} trục với {prev_slug} (cần ≥ {MIN_DIFF} với mỗi video trong {HISTORY} video gần nhất)")

prev_all = [(s_, st) for s_, st in entries[:idx] if not same_video(s_, SLUG)]
if prev_all:
    last_slug, last_style = prev_all[-1]
    ka, kb = SKELETON.get(styles[mine]["broll"]), SKELETON.get(styles[last_style]["broll"])
    print(f"bộ khung: {' / '.join(ka) if ka else '?'} (video trước {last_slug}: {' / '.join(kb) if kb else '?'})")
    if ka is None:
        fails.append(f"bố cục '{styles[mine]['broll']}' chưa có trong SKELETON: khai báo nền / chỗ đặt hình / vùng phụ đề")
    elif kb and ka[:2] == kb[:2] and require_new_style:
        fails.append(f"bộ khung trùng {last_slug} ({ka[0]} + {ka[1]}): đổi nền hoặc chỗ đặt hình, không chỉ đổi lớp trang trí")

    def clips(slug: str) -> set[str]:
        src = "\n".join(p.read_text(encoding="utf-8") for p in sorted((ROOT / f"src/videos/{slug}").glob("*.tsx")))
        return set(re.findall(r"clip: '([^']+)'", src))

    reused = sorted(clips(SLUG) & clips(last_slug))
    if reused and require_new_style:
        fails.append(f"dùng lại clip B-roll của {last_slug}: {', '.join(reused)}")

others = [v for k, v in styles.items() if k != mine]  # kiểu mới tính theo style, nên bản phiên bản dùng chung vẫn đạt
new_kinds = [f"{k}={styles[mine][k]}" for k in KINDS if all(o[k] != styles[mine][k] for o in others)]
print(f"kiểu hình mới (chưa style nào khác dùng): {', '.join(new_kinds) or 'không có'}")
if not new_kinds and require_new_style:
    fails.append("không có kiểu B-roll/chuyển cảnh/tiêu đề mới: viết ít nhất một kiểu mới trong broll.tsx")

area = BROLL_AREA.get(styles[mine]["broll"])
print(f"khung B-roll: {f'{area:.0%}' if area is not None else '?'} diện tích khung (tối thiểu {MIN_BROLL_AREA:.0%})")
if area is None:
    fails.append(f"bố cục '{styles[mine]['broll']}' chưa có trong BROLL_AREA: đo rộng × cao ô hiện clip rồi khai báo")
elif area < MIN_BROLL_AREA:
    fails.append(f"khung B-roll chỉ {area:.0%} khung hình (< {MIN_BROLL_AREA:.0%}): clip 16:9 bị thu bé; làm khung ≥ 1080×860, cắt sát chủ thể bằng focusX")

TAGS = ROOT / "public/broll/people-tags.jsonl"
tags = {}
if TAGS.exists():
    for line in TAGS.read_text(encoding="utf-8").splitlines():
        if line.strip():
            t = json.loads(line)
            tags[t["id"]] = t
used = sorted(set(re.findall(r"clip: '([^']+)'", "\n".join(p.read_text(encoding="utf-8") for p in sorted((ROOT / f"src/videos/{SLUG}").glob("*.tsx"))))))
ids = {c: re.sub(r"\D", "", c) for c in used}
untagged = [c for c in used if ids[c] not in tags]
outside_market = [f"{c} ({tags[ids[c]].get('desc', '')})" for c in used
                  if allowed_people is not None and ids[c] in tags and tags[ids[c]].get("faces")
                  and tags[ids[c]].get("people") not in allowed_people]
asian = sum(1 for c in used if tags.get(ids[c], {}).get("people") == "asian")
print(f"người trong B-roll: {asian}/{len(used)} clip có người châu Á")


def is_vertical(clip: str) -> bool:
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0",
                          str(ROOT / f"public/broll/{clip}.mp4")], capture_output=True, text=True).stdout.strip().split(",")
    return len(out) == 2 and int(out[1]) > int(out[0])


print(f"clip dọc: {sum(map(is_vertical, used))}/{len(used)} (ưu tiên clip dọc: dò Mixkit `vertical-<từ khóa>`)")
if untagged:
    fails.append(f"clip chưa gắn nhãn người trong {TAGS.name}: {', '.join(untagged)}")
if outside_market:
    fails.append("clip không khớp allowedPeople của brief hiện tại: " + "; ".join(outside_market))

# --- nhịp trong chính video (cảnh báo, không chặn) ---
warns: list[str] = []
code = "\n".join(p.read_text(encoding="utf-8") for p in sorted((ROOT / f"src/videos/{SLUG}").glob("*.tsx")))
# focusX tính theo % bề ngang clip (0–100); ghi kiểu 0–1 thì chủ thể bị dồn sát mép trái
bad_focus = [v for v in re.findall(r"focusX: ([0-9.]+)", code) if float(v) < 1.5]
if bad_focus:
    fails.append(f"focusX {', '.join(bad_focus)} trông như thang 0–1; focusX là phần trăm 0–100 (50 = giữa)")
edit_path = ROOT / f"src/talking/edits/{SLUG}.json"
if edit_path.exists() and "BEATS" in code:
    edit = json.loads(edit_path.read_text(encoding="utf-8"))

    def norm(t: str) -> str:
        return re.sub(r"[.,?!:]", "", t.lower())

    words = [(norm(w["text"]), w["start"]) for w in edit.get("captions", [])]
    speech_end = max((c["at"] + c["srcOut"] - c["srcIn"] for c in edit["clips"]), default=0.0)

    def find(phrase: str, after: float):
        # giống findPhrase trong edit-data.tsx: cụm chữ thường, bỏ dấu câu, tìm từ sau mốc
        toks = [norm(t) for t in phrase.split(" ")]
        for i in range(len(words) - len(toks) + 1):
            if words[i][1] >= after - 0.01 and all(words[i + k][0] == t for k, t in enumerate(toks)):
                return words[i][1]
        return None

    start = code.find("BEATS")
    beats_src = code[start: code.find("];", start)]
    beats, cursor = [], 0.0
    for spec in re.findall(r"\{[^{}]*kind: '(?:talk|broll)'[^{}]*\}", beats_src):
        kind = re.search(r"kind: '(\w+)'", spec).group(1)
        m_sec, m_at, m_after = re.search(r"atSec: ([\d.]+)", spec), re.search(r"\bat: '([^']+)'", spec), re.search(r"after: ([\d.]+)", spec)
        m_cue = re.search(r"atSec: \w+\.cue\('([^']+)'\) / 30", spec)  # nhịp neo đúng mốc đoạn: atSec: DATA.cue('cta') / 30
        if m_cue and m_cue.group(1) in edit.get("cues", {}):
            t = float(edit["cues"][m_cue.group(1)])
        elif m_sec:
            t = float(m_sec.group(1))
        else:
            found = find(m_at.group(1), float(m_after.group(1)) if m_after else cursor) if m_at else None
            if found is None:
                warns.append(f"không dò được cụm {m_at.group(1) if m_at else spec[:40]!r} trong phụ đề")
                continue
            t = max(0.0, found - 0.12)
        cursor = max(cursor, t + 0.05)
        beats.append((t, kind))
    broll = [(t, (beats[i + 1][0] if i + 1 < len(beats) else speech_end) - t) for i, (t, k) in enumerate(beats) if k == "broll"]
    durs = [d for _, d in broll]
    if len(durs) >= 4:
        cv = statistics.pstdev(durs) / max(1e-6, statistics.mean(durs))
        print(f"B-roll: {len(durs)} cảnh, {statistics.mean(durs):.1f} ± {statistics.pstdev(durs):.1f} s (hệ số biến thiên {cv:.2f})")
        if cv < 0.2:
            warns.append(f"độ dài cảnh B-roll quá đều (hệ số biến thiên {cv:.2f} < 0,2): xen cảnh nhanh 1–1,5 s với cảnh dài 3–4 s")
    long = [f"{t:.1f} s ({d:.1f} s)" for t, d in broll if d > 5]
    if long:
        warns.append(f"cảnh B-roll dài > 5 s ở {', '.join(long)}: hình đứng lâu, tách thành 2 cảnh hoặc thêm đồ họa")

names = re.findall(r"(?:hit|sfx|name)[=:] ?['\"]([a-z][a-z0-9-]+)['\"]", code)
over = [f"{n}×{c}" for n, c in Counter(names).items() if c > 2]
if over:
    warns.append(f"SFX viết cứng lặp quá 2 lần: {', '.join(over)}")
for w in warns:
    print(f"CẢNH BÁO: {w}")

if fails:
    print(f"FAIL {SLUG} ({mine}):\n  - " + "\n  - ".join(fails))
    sys.exit(1)
print(f"ĐẠT {SLUG}: style '{mine}' " + ("đạt yêu cầu phong cách mới" if require_new_style else "đạt chính sách giữ nhận diện"))
