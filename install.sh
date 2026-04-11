#!/usr/bin/env bash
# ============================================================
# Fluxo - Direct Install Script
# ============================================================
# Installs Mihomo (proxy core) + Fluxo (web dashboard)
# on a Debian/Ubuntu host using systemd.
#
# Requirements: curl, tar, systemd
# Usage: curl -fsSL https://fluxo.click | sudo bash
#        curl -fsSL https://fluxo.click | sudo bash -s -- --uninstall
# ============================================================

set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Configuration ────────────────────────────────────────────────────────────

MIHOMO_VERSION="${MIHOMO_VERSION:-v1.19.10}"
NODE_VERSION="22"
INSTALL_DIR="/opt/fluxo"
DATA_DIR="/var/lib/fluxo"
MIHOMO_CONFIG_DIR="/etc/mihomo"
MIHOMO_BINARY="/usr/local/bin/mihomo"
WEB_PORT="${WEB_PORT:-8080}"
SERVER_PORT="${SERVER_PORT:-8090}"
REPO_URL="https://github.com/RaylenZed/fluxo.click"
MIHOMO_GITHUB="https://github.com/MetaCubeX/mihomo"

# GitHub proxy — prepended to all github.com URLs (e.g. https://gh-proxy.com/)
# Can be set via env: GH_PROXY=https://gh-proxy.com/ bash install.sh
GH_PROXY="${GH_PROXY:-}"

# Pipe mode detection — stdin is not a terminal when running via curl | bash
PIPE_MODE=false
[[ ! -t 0 ]] && PIPE_MODE=true

# ─── Logging ──────────────────────────────────────────────────────────────────

log_info()    { echo -e "${GREEN}  ✓${NC}  $*"; }
log_warn()    { echo -e "${YELLOW}  ⚠${NC}  $*"; }
log_error()   { echo -e "${RED}  ✗${NC}  $*" >&2; }
log_step()    { echo -e "\n${PURPLE}${BOLD}▶ $*${NC}"; }
log_detail()  { echo -e "${CYAN}     $*${NC}"; }
log_banner()  {
  echo -e ""
  echo -e "${PURPLE}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${PURPLE}${BOLD}║              Fluxo — Install Script                 ║${NC}"
  echo -e "${PURPLE}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
  echo -e ""
}

# ─── Utilities ────────────────────────────────────────────────────────────────

die() {
  log_error "$*"
  exit 1
}

require_cmd() {
  command -v "$1" &>/dev/null || die "Required command not found: $1 — install it and retry."
}

confirm() {
  local prompt="$1"
  echo -en "${YELLOW}  ?${NC}  ${prompt} [y/N] "
  local answer=""
  # Always read from /dev/tty for user prompts; default to N if unavailable
  if read -r answer < /dev/tty 2>/dev/null; then
    [[ "$answer" =~ ^[Yy]$ ]]
  else
    echo "(defaulting to N)"
    return 1
  fi
}

get_primary_ip() {
  hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP"
}

# Prepend GH_PROXY to a github.com URL (no-op if proxy is empty)
gh_url() {
  echo "${GH_PROXY}${1}"
}

# ─── 0. ask_proxy ─────────────────────────────────────────────────────────────

ask_proxy() {
  # Already set via environment variable — use it, skip prompt
  if [[ -n "$GH_PROXY" ]]; then
    log_info "GitHub proxy: ${GH_PROXY} (from env)"
    echo ""
    return 0
  fi

  # Pipe mode (curl | bash): stdin is not a terminal, can't prompt interactively
  if [[ ! -t 0 ]]; then
    log_detail "Running via pipe — skipping proxy prompt"
    log_detail "For CN servers use the short command:"
    log_detail "  curl -fsSL https://fluxo.click/cn | bash"
    echo ""
    return 0
  fi

  # Interactive mode — prompt the user
  echo -e "  ${BOLD}GitHub 下载代理${NC}（国内服务器推荐，留空跳过）"
  echo -e "  ${CYAN}例如: https://gh-proxy.com/${NC}"
  echo -en "  代理 URL: "
  local _proxy_input=""
  read -r _proxy_input
  if [[ -n "$_proxy_input" ]]; then
    [[ "$_proxy_input" != */ ]] && _proxy_input="${_proxy_input}/"
    GH_PROXY="$_proxy_input"
    log_info "GitHub proxy set: ${GH_PROXY}"
  else
    log_detail "No proxy — downloading directly from github.com"
  fi
  echo ""
}

# ─── 1. check_root ────────────────────────────────────────────────────────────

check_root() {
  log_step "Checking privileges"
  if [[ $EUID -ne 0 ]]; then
    die "This script must be run as root. Try: curl -fsSL https://fluxo.click | sudo bash"
  fi
  log_info "Running as root"
}

# ─── 2. detect_arch ───────────────────────────────────────────────────────────

detect_arch() {
  log_step "Detecting architecture"
  local machine
  machine="$(uname -m)"

  case "$machine" in
    x86_64)            ARCH="amd64"  ;;
    aarch64|arm64)     ARCH="arm64"  ;;
    armv7l|armhf)      ARCH="armv7"  ;;
    *)                 die "Unsupported architecture: $machine" ;;
  esac

  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  log_info "Detected: ${OS}/${ARCH}"
}

# ─── 3. check_dependencies ────────────────────────────────────────────────────

check_dependencies() {
  log_step "Checking system dependencies"
  local missing=()

  for cmd in curl tar systemctl python3 make g++; do
    if command -v "$cmd" &>/dev/null; then
      log_info "Found: $cmd"
    else
      missing+=("$cmd")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    log_warn "Missing: ${missing[*]}"
    log_detail "Attempting to install missing packages..."
    if command -v apt-get &>/dev/null; then
      apt-get update -qq
      # Map command names to package names
      local pkgs=()
      for cmd in "${missing[@]}"; do
        case "$cmd" in
          g++)    pkgs+=("build-essential") ;;
          make)   pkgs+=("build-essential") ;;
          python3) pkgs+=("python3") ;;
          *)      pkgs+=("$cmd") ;;
        esac
      done
      # Deduplicate
      IFS=$'\n' pkgs=($(printf '%s\n' "${pkgs[@]}" | sort -u)); unset IFS
      apt-get install -y -qq "${pkgs[@]}"
    elif command -v yum &>/dev/null; then
      local pkgs=()
      for cmd in "${missing[@]}"; do
        case "$cmd" in
          g++|make) pkgs+=("gcc-c++" "make") ;;
          python3)  pkgs+=("python3") ;;
          *)        pkgs+=("$cmd") ;;
        esac
      done
      IFS=$'\n' pkgs=($(printf '%s\n' "${pkgs[@]}" | sort -u)); unset IFS
      yum install -y -q "${pkgs[@]}"
    else
      die "Cannot auto-install dependencies. Please install: ${missing[*]}"
    fi
    log_info "Dependencies installed"
  fi
}

# ─── 4. install_mihomo ────────────────────────────────────────────────────────

install_mihomo() {
  log_step "Installing Mihomo core (${MIHOMO_VERSION})"

  # Check if already installed
  if [[ -f "$MIHOMO_BINARY" ]]; then
    local current_ver
    current_ver="$("$MIHOMO_BINARY" -v 2>/dev/null | grep -oP 'v[\d.]+' | head -1 || echo "unknown")"
    log_warn "Mihomo already installed (${current_ver})"
    if [[ "$current_ver" == "$MIHOMO_VERSION" ]]; then
      log_info "Already at target version — skipping download"
      return 0
    fi
    log_detail "Will upgrade from ${current_ver} to ${MIHOMO_VERSION}"
  fi

  # Build download URL
  local filename="mihomo-${OS}-${ARCH}-${MIHOMO_VERSION}.gz"
  local url
  url="$(gh_url "${MIHOMO_GITHUB}/releases/download/${MIHOMO_VERSION}/${filename}")"

  log_detail "Downloading from: $url"
  local tmpdir=""
  tmpdir="$(mktemp -d)"

  if ! curl -fsSL --progress-bar -o "${tmpdir}/${filename}" "$url"; then
    rm -rf "$tmpdir"
    die "Failed to download Mihomo. Check version and network connectivity."
  fi

  log_detail "Extracting binary..."
  gunzip -f "${tmpdir}/${filename}"
  local binary_name="mihomo-${OS}-${ARCH}-${MIHOMO_VERSION}"
  mv "${tmpdir}/${binary_name}" "$MIHOMO_BINARY"
  chmod +x "$MIHOMO_BINARY"
  rm -rf "$tmpdir"

  log_info "Mihomo installed: $MIHOMO_BINARY"
  log_detail "Version: $("$MIHOMO_BINARY" -v 2>/dev/null | head -1 || echo 'n/a')"
}

# ─── 5. configure_mihomo ─────────────────────────────────────────────────────

configure_mihomo() {
  log_step "Configuring Mihomo"

  mkdir -p "$MIHOMO_CONFIG_DIR"

  # Backup existing config
  if [[ -f "${MIHOMO_CONFIG_DIR}/config.yaml" ]]; then
    local backup="${MIHOMO_CONFIG_DIR}/config.yaml.bak.$(date +%Y%m%d%H%M%S)"
    cp "${MIHOMO_CONFIG_DIR}/config.yaml" "$backup"
    log_warn "Existing config backed up to: $backup"
  else
    log_detail "Writing default config..."
    cat > "${MIHOMO_CONFIG_DIR}/config.yaml" <<'YAML'
# Mihomo configuration — generated by Fluxo installer
# Edit via the Fluxo web UI or directly here.

mixed-port: 7890
allow-lan: true
bind-address: "*"
mode: rule
log-level: info
ipv6: false

external-controller: 0.0.0.0:9090
secret: ""

dns:
  enable: true
  listen: 0.0.0.0:1053
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver:
    - 8.8.8.8
    - 1.1.1.1

tun:
  enable: false
  stack: system
  dns-hijack:
    - any:53
  auto-route: true
  auto-redirect: true

proxies: []
proxy-groups: []
rules:
  - MATCH,DIRECT
YAML
    log_info "Default config written to ${MIHOMO_CONFIG_DIR}/config.yaml"
  fi
}

# ─── 6. install_node ─────────────────────────────────────────────────────────

install_node() {
  log_step "Checking Node.js"

  if command -v node &>/dev/null; then
    local nv
    nv="$(node --version 2>/dev/null | grep -oP '\d+' | head -1)"
    if [[ "$nv" -ge 20 ]]; then
      log_info "Node.js $(node --version) already installed — OK"
      return 0
    fi
    log_warn "Node.js $(node --version) is too old (need ≥ 20). Will upgrade."
  fi

  log_detail "Installing Node.js ${NODE_VERSION} via NodeSource..."

  if command -v apt-get &>/dev/null; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - &>/dev/null
    apt-get install -y -qq nodejs
  elif command -v yum &>/dev/null; then
    curl -fsSL "https://rpm.nodesource.com/setup_${NODE_VERSION}.x" | bash - &>/dev/null
    yum install -y nodejs
  else
    die "Cannot install Node.js automatically. Please install Node.js ${NODE_VERSION} manually."
  fi

  log_info "Node.js $(node --version) installed"

  # Install pnpm
  log_detail "Installing pnpm..."
  npm install -g pnpm@latest --silent
  log_info "pnpm $(pnpm --version) installed"
}

# ─── 7. install_fluxo ───────────────────────────────────────────────────────

install_fluxo() {
  log_step "Installing Fluxo web dashboard"

  mkdir -p "$DATA_DIR"

  # Check if already installed
  if [[ -d "$INSTALL_DIR" ]]; then
    log_warn "Fluxo already installed at $INSTALL_DIR"
    # Auto-upgrade in pipe mode or when --upgrade flag is passed; prompt otherwise
    if $PIPE_MODE; then
      log_detail "Pipe mode — auto-upgrading..."
    elif ! confirm "Re-install / upgrade?"; then
      log_info "Skipping Fluxo install"
      return 0
    fi
    log_detail "Removing existing installation..."
    rm -rf "$INSTALL_DIR"
  fi

  mkdir -p "$INSTALL_DIR"

  # Use tarball download when GH_PROXY is set (gh-proxy.com doesn't support git protocol);
  # also fall back to tarball if git clone fails (common on CN servers with GitHub instability).
  local clone_ok=false
  if [[ -z "$GH_PROXY" ]] && command -v git &>/dev/null; then
    log_detail "Cloning repository..."
    if git clone --depth=1 "${REPO_URL}" "$INSTALL_DIR" 2>&1; then
      clone_ok=true
    else
      log_warn "git clone failed — falling back to tarball download"
      log_detail "Tip: set GH_PROXY=https://gh-proxy.com/ to speed up downloads in CN regions"
      rm -rf "$INSTALL_DIR"
      mkdir -p "$INSTALL_DIR"
    fi
  fi

  if ! $clone_ok; then
    log_detail "Downloading release tarball..."
    local tarball_url
    tarball_url="$(gh_url "${REPO_URL}/archive/refs/heads/main.tar.gz")"
    local tmptar
    tmptar="$(mktemp)"
    curl -fsSL --progress-bar -o "$tmptar" "$tarball_url" || die "Failed to download Fluxo — try setting GH_PROXY=https://gh-proxy.com/"
    tar -xzf "$tmptar" --strip-components=1 -C "$INSTALL_DIR"
    rm -f "$tmptar"
  fi

  log_detail "Installing dependencies..."
  cd "$INSTALL_DIR"
  # Allow overriding npm registry (useful for CN servers: NPM_REGISTRY=https://registry.npmmirror.com)
  if [[ -n "${NPM_REGISTRY:-}" ]]; then
    log_detail "Using npm registry: ${NPM_REGISTRY}"
    pnpm config set registry "$NPM_REGISTRY" --location project
  fi
  pnpm install --frozen-lockfile 2>&1 | tail -5 | while read -r line; do log_detail "$line"; done

  log_detail "Building applications..."
  pnpm turbo build 2>&1 | grep -E "✓|error|warn" | head -20 | while read -r line; do log_detail "$line"; done

  log_info "Fluxo built successfully"

  # Copy static assets into Next.js standalone output (required for standalone mode)
  local web_standalone="${INSTALL_DIR}/apps/web/.next/standalone/apps/web"
  log_detail "Copying static assets to standalone output..."
  cp -r "${INSTALL_DIR}/apps/web/public" "${web_standalone}/public" 2>/dev/null || true
  mkdir -p "${web_standalone}/.next"
  cp -r "${INSTALL_DIR}/apps/web/.next/static" "${web_standalone}/.next/static" 2>/dev/null || true

  # Install fluxo-cli (system management CLI tool)
  log_detail "Installing fluxo-cli..."
  cp "$INSTALL_DIR/tools/fluxo-cli.sh" /usr/local/bin/fluxo-cli
  chmod +x /usr/local/bin/fluxo-cli
  log_info "fluxo-cli installed → /usr/local/bin/fluxo-cli"
}

# ─── 8. create_systemd_services ──────────────────────────────────────────────

create_systemd_services() {
  log_step "Creating systemd services"

  # ── mihomo.service ────────────────────────────────────────────────────
  cat > /etc/systemd/system/mihomo.service <<EOF
[Unit]
Description=Mihomo - A Rule Based Proxy
Documentation=${MIHOMO_GITHUB}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
ExecStart=${MIHOMO_BINARY} -d ${MIHOMO_CONFIG_DIR}
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=5s
LimitNOFILE=65535

# Capabilities for TUN / raw sockets
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW

[Install]
WantedBy=multi-user.target
EOF
  log_info "Created /etc/systemd/system/mihomo.service"

  # ── fluxo.service ────────────────────────────────────────────────────
  local node_bin
  node_bin="$(command -v node)"
  cat > /etc/systemd/system/fluxo.service <<EOF
[Unit]
Description=Fluxo - Web Dashboard for Mihomo
Documentation=${REPO_URL}
After=network-online.target mihomo.service
Wants=network-online.target
BindsTo=mihomo.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
Environment=PORT=${SERVER_PORT}
Environment=WEB_PORT=${WEB_PORT}
Environment=DB_PATH=${DATA_DIR}/fluxo.db
Environment=MIHOMO_API_URL=http://127.0.0.1:9090
ExecStart=${node_bin} ${INSTALL_DIR}/apps/server/dist/index.js
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=fluxo

[Install]
WantedBy=multi-user.target
EOF
  log_info "Created /etc/systemd/system/fluxo.service"

  # ── fluxo-web.service ─────────────────────────────────────────────────
  local web_standalone="${INSTALL_DIR}/apps/web/.next/standalone/apps/web"
  cat > /etc/systemd/system/fluxo-web.service <<EOF
[Unit]
Description=Fluxo Web UI (Next.js)
Documentation=${REPO_URL}
After=network-online.target fluxo.service
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${web_standalone}
Environment=NODE_ENV=production
Environment=PORT=${WEB_PORT}
Environment=HOSTNAME=0.0.0.0
Environment=BACKEND_URL=http://127.0.0.1:${SERVER_PORT}
ExecStart=${node_bin} ${web_standalone}/server.js
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=fluxo-web

[Install]
WantedBy=multi-user.target
EOF
  log_info "Created /etc/systemd/system/fluxo-web.service"

  # Reload and enable
  systemctl daemon-reload
  systemctl enable mihomo.service
  systemctl enable fluxo.service
  systemctl enable fluxo-web.service
  log_info "Services enabled for auto-start"

  # Start services
  log_detail "Starting mihomo..."
  systemctl start mihomo.service
  sleep 2

  if systemctl is-active --quiet mihomo.service; then
    log_info "Mihomo is running"
  else
    log_warn "Mihomo failed to start — check: journalctl -u mihomo -n 50"
  fi

  log_detail "Starting fluxo API..."
  systemctl start fluxo.service
  sleep 2

  if systemctl is-active --quiet fluxo.service; then
    log_info "Fluxo API is running"
  else
    log_warn "Fluxo API failed to start — check: journalctl -u fluxo -n 50"
  fi

  log_detail "Starting fluxo web UI..."
  systemctl start fluxo-web.service
  sleep 2

  if systemctl is-active --quiet fluxo-web.service; then
    log_info "Fluxo web UI is running"
  else
    log_warn "Fluxo web UI failed to start — check: journalctl -u fluxo-web -n 50"
  fi
}

# ─── 9. configure_firewall ────────────────────────────────────────────────────

configure_firewall() {
  log_step "Configuring firewall (optional)"

  if command -v ufw &>/dev/null && ufw status | grep -q "active"; then
    log_detail "ufw detected and active"
    if confirm "Open ports ${WEB_PORT} (UI), ${SERVER_PORT} (API), 7890 (proxy) in ufw?"; then
      ufw allow "$WEB_PORT/tcp"   comment "fluxo UI"   &>/dev/null
      ufw allow "$SERVER_PORT/tcp" comment "fluxo API"  &>/dev/null
      ufw allow "7890/tcp"        comment "mihomo proxy"       &>/dev/null
      ufw allow "9090/tcp"        comment "mihomo API"         &>/dev/null
      ufw reload &>/dev/null
      log_info "Firewall rules added"
    fi
  elif command -v firewall-cmd &>/dev/null && firewall-cmd --state &>/dev/null; then
    log_detail "firewalld detected"
    if confirm "Open ports in firewalld?"; then
      firewall-cmd --permanent --add-port="${WEB_PORT}/tcp"    &>/dev/null
      firewall-cmd --permanent --add-port="${SERVER_PORT}/tcp" &>/dev/null
      firewall-cmd --permanent --add-port="7890/tcp"          &>/dev/null
      firewall-cmd --permanent --add-port="9090/tcp"          &>/dev/null
      firewall-cmd --reload &>/dev/null
      log_info "Firewall rules added"
    fi
  else
    log_detail "No supported firewall detected — skipping"
  fi
}

# ─── 10. show_summary ─────────────────────────────────────────────────────────

show_summary() {
  local ip
  ip="$(get_primary_ip)"

  echo -e ""
  echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║           Installation Complete!                     ║${NC}"
  echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
  echo -e ""
  echo -e "${BOLD}  Fluxo Web UI:${NC}"
  echo -e "  ${CYAN}http://${ip}:${WEB_PORT}${NC}"
  echo -e ""
  echo -e "${BOLD}  Mihomo API:${NC}"
  echo -e "  ${CYAN}http://${ip}:9090${NC}"
  echo -e ""
  echo -e "${BOLD}  Proxy Ports:${NC}"
  echo -e "  HTTP/HTTPS proxy : ${ip}:7890"
  echo -e "  SOCKS5 proxy     : ${ip}:7891"
  echo -e ""
  echo -e "${BOLD}  Useful commands:${NC}"
  echo -e "  ${CYAN}fluxo-cli${NC}                         — interactive CLI (Mihomo management)"
  echo -e "  ${CYAN}fluxo-cli status${NC}                  — quick status"
  echo -e "  ${CYAN}fluxo-cli test${NC}                    — network connectivity test"
  echo -e "  ${CYAN}systemctl status mihomo${NC}           — core status"
  echo -e "  ${CYAN}systemctl status fluxo${NC}            — API server status"
  echo -e "  ${CYAN}systemctl status fluxo-web${NC}        — web UI status"
  echo -e "  ${CYAN}journalctl -fu mihomo${NC}             — core logs (live)"
  echo -e "  ${CYAN}journalctl -fu fluxo${NC}              — API server logs (live)"
  echo -e "  ${CYAN}journalctl -fu fluxo-web${NC}          — web UI logs (live)"
  echo -e "  ${CYAN}curl -fsSL https://fluxo.click | bash${NC}"
  echo -e "                                    — upgrade to latest"
  echo -e "  ${CYAN}curl -fsSL https://fluxo.click/cn | bash${NC}"
  echo -e "                                    — upgrade (CN servers, auto proxy)"
  echo -e "  ${CYAN}curl -fsSL https://fluxo.click | sudo bash -s -- --uninstall${NC}"
  echo -e "                                    — uninstall everything"
  echo -e ""
  echo -e "${YELLOW}  Config file: ${MIHOMO_CONFIG_DIR}/config.yaml${NC}"
  echo -e "${YELLOW}  Edit your proxies and rules there, then reload:${NC}"
  echo -e "  ${CYAN}systemctl reload mihomo${NC}"
  echo -e ""
}

# ─── 11. uninstall ────────────────────────────────────────────────────────────

uninstall() {
  log_banner
  log_step "Uninstalling Fluxo"

  echo -e "${YELLOW}  You will be asked what to remove. Services will always be stopped.${NC}"
  echo -e ""

  if ! confirm "Proceed with uninstall?"; then
    echo "Aborted."
    exit 0
  fi

  # ── Always: stop and disable services ────────────────────────────────────
  log_step "Stopping and removing services"
  for svc in fluxo-web fluxo mihomo; do
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
      log_detail "Stopping $svc..."
      systemctl stop "$svc" || true
    fi
    if systemctl is-enabled --quiet "$svc" 2>/dev/null; then
      systemctl disable "$svc" || true
    fi
    rm -f "/etc/systemd/system/${svc}.service"
    log_info "Removed service: $svc"
  done
  systemctl daemon-reload

  # ── Fluxo app ─────────────────────────────────────────────────────────────
  echo -e ""
  echo -e "  ${BOLD}Fluxo app${NC} — ${CYAN}${INSTALL_DIR}${NC}"
  if confirm "Remove Fluxo application files?"; then
    [[ -d "$INSTALL_DIR" ]] && rm -rf "$INSTALL_DIR" && log_info "Removed: $INSTALL_DIR"
    [[ -f "/usr/local/bin/fluxo-cli" ]] && rm -f "/usr/local/bin/fluxo-cli" && log_info "Removed: /usr/local/bin/fluxo-cli"
  else
    log_detail "Skipped: $INSTALL_DIR"
  fi

  # ── Fluxo data (database, profiles, rules) ────────────────────────────────
  echo -e ""
  echo -e "  ${BOLD}Fluxo data${NC} — ${CYAN}${DATA_DIR}${NC}"
  echo -e "  ${YELLOW}  Contains: database, profiles, rules, settings, password hash${NC}"
  if confirm "Remove Fluxo data directory? (password and all config will be lost)"; then
    [[ -d "$DATA_DIR" ]] && rm -rf "$DATA_DIR" && log_info "Removed: $DATA_DIR"
  else
    log_detail "Skipped: $DATA_DIR (data preserved)"
  fi

  # ── Mihomo binary ─────────────────────────────────────────────────────────
  echo -e ""
  echo -e "  ${BOLD}Mihomo binary${NC} — ${CYAN}${MIHOMO_BINARY}${NC}"
  if confirm "Remove Mihomo binary?"; then
    [[ -f "$MIHOMO_BINARY" ]] && rm -f "$MIHOMO_BINARY" && log_info "Removed: $MIHOMO_BINARY"
  else
    log_detail "Skipped: $MIHOMO_BINARY"
  fi

  # ── Mihomo config ─────────────────────────────────────────────────────────
  echo -e ""
  echo -e "  ${BOLD}Mihomo config${NC} — ${CYAN}${MIHOMO_CONFIG_DIR}${NC}"
  echo -e "  ${YELLOW}  Contains: config.yaml, GeoIP/GeoSite databases${NC}"
  if confirm "Remove Mihomo config directory?"; then
    [[ -d "$MIHOMO_CONFIG_DIR" ]] && rm -rf "$MIHOMO_CONFIG_DIR" && log_info "Removed: $MIHOMO_CONFIG_DIR"
  else
    log_detail "Skipped: $MIHOMO_CONFIG_DIR (preserved)"
  fi

  echo -e ""
  log_info "Uninstall complete."
  echo -e ""
}

# ─── 12. run_installer ────────────────────────────────────────────────────────

run_installer() {
  log_banner
  ask_proxy
  echo -e "  Mihomo version   : ${CYAN}${MIHOMO_VERSION}${NC}"
  echo -e "  Web UI port      : ${CYAN}${WEB_PORT}${NC}"
  echo -e "  API server port  : ${CYAN}${SERVER_PORT}${NC}"
  echo -e "  Install dir      : ${CYAN}${INSTALL_DIR}${NC}"
  echo -e "  Data dir         : ${CYAN}${DATA_DIR}${NC}"
  echo -e "  GitHub proxy     : ${CYAN}${GH_PROXY:-（none）}${NC}"
  echo -e "  npm registry     : ${CYAN}${NPM_REGISTRY:-（default）}${NC}"
  echo -e ""

  check_root
  detect_arch
  check_dependencies
  install_mihomo
  configure_mihomo
  install_node
  install_fluxo
  create_systemd_services
  configure_firewall
  show_summary
}

# ─── Entrypoint ───────────────────────────────────────────────────────────────

case "${1:-install}" in
  --uninstall|uninstall)
    check_root
    uninstall
    ;;
  --upgrade|upgrade)
    PIPE_MODE=true
    run_installer
    ;;
  --help|-h|help)
    echo "Usage: curl -fsSL https://fluxo.click | sudo bash"
    echo ""
    echo "Environment variables:"
    echo "  MIHOMO_VERSION   Mihomo version to install (default: v1.19.10)"
    echo "  WEB_PORT         Web UI port (default: 8080)"
    echo "  SERVER_PORT      API server port (default: 8090)"
    echo "  GH_PROXY         GitHub proxy URL (e.g. https://gh-proxy.com/)
  NPM_REGISTRY     npm registry URL (e.g. https://registry.npmmirror.com for CN)"
    echo ""
    echo "Examples:"
    echo "  # Standard install"
    echo "  curl -fsSL https://fluxo.click | sudo bash"
    echo ""
    echo "  # With GitHub proxy (for regions with slow GitHub access)"
    echo "  curl -fsSL https://fluxo.click | sudo GH_PROXY=https://gh-proxy.com/ bash"
    echo ""
    echo "  # Uninstall"
    echo "  curl -fsSL https://fluxo.click | sudo bash -s -- --uninstall"
    echo ""
    ;;
  *)
    run_installer
    ;;
esac
