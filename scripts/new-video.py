#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Bắt đầu một video mới trong project: chuẩn bị footage, chép lời, dựng khung EDL/phụ đề, tạo file video, đăng ký composition.
Dùng: uv run <skill>/scripts/new-video.py <project> <file-quay.mp4> <slug> [style]
  slug: chữ thường, gạch nối (vd ngoai-ngu-lam-them). Không ghi style → chọn style lâu chưa dùng nhất (.style-ledger).
"""
import datetime
import json
import math
import os
import re
import subprocess
import sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SKILL / "assets/template/scripts"))
from cross_platform import die, duration, output, run, this_python, uv_python, venv_cmd  # noqa: E402

if len(sys.argv) not in (4, 5):
    die("Dùng: uv run new-video.py <project> <file-quay.mp4> <slug> [style]")
project, src, slug = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve(), sys.argv[3]
style = sys.argv[4] if len(sys.argv) == 5 else ""
if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", slug):
    die("slug phải là chữ thường và gạch nối")
if not src.is_file():
    die(f"Không có file nguồn: {src}")
for required in ("package.json", "src/talking/style.tsx", "src/videos/registry.tsx"):
    if not (project / required).is_file():
        die(f"Project thiếu {required}: {project}")
os.chdir(project)
if Path(f"src/videos/{slug}").exists():
    die(f"Video {slug} đã tồn tại")

# khóa của khối STYLES trong style.tsx (không lẫn với các trường của kiểu StyleSpec)
style_src = Path("src/talking/style.tsx").read_text(encoding="utf-8")
block = style_src[style_src.index("const STYLES = {"):style_src.index("} satisfies")]
styles = re.findall(r"^  '?([a-z][a-z0-9-]*)'?: \{$", block, re.M)
if not styles:
    die("Không đọc được danh sách style trong src/talking/style.tsx")
registry = Path("src/videos/registry.tsx")
registry_source = registry.read_text(encoding="utf-8")
import_marker = re.compile(r"^([ \t]*)// @imports[ \t]*$", re.M)
entry_marker = re.compile(r"^([ \t]*)// @entries[ \t]*$", re.M)
if len(import_marker.findall(registry_source)) != 1 or len(entry_marker.findall(registry_source)) != 1:
    die("Registry phải có đúng một mốc // @imports và // @entries")
pascal = "".join(p.capitalize() for p in slug.split("-"))
if pascal[0].isdigit():
    pascal = "Video" + pascal
const = ("VIDEO_" if slug[0].isdigit() else "") + slug.upper().replace("-", "_") + "_DATA"
if re.search(rf"\bid:\s*['\"]{re.escape(pascal)}['\"]", registry_source):
    die(f"Composition ID {pascal} đã tồn tại; chọn slug khác")
ledger = Path(".style-ledger")
if not style:
    # style lâu chưa dùng nhất; chưa dùng bao giờ thì ưu tiên theo thứ tự khai báo
    used = {}
    if ledger.exists():
        for i, line in enumerate(ledger.read_text(encoding="utf-8").splitlines()):
            parts = line.split()
            if len(parts) >= 2:
                used[parts[1]] = i
    style = min(styles, key=lambda s: used.get(s, -1))
if style not in styles:
    die(f"Style không có: {style} (có: {' '.join(styles)})")
print(f"Style tạm: {style} — PHẢI tạo style mới hợp nội dung cho video này (references/style-presets.md), cổng: scripts/check-style-novelty.py {slug}")

run(this_python("scripts/prepare-talking-footage.py", src, slug))
transcript = output(venv_cmd(".venv-align", "scripts/transcribe-source.py", slug))
print("\n".join(transcript.splitlines()[-40:]))
dur = duration(f"public/footage/{slug}-voice.wav")
if not math.isfinite(dur) or dur < 1 / 30:
    die("Nguồn giọng quá ngắn hoặc thời lượng không hợp lệ")
# khung EDL tạm: giữ toàn bộ; sau đó sửa sections/cues theo references/edit-workflow.md
cfg = {
    "transcript": f"scripts/data/{slug}-transcript.json",
    "sections": [["body", 0.0, max(1 / 30, round(dur - 0.2, 2)), "tạm: toàn bộ; thay bằng cold open + question + các ý"]],
    "cues": {},
    "zoom": {"tight": ["cold"], "wide": ["question"], "push": []},
    "captions": {"vocab": "", "fixes": {}, "dropAtSentenceStart": [], "emphasis": []},
}
Path("scripts/edits").mkdir(parents=True, exist_ok=True)
Path(f"scripts/edits/{slug}.json").write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
Path("src/talking/edits").mkdir(parents=True, exist_ok=True)
built = output(uv_python("scripts/build-talking-edit.py", slug, deps=["numpy"]))
print(built.splitlines()[0] if built else "")
run(venv_cmd(".venv-align", "scripts/caption-talking-edit.py", slug), stdout=subprocess.DEVNULL)

Path(f"src/videos/{slug}").mkdir(parents=True)
tpl = (SKILL / "assets/video-template.tsx").read_text(encoding="utf-8")
tpl = tpl.replace("__SLUG__", slug).replace("__CONST__", const).replace("__COMPONENT__", f"{pascal}Short")
Path(f"src/videos/{slug}/{slug}-short.tsx").write_text(tpl, encoding="utf-8", newline="\n")
s = registry_source
s = import_marker.sub(lambda m: f"import {{{const}, {pascal}Short}} from './{slug}/{slug}-short';\n{m.group(0)}", s)
s = entry_marker.sub(lambda m: f"{m.group(1)}{{id: '{pascal}', component: {pascal}Short, data: {const}, style: '{style}'}},\n{m.group(0)}", s)
registry.write_text(s, encoding="utf-8", newline="\n")
with ledger.open("a", encoding="utf-8", newline="\n") as f:
    f.write(f"{slug} {style} {datetime.date.today().isoformat()}\n")
run(["npx", "--no-install", "tsc", "--noEmit"])
print(f"Composition: {pascal} — style TẠM {style} (tạo style mới trước khi render; check-style-novelty.py {slug} phải ĐẠT). "
      f"Tiếp theo: measure-voice-noise.py {slug}, sửa scripts/edits/{slug}.json và src/videos/{slug}/{slug}-short.tsx")
