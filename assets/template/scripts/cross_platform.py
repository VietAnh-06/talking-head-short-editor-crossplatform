"""Hàm dùng chung cho các script chạy được trên Windows, macOS và Linux (thay cho các script Bash cũ).

- Gọi công cụ ngoài qua đường dẫn đầy đủ (npm/npx trên Windows là file .cmd, subprocess không tự tìm).
- Python trong venv: .venv-x/Scripts/python.exe (Windows) hoặc .venv-x/bin/python; luôn thêm -X utf8 vì console
  Windows mặc định cp1252 làm print tiếng Việt lỗi, và -I bỏ qua biến môi trường PYTHONUTF8.
- Lệnh con lỗi thì thoát với đúng mã lỗi của nó, giống `set -e` của Bash.
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path

IS_WINDOWS = os.name == "nt"
PY_FLAGS = ["-X", "utf8"]

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")


def die(msg: str, code: int = 1):
    print(msg, file=sys.stderr, flush=True)
    raise SystemExit(code)


def tool(name: str) -> str:
    path = shutil.which(name)
    if not path:
        die(f"Thiếu công cụ: {name}")
    return path


def _resolve(cmd) -> list[str]:
    cmd = [str(c) for c in cmd]
    if not os.path.dirname(cmd[0]):
        cmd[0] = tool(cmd[0])
    return cmd


def run(cmd, check: bool = True, **kw) -> subprocess.CompletedProcess:
    """Chạy lệnh; lỗi thì thoát với mã lỗi của lệnh (check=False để tự xử lý)."""
    sys.stdout.flush()
    proc = subprocess.run(_resolve(cmd), **kw)
    if check and proc.returncode != 0:
        if kw.get("capture_output") and proc.stderr:
            err = proc.stderr if isinstance(proc.stderr, str) else proc.stderr.decode("utf-8", "replace")
            print(err, end="", file=sys.stderr)
        raise SystemExit(proc.returncode)
    return proc


def output(cmd, **kw) -> str:
    """stdout của lệnh dạng chuỗi (UTF-8)."""
    return run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", **kw).stdout


def popen(cmd, **kw) -> subprocess.Popen:
    sys.stdout.flush()
    return subprocess.Popen(_resolve(cmd), **kw)


def venv_python(venv: str | Path) -> Path:
    venv = Path(venv)
    return venv / "Scripts" / "python.exe" if IS_WINDOWS else venv / "bin" / "python"


def venv_cmd(venv: str | Path, *args, isolated: bool = False) -> list[str]:
    """Lệnh chạy Python trong venv: [python, -X, utf8, (-I), *args]."""
    return [str(venv_python(venv)), *PY_FLAGS, *(["-I"] if isolated else []), *map(str, args)]


def uv_python(*args, deps=()) -> list[str]:
    """`uv run -q --with <dep>... python -X utf8 <args>`: môi trường tạm cho script chỉ cần numpy/scipy."""
    cmd = ["uv", "run", "-q"]
    for d in deps:
        cmd += ["--with", d]
    return [*cmd, "python", *PY_FLAGS, *map(str, args)]


def this_python(*args) -> list[str]:
    """Python đang chạy script này (script chỉ dùng thư viện chuẩn)."""
    return [sys.executable, *PY_FLAGS, *map(str, args)]


def duration(path) -> float:
    return float(output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).strip())


def project_root(script_file: str) -> Path:
    """Thư mục project (cha của scripts/) và chuyển cwd về đó, như `cd "$(dirname "$0")/.."`."""
    root = Path(script_file).resolve().parent.parent
    os.chdir(root)
    return root
