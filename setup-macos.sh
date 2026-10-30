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

node_version() {
  local version
  command -v node >/dev/null || return 1
  version=$(node --version 2>/dev/null) || return 1
  [[ $version =~ ^v([0-9]+)\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]] || return 1
  printf '%s\n' "$version"
}
node_ok() {
  local version
  version=$(node_version) || return 1
  version=${version#v}
  (( ${version%%.*} >= 22 ))
}
ensure_node() {
  local version node_prefix
  if node_ok; then
    printf 'Đã có Node.js %s (>= 22), giữ nguyên.\n' "$(node_version)"
    return
  fi
  version=$(node_version || true)
  if command -v node >/dev/null; then
    printf '\n==> Cập nhật Node.js %s lên bản mới (cần >= 22)\n' "$version"
  else
    printf '\n==> Chưa có Node.js. Cài bản mới (cần >= 22)\n'
  fi
  if brew list --versions node >/dev/null 2>&1; then
    brew upgrade node
  else
    brew install node
  fi
  # Use the upgraded Homebrew Node even when an old portable/version-managed Node is first in PATH.
  node_prefix=$(brew --prefix node)
  export PATH="$node_prefix/bin:$PATH"
  hash -r
  node_ok || fail "Đã thử cài/cập nhật nhưng chưa chạy được Node.js >= 22 (hiện tại: $(node_version || true)). Xem log và kiểm tra PATH/trình quản lý phiên bản Node.js."
  printf 'Node.js sẵn sàng: %s\n' "$(node_version)"
}

# Preserve an already compatible Node when Homebrew's shellenv changes PATH.
node_directory=''
if node_ok; then node_directory=$(dirname "$(command -v node)"); fi
# Homebrew đặt ở /opt/homebrew (Apple Silicon) hoặc /usr/local (Intel); Terminal mới mở có thể chưa có trong PATH.
for prefix in /opt/homebrew /usr/local; do
  [[ -x $prefix/bin/brew ]] && eval "$("$prefix/bin/brew" shellenv)"
done
command -v brew >/dev/null || fail 'Chưa có Homebrew. Cài theo https://brew.sh rồi chạy lại: bash setup-macos.sh'
if [[ -n $node_directory ]]; then export PATH="$node_directory:$PATH"; fi

ensure_node
missing=()
command -v ffmpeg >/dev/null || missing+=(ffmpeg)
command -v magick >/dev/null || missing+=(imagemagick)
command -v uv >/dev/null || missing+=(uv)
command -v git >/dev/null || missing+=(git)
if (( ${#missing[@]} )); then
  printf '\n==> Cài bằng Homebrew: %s\n' "${missing[*]}"
  brew install "${missing[@]}"
fi
for tool in node npm npx ffmpeg ffprobe magick uv; do
  command -v "$tool" >/dev/null || fail "Đã cài nhưng chưa thấy lệnh $tool trong PATH."
done

uv run scripts/install.py "$@"

printf '\nCÀI ĐẶT THÀNH CÔNG\nSkill: %s\n' "$HOME/.claude/skills/talking-head-short-editor"
echo 'Cài Claude Code (https://claude.com/claude-code) và đăng nhập; skill nằm trong ~/.claude/skills nên Claude Code tự nhận.'
