#!/usr/bin/env bash
set -euo pipefail

REPO_DEFAULT="ratacat/liquid-mail"
REF_DEFAULT="main"

BIN_DIR_DEFAULT="${HOME}/.local/bin"
CONFIG_PATH_DEFAULT="${HOME}/.liquid-mail.toml"

usage() {
  cat <<'EOF'
liquid-mail installer

Usage:
  ./install.sh [options]

Options:
  --repo <owner/repo>      GitHub repo (default: ratacat/liquid-mail)
  --ref <git-ref>          Git ref for source builds (default: main)
  --bin-dir <dir>          Install directory (default: ~/.local/bin)
  --config-path <path>     Config path (default: repo-root/.liquid-mail.toml or ~/.liquid-mail.toml)
  --integrate <target>     Project-level integration (claude|codex|opencode)
  --window-env             Always print per-window env snippet (default: auto-detect; print only if missing)
  --no-window-env          Skip printing per-window env snippet
  --no-config              Do not create a config template
  --no-release             Skip release download attempt (build from source)
  -h, --help               Show help

Environment:
  LIQUID_MAIL_HONCHO_API_KEY, LIQUID_MAIL_HONCHO_WORKSPACE_ID (or HONCHO_API_KEY, HONCHO_WORKSPACE_ID) can be used instead of a config file.
EOF
}

say() {
  printf '%s\n' "$*"
}

die() {
  say "error: $*"
  exit 1
}

need_cmd() {
  local name="$1"
  command -v "$name" >/dev/null 2>&1 || die "Missing required command: ${name}"
}

downloader() {
  if command -v curl >/dev/null 2>&1; then
    echo "curl"
    return 0
  fi
  if command -v wget >/dev/null 2>&1; then
    echo "wget"
    return 0
  fi
  return 1
}

download_to() {
  local url="$1"
  local out="$2"
  local dl
  dl="$(downloader)" || return 1

  if [[ "$dl" == "curl" ]]; then
    curl -fsSL "$url" -o "$out"
  else
    wget -qO "$out" "$url"
  fi
}

detect_platform() {
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"

  case "$os" in
    darwin) os="darwin" ;;
    linux) os="linux" ;;
    *) die "Unsupported OS: $os" ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) die "Unsupported arch: $arch" ;;
  esac

  printf '%s %s\n' "$os" "$arch"
}

init_colors() {
  if [[ -t 1 ]]; then
    C_CYAN=$'\033[36m'
    C_DIM=$'\033[2m'
    C_RESET=$'\033[0m'
  else
    C_CYAN=''
    C_DIM=''
    C_RESET=''
  fi
}

window_env_rc_files() {
  local shell_name
  shell_name="$(basename "${SHELL:-}")"

  case "$shell_name" in
    zsh)
      printf '%s\n' "${HOME}/.zshrc"
      ;;
    bash)
      printf '%s\n' "${HOME}/.bashrc"
      printf '%s\n' "${HOME}/.bash_profile"
      ;;
    *)
      printf '%s\n' "${HOME}/.zshrc"
      printf '%s\n' "${HOME}/.bashrc"
      ;;
  esac
}

has_window_env_snippet() {
  local file="$1"
  [[ -f "$file" ]] || return 1

  # New marker (preferred).
  grep -qF 'BEGIN LIQUID MAIL WINDOW ENV' "$file" && return 0
  # Old marker.
  grep -qF 'Liquid Mail window env' "$file" && return 0

  return 1
}

detect_window_env_file() {
  local file
  for file in "$@"; do
    if has_window_env_snippet "$file"; then
      printf '%s\n' "$file"
      return 0
    fi
  done
  return 1
}

project_root() {
  if command -v git >/dev/null 2>&1; then
    git rev-parse --show-toplevel 2>/dev/null || true
  fi
}

ensure_bun() {
  if command -v bun >/dev/null 2>&1; then
    return 0
  fi

say "bun not found; installing bun (https://bun.sh)..."

  local tmp
  tmp="$(mktemp -d)"
  (
    cd "$tmp"
    download_to "https://bun.sh/install" "install-bun.sh" || die "Failed to download bun installer"
    bash "install-bun.sh"
  )

  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="${BUN_INSTALL}/bin:${PATH}"

  command -v bun >/dev/null 2>&1 || die "bun install completed but bun is still not on PATH"
}

main() {
  local repo="$REPO_DEFAULT"
  local ref="$REF_DEFAULT"
  local bin_dir="$BIN_DIR_DEFAULT"
  local config_path=""
  local integrate_to=""
  local window_env_mode="auto" # auto|always|never
  local no_config="0"
  local no_release="0"
  local tmp=""
  local release_tmp=""

  trap '[[ -n "${tmp:-}" ]] && rm -rf "${tmp}" >/dev/null 2>&1 || true; [[ -n "${release_tmp:-}" ]] && rm -rf "${release_tmp}" >/dev/null 2>&1 || true' EXIT
  init_colors

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo)
        repo="$2"
        shift 2
        ;;
      --ref)
        ref="$2"
        shift 2
        ;;
      --bin-dir)
        bin_dir="$2"
        shift 2
        ;;
      --config-path)
        config_path="$2"
        shift 2
        ;;
      --integrate)
        integrate_to="$2"
        shift 2
        ;;
      --hooks)
        window_env_mode="always"
        shift
        ;;
      --window-env)
        window_env_mode="always"
        shift
        ;;
      --no-window-env)
        window_env_mode="never"
        shift
        ;;
      --no-config)
        no_config="1"
        shift
        ;;
      --no-release)
        no_release="1"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown option: $1"
        ;;
    esac
  done

  if [[ -z "${config_path}" ]]; then
    local root
    root="$(project_root)"
    if [[ -n "${root}" ]]; then
      config_path="${root}/.liquid-mail.toml"
    else
      config_path="${CONFIG_PATH_DEFAULT}"
    fi
  fi

  mkdir -p "$bin_dir"

  local installed="0"

  if [[ "$no_release" == "0" ]]; then
    if downloader >/dev/null 2>&1 && command -v tar >/dev/null 2>&1; then
      read -r os arch < <(detect_platform)
      local url="https://github.com/${repo}/releases/latest/download/liquid-mail-${os}-${arch}.tar.gz"
      release_tmp="$(mktemp -d)"
      if download_to "$url" "${release_tmp}/liquid-mail.tgz" >/dev/null 2>&1; then
        if tar -xzf "${release_tmp}/liquid-mail.tgz" -C "$release_tmp" >/dev/null 2>&1 && [[ -f "${release_tmp}/liquid-mail" ]]; then
          install -m 0755 "${release_tmp}/liquid-mail" "${bin_dir}/liquid-mail"
          installed="1"
          say "Installed liquid-mail from GitHub release."
        fi
      fi
      rm -rf "$release_tmp" || true
      release_tmp=""
    fi
  fi

  if [[ "$installed" == "0" ]]; then
    need_cmd git
    ensure_bun

    tmp="$(mktemp -d)"

    say "Building from source (${repo}@${ref})..."
    git clone --depth 1 --branch "$ref" --quiet "https://github.com/${repo}.git" "${tmp}/repo"

    (
      cd "${tmp}/repo"
      bun install
      bun run build
      install -m 0755 dist/liquid-mail "${bin_dir}/liquid-mail"
    )

    installed="1"
  fi

  if [[ "$no_config" == "0" ]]; then
    if [[ ! -f "$config_path" ]]; then
      cat >"$config_path" <<'EOF'
# Liquid Mail config (TOML)
#
# Prefer env vars for secrets:
#   LIQUID_MAIL_HONCHO_API_KEY
#   LIQUID_MAIL_HONCHO_WORKSPACE_ID
#
[honcho]
api_key = "hc_your_api_key"
# workspace_id is optional.
# If omitted, Liquid Mail defaults it to the repo name (git root folder name).
# Honcho uses get-or-create semantics for workspaces, so it will be created on first use.
# workspace_id = "my-repo"
base_url = "https://api.honcho.dev"
EOF
      say "Wrote config template: ${config_path}"
    fi
  fi

  "${bin_dir}/liquid-mail" --version >/dev/null 2>&1 || "${bin_dir}/liquid-mail" --help >/dev/null 2>&1

  if [[ -n "$integrate_to" ]]; then
    case "$integrate_to" in
      claude|codex|opencode) ;;
      *) die "Unknown --integrate target: ${integrate_to} (expected: claude|codex|opencode)" ;;
    esac
    "${bin_dir}/liquid-mail" integrate --to "$integrate_to"
  fi

  if [[ "$window_env_mode" != "never" ]]; then
    local rc_files=()
    local rc_file=""
    while IFS= read -r rc_file; do
      [[ -n "$rc_file" ]] || continue
      rc_files+=("$rc_file")
    done < <(window_env_rc_files)

    local detected_in=""
    if [[ "$window_env_mode" == "auto" ]]; then
      detected_in="$(detect_window_env_file "${rc_files[@]}" 2>/dev/null || true)"
    fi

    if [[ -n "$detected_in" ]]; then
      say ""
      say "${C_DIM}Per-window env snippet detected in:${C_RESET} ${detected_in}"
    else
      say ""
      say "Per-window env snippet (copy/paste into one of these files):"
      if [[ "${#rc_files[@]}" -gt 0 ]]; then
        local f
        for f in "${rc_files[@]}"; do
          say "  - ${f}"
        done
      else
        say "  - ~/.zshrc"
        say "  - ~/.bashrc"
      fi
      say ""
      say "${C_CYAN}----- BEGIN LIQUID MAIL WINDOW ENV -----${C_RESET}"
      "${bin_dir}/liquid-mail" window env || "${bin_dir}/liquid-mail" hooks install || true
      say "${C_CYAN}----- END LIQUID MAIL WINDOW ENV -----${C_RESET}"
    fi
  fi

  say "Done."
  say "Binary: ${bin_dir}/liquid-mail"
  if [[ "$no_config" == "0" ]]; then
    say "Config:  ${config_path}"
  fi
}

main "$@"
