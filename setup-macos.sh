#!/bin/bash
# Cài talking-head-short-editor trên macOS (Apple Silicon hoặc Intel) bằng Homebrew, rồi chạy scripts/install.py.
# Dùng (trong Terminal, tại thư mục đã giải nén):
#   bash setup-macos.sh [--project-name <tên>] [--skip-project]
# Viết cho bash 3.2 có sẵn trên macOS.
set -euo pipefail
cd "$(dirname "$0")"

fail() { printf '\nCÀI ĐẶT CHƯA HOÀN TẤT: %s\n' "$*" >&2; exit 1; }
trap 'printf "\nCÀI ĐẶT CHƯA HOÀN TẤT ở dòng %s. Xem lỗi phía trên và log: %s\n" "$LINENO" "${log:-}" >&2' ERR

[[ $(uname -s) == Darwin ]] || fail 'Script này chỉ chạy trên macOS.'
for f in SKILL.md scripts/install.py assets/template/package-lock.json; do
  [[ -f $f ]] || fail "Thiếu $f. Hãy giải nén toàn bộ thư mục trước khi chạy setup."
done
log_dir="$HOME/Library/Logs/talking-head-short-editor"
mkdir -p "$log_dir"
log="$log_dir/setup-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$log") 2>&1
echo "Log: $log"

# Homebrew đặt ở /opt/homebrew (Apple Silicon) hoặc /usr/local (Intel); Terminal mới mở có thể chưa có trong PATH.
for prefix in /opt/homebrew /usr/local; do
  [[ -x $prefix/bin/brew ]] && eval "$("$prefix/bin/brew" shellenv)"
done
command -v brew >/dev/null || fail 'Chưa có Homebrew. Cài theo https://brew.sh rồi chạy lại: bash setup-macos.sh'

node_ok() { command -v node >/dev/null && node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; }
missing=()
node_ok || missing+=(node)
command -v ffmpeg >/dev/null || missing+=(ffmpeg)
command -v magick >/dev/null || missing+=(imagemagick)
command -v uv >/dev/null || missing+=(uv)
command -v git >/dev/null || missing+=(git)
if (( ${#missing[@]} )); then
  printf '\n==> Cài bằng Homebrew: %s\n' "${missing[*]}"
  brew install "${missing[@]}"
fi
node_ok || fail 'Cần Node.js 22 trở lên (brew upgrade node, hoặc bỏ bản Node cũ khỏi PATH).'
for tool in node npm npx ffmpeg ffprobe magick uv; do
  command -v "$tool" >/dev/null || fail "Đã cài nhưng chưa thấy lệnh $tool trong PATH."
done

uv run scripts/install.py "$@"

printf '\nCÀI ĐẶT THÀNH CÔNG\nSkill: %s\n' "$HOME/.claude/skills/talking-head-short-editor"
echo 'Cài Claude Code (https://claude.com/claude-code) và đăng nhập; skill nằm trong ~/.claude/skills nên Claude Code tự nhận.'
