#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""So code dùng chung giữa project và assets/template, đưa bản sửa chung về template (hoặc ngược lại).
Dùng: uv run sync-template.py <project>                 liệt kê file lệch (bên nào mới hơn, số dòng khác)
      uv run sync-template.py <project> --pull <file...>   chép từ project về template (bản sửa lỗi chung)
      uv run sync-template.py <project> --push <file...>   chép từ template sang project (project cũ hơn skill)
<file> là đường dẫn tương đối trong project, ví dụ src/talking/sfx.tsx. Chỉ so code khung, không so src/videos, edits, public.
"""
import difflib
import filecmp
import re
import shutil
import sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SKILL / "assets/template/scripts"))
from cross_platform import die  # noqa: E402

TPL = SKILL / "assets/template"
SHARED = ["scripts", "src/talking", "src/components", "src/theme.ts", "src/index.ts", "remotion.config.ts", "tsconfig.json", "package.json"]
# dữ liệu riêng từng project: file edit, registry video, ledger style
SKIP = re.compile(r"^(scripts/edits/|scripts/data/|src/talking/edits/|src/videos/|.*__pycache__)")

if len(sys.argv) < 2:
    die("Thiếu thư mục project")
proj = Path(sys.argv[1]).resolve()
if not proj.is_dir():
    die(f"Không có thư mục {proj}")


def list_files(*roots: Path) -> list[str]:
    found = set()
    for root in roots:
        for p in SHARED:
            path = root / p
            if path.is_dir():
                found |= {f.relative_to(root).as_posix() for f in path.rglob("*") if f.is_file()}
            elif path.is_file():
                found.add(p)
    return sorted(f for f in found if not SKIP.match(f))


def copy(src: Path, dst: Path, files: list[str]):
    if not files:
        die("Thiếu danh sách file")
    for f in files:
        if not (src / f).is_file():
            die(f"Không có {src / f}")
        (dst / f).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src / f, dst / f)
        print(f"đã chép {f}")


flag = sys.argv[2] if len(sys.argv) > 2 else ""
if flag == "--pull":
    copy(proj, TPL, sys.argv[3:]); sys.exit(0)
if flag == "--push":
    copy(TPL, proj, sys.argv[3:]); sys.exit(0)
if flag:
    die(f"Cờ không hợp lệ: {flag}")

drift = False
for f in list_files(TPL, proj):
    a, b = TPL / f, proj / f
    if not a.is_file():
        print(f"chỉ có ở project   {f}"); drift = True
    elif not b.is_file():
        print(f"chỉ có ở template  {f}"); drift = True
    elif not filecmp.cmp(a, b, shallow=False):
        la = a.read_text(encoding="utf-8", errors="replace").splitlines()
        lb = b.read_text(encoding="utf-8", errors="replace").splitlines()
        n = sum(1 for l in difflib.ndiff(la, lb) if l[:1] in "+-")
        side = "project mới hơn " if b.stat().st_mtime > a.stat().st_mtime else "template mới hơn"
        print(f"{side}  {f}  ({n} dòng khác)"); drift = True
if not drift:
    print("Template và project khớp nhau.")
