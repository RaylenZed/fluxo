#!/bin/bash
# ============================================================
#  Fluxo CLI - Mihomo 代理服务管理工具
#  项目地址: https://github.com/RaylenZed/fluxo
# ============================================================

# ── 常量 ────────────────────────────────────────────────────
BINARY="/usr/local/bin/mihomo"
CONFIG_DIR="/etc/mihomo"
CONFIG_FILE="$CONFIG_DIR/config.yaml"
SERVICE_FILE="/etc/systemd/system/mihomo.service"
SERVICE_NAME="mihomo"
LATEST_VERSION_API="https://api.github.com/repos/MetaCubeX/mihomo/releases/latest"
SCRIPT_PATH="$(realpath "$0")"
SCRIPT_VERSION="3.0.0"
SCRIPT_RAW_URL="https://raw.githubusercontent.com/RaylenZed/fluxo/main/tools/fluxo-cli.sh"
SCRIPT_VERSION_URL="https://raw.githubusercontent.com/RaylenZed/fluxo/main/tools/version"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

# ── 基础工具 ─────────────────────────────────────────────────
info()    { echo -e "  ${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "  ${YELLOW}[!]${NC} $*"; }
error()   { echo -e "  ${RED}[✗]${NC} $*"; }
title()   { echo -e "\n${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; \
            echo -e "${BOLD}${CYAN}  $*${NC}"; \
            echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }
divider() { echo -e "  ${DIM}────────────────────────────────────${NC}"; }
pause()   { echo -e "\n  按 ${BOLD}Enter${NC} 返回..."; read -r; }

# 获取本机局域网 IP（兼容 TUN 模式自定义路由表）
_local_ip() {
    local iface ip
    # 先取默认路由出口网卡，再取该网卡 IP，避免被路由表编号污染
    iface=$(ip route show default 2>/dev/null | awk '/^default/{print $5}' | head -1)
    if [ -n "$iface" ]; then
        ip=$(ip addr show "$iface" 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 | head -1)
    fi
    # fallback
    [ -z "$ip" ] && ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    echo "${ip:-127.0.0.1}"
}

ask() {
    # ask "提示" 默认值(y/n)  →  返回 0=yes 1=no
    local prompt="$1" default="${2:-n}"
    local yn
    if [ "$default" = "y" ]; then
        printf "  %s [Y/n]: " "$prompt"
    else
        printf "  %s [y/N]: " "$prompt"
    fi
    read -r yn
    yn="${yn:-$default}"
    case "$yn" in [yY]*) return 0 ;; *) return 1 ;; esac
}

require_root() {
    if [ "$(id -u)" -ne 0 ]; then
        echo ""
        error "此操作需要 root 权限"
        echo ""
        echo -e "  ${BOLD}当前用户:${NC} $(id -un)（非 root）"
        echo ""
        echo -e "  ${YELLOW}解决方法：${NC}"
        echo -e "  ${CYAN}sudo $(realpath "$0" 2>/dev/null || echo "$0")${NC}"
        echo -e "  ${DIM}以 root 身份重新运行脚本，再选择此操作${NC}"
        echo ""
        return 1
    fi
}

# ── 状态摘要 ─────────────────────────────────────────────────
_status_bar() {
    local svc ver tun ts

    if systemctl is-active "$SERVICE_NAME" >/dev/null 2>&1; then
        svc="${GREEN}运行中${NC}"
    else
        svc="${RED}已停止${NC}"
    fi

    if [ -f "$BINARY" ]; then
        ver=$("$BINARY" -v 2>/dev/null | grep -o 'v[0-9.]*' | head -1)
    else
        ver="未安装"
    fi

    ip link show Meta >/dev/null 2>&1 && tun="${GREEN}已启用${NC}" || tun="${YELLOW}未启用${NC}"

    command -v tailscale >/dev/null 2>&1 && ts="${GREEN}已安装${NC}" || ts="${DIM}未安装${NC}"

    local ipv6
    [ "$(cat /proc/sys/net/ipv6/conf/all/disable_ipv6 2>/dev/null)" = "0" ] \
        && ipv6="${GREEN}已启用${NC}" || ipv6="${YELLOW}已禁用${NC}"

    echo -e "  Mihomo: $svc  版本: ${CYAN}$ver${NC}  TUN: $tun  Tailscale: $ts  IPv6: $ipv6"
}

# ════════════════════════════════════════════════════════════
#  主菜单
# ════════════════════════════════════════════════════════════
main_menu() {
    while true; do
        clear
        echo -e "${BOLD}${CYAN}"
        echo "  ╔══════════════════════════════════════╗"
        echo "  ║            Fluxo CLI v${SCRIPT_VERSION}              ║"
        echo -e "  ╚══════════════════════════════════════╝${NC}"
        echo ""
        _status_bar
        echo ""
        # root 状态提示
        if [ "$(id -u)" -eq 0 ]; then
            local _root_tag="${GREEN}[root]${NC}"
        else
            local _root_tag="${YELLOW}[需要root]${NC}"
        fi

        divider
        echo -e "  ${BOLD}Mihomo 服务${NC}"
        divider
        echo "  1. 查看状态"
        echo -e "  2. 启动服务              ${_root_tag}"
        echo -e "  3. 停止服务              ${_root_tag}"
        echo -e "  4. 重启服务              ${_root_tag}"
        echo -e "  5. 开机自启设置          ${_root_tag}"
        echo ""
        divider
        echo -e "  ${BOLD}安装与配置${NC}"
        divider
        echo -e "  6. 安装 Mihomo           ${_root_tag}"
        echo "  7. 配置文件管理"
        echo -e "  8. 更新 Mihomo           ${_root_tag}"
        echo ""
        divider
        echo -e "  ${BOLD}诊断与监控${NC}"
        divider
        echo "  9. 网络连通性测试"
        echo " 10. 查看日志"
        echo ""
        divider
        echo -e "  ${BOLD}Tailscale${NC}"
        divider
        echo -e " 11. Tailscale 管理       ${_root_tag}"
        echo -e " 12. Tailscale 兼容设置   ${_root_tag}"
        echo ""
        divider
        echo -e "  ${BOLD}其他${NC}"
        divider
        echo " 13. 管理面板（Web UI）"
        echo " 14. 复制代理链接"
        echo -e " 15. 系统网络设置（IPv6） ${_root_tag}"
        echo -e " 16. Docker 代理设置      ${_root_tag}"
        echo -e " 17. 脚本自更新           ${DIM}(当前 v${SCRIPT_VERSION})${NC}"
        echo -e " 18. 卸载 Mihomo          ${_root_tag}"
        echo "  0. 退出"
        divider
        echo ""
        printf "  请输入选项: "
        read -r choice

        case "$choice" in
            1)  menu_status ;;
            2)  menu_start ;;
            3)  menu_stop ;;
            4)  menu_restart ;;
            5)  menu_autostart ;;
            6)  menu_install ;;
            7)  menu_config ;;
            8)  menu_update ;;
            9)  menu_test ;;
            10) menu_log ;;
            11) menu_tailscale_manage ;;
            12) menu_tailscale_compat ;;
            13) menu_webui ;;
            14) menu_proxy_link ;;
            15) menu_network_settings ;;
            16) menu_docker_proxy ;;
            17) menu_self_update ;;
            18) menu_uninstall ;;
            0)  clear; echo "  再见！"; exit 0 ;;
            *)  error "无效选项，请重新输入"; sleep 1 ;;
        esac
    done
}

# ════════════════════════════════════════════════════════════
#  Mihomo 服务管理
# ════════════════════════════════════════════════════════════
menu_status() {
    clear
    title "Mihomo 运行状态"

    if systemctl is-active "$SERVICE_NAME" >/dev/null 2>&1; then
        info "服务状态:  ${GREEN}● 运行中${NC}"
    else
        error "服务状态:  ● 已停止"
    fi

    if systemctl is-enabled "$SERVICE_NAME" >/dev/null 2>&1; then
        info "开机自启:  已启用"
    else
        warn "开机自启:  未启用"
    fi

    [ -f "$BINARY" ] && info "版本:      $("$BINARY" -v 2>/dev/null | head -1)"

    local ports
    ports=$(ss -tlnp 2>/dev/null | grep mihomo | awk '{print $4}' | tr '\n' '  ')
    [ -n "$ports" ] && info "监听端口:  $ports"

    if ip link show Meta >/dev/null 2>&1; then
        info "TUN 接口:  ${GREEN}Meta (已创建)${NC}"
    else
        warn "TUN 接口:  未创建"
    fi

    if [ -f "$CONFIG_FILE" ]; then
        info "配置文件:  $CONFIG_FILE ${GREEN}(存在)${NC}"
        local ctrl
        ctrl=$(grep 'external-controller' "$CONFIG_FILE" 2>/dev/null | awk '{print $2}')
        [ -n "$ctrl" ] && info "控制面板:  http://$ctrl"
    else
        error "配置文件:  缺失"
    fi

    echo ""
    divider
    echo ""
    systemctl status "$SERVICE_NAME" --no-pager -l 2>/dev/null | tail -12 || true
    pause
}

menu_start() {
    require_root || { pause; return; }
    clear
    title "启动 Mihomo"
    if [ ! -f "$CONFIG_FILE" ]; then
        error "配置文件不存在: $CONFIG_FILE"
        warn "请先通过「配置文件管理」导入配置"
        pause; return
    fi
    systemctl start "$SERVICE_NAME" && info "服务已启动" || error "启动失败"
    sleep 1
    echo ""
    systemctl status "$SERVICE_NAME" --no-pager | tail -5
    pause
}

menu_stop() {
    require_root || { pause; return; }
    clear
    title "停止 Mihomo"
    ask "确定要停止 Mihomo 服务吗？" n || return
    systemctl stop "$SERVICE_NAME" && info "服务已停止" || error "停止失败"
    pause
}

menu_restart() {
    require_root || { pause; return; }
    clear
    title "重启 Mihomo"
    systemctl restart "$SERVICE_NAME" && info "服务已重启" || error "重启失败"
    sleep 1
    echo ""
    systemctl status "$SERVICE_NAME" --no-pager | tail -5
    pause
}

menu_autostart() {
    require_root || { pause; return; }
    clear
    title "开机自启设置"

    if systemctl is-enabled "$SERVICE_NAME" >/dev/null 2>&1; then
        info "当前状态: 已启用"
        echo ""
        echo "  1. 取消开机自启"
        echo "  0. 返回"
        echo ""
        printf "  请输入选项: "
        read -r c
        [ "$c" = "1" ] && systemctl disable "$SERVICE_NAME" && info "已取消开机自启"
    else
        warn "当前状态: 未启用"
        echo ""
        echo "  1. 设为开机自启"
        echo "  0. 返回"
        echo ""
        printf "  请输入选项: "
        read -r c
        [ "$c" = "1" ] && systemctl enable "$SERVICE_NAME" && info "已设为开机自启"
    fi
    pause
}

# ════════════════════════════════════════════════════════════
#  安装与配置
# ════════════════════════════════════════════════════════════
menu_install() {
    require_root || { pause; return; }
    clear
    title "安装 Mihomo"

    if [ -f "$BINARY" ]; then
        local ver
        ver=$("$BINARY" -v 2>/dev/null | grep -o 'v[0-9.]*' | head -1)
        warn "Mihomo $ver 已安装"
        ask "是否重新安装（覆盖）？" n || return
        echo ""
    fi

    info "获取最新版本信息..."
    local latest arch_name download_url
    latest=$(curl -s --max-time 15 "$LATEST_VERSION_API" | grep '"tag_name"' | head -1 | grep -o 'v[0-9.]*')

    if [ -z "$latest" ]; then
        error "无法获取版本信息（服务器可能无法访问 GitHub）"
        echo ""
        warn "请在本机执行以下命令后将文件传到服务器："
        local arch
        arch=$(uname -m)
        [ "$arch" = "aarch64" ] && arch="arm64" || arch="amd64"
        echo ""
        echo "  curl -L -o /tmp/mihomo.gz 'https://github.com/MetaCubeX/mihomo/releases/latest/download/mihomo-linux-${arch}.gz'"
        echo "  gunzip /tmp/mihomo.gz"
        echo "  scp /tmp/mihomo-linux-${arch} 服务器:/usr/local/bin/mihomo"
        echo ""
        warn "传完后重新选择「安装 Mihomo」即可完成后续步骤"
        pause; return
    fi

    info "最新版本: $latest"

    case $(uname -m) in
        x86_64)  arch_name="amd64" ;;
        aarch64) arch_name="arm64" ;;
        armv7l)  arch_name="armv7" ;;
        *) error "不支持的架构: $(uname -m)"; pause; return ;;
    esac

    download_url="https://github.com/MetaCubeX/mihomo/releases/download/${latest}/mihomo-linux-${arch_name}-${latest}.gz"
    info "下载中: $download_url"
    echo ""

    local tmp_gz
    tmp_gz=$(mktemp /tmp/mihomo-XXXXXX.gz)
    if curl -L -o "$tmp_gz" "$download_url" --progress-bar; then
        info "解压安装..."
        gunzip -f "$tmp_gz"
        local tmp_bin="${tmp_gz%.gz}"
        mv "$tmp_bin" "$BINARY"
        chmod +x "$BINARY"
        rm -f "$tmp_gz" 2>/dev/null || true
        info "Mihomo $latest 安装成功"
    else
        rm -f "$tmp_gz" 2>/dev/null || true
        error "下载失败"
        warn "请参考上方手动安装说明"
        pause; return
    fi

    echo ""
    mkdir -p "$CONFIG_DIR/ruleset"
    _install_geodata
    echo ""
    _install_service
    _install_alias
    echo ""
    info "全部完成！下一步请通过「配置文件管理」导入 config.yaml"
    pause
}

_install_geodata() {
    info "下载 GeoIP 数据库..."
    curl -sL --max-time 30 -o "$CONFIG_DIR/Country.mmdb" \
        "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country.mmdb" \
        && info "Country.mmdb 下载成功" \
        || warn "Country.mmdb 下载失败，可手动放到 $CONFIG_DIR/Country.mmdb"

    curl -sL --max-time 30 -o "$CONFIG_DIR/ASN.mmdb" \
        "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb" \
        && info "ASN.mmdb 下载成功" \
        || warn "ASN.mmdb 下载失败，可手动放到 $CONFIG_DIR/ASN.mmdb"
}

_install_service() {
    # 创建 ip rule 辅助脚本（动态读取 fake-ip-range）
    cat > "$CONFIG_DIR/mihomo-rules.sh" << 'RULES'
#!/bin/bash
# Mihomo TUN 路由修正脚本
# 由 mihomo-manager 自动生成，请勿手动修改
ACTION="${1:-add}"
CONFIG="/etc/mihomo/config.yaml"

# 检测默认出口网卡
IFACE=$(ip route show default 2>/dev/null | awk '/^default/{print $5}' | head -1)

# 从配置文件读取 fake-ip-range，未配置则使用默认值
FAKEIP=$(grep 'fake-ip-range' "$CONFIG" 2>/dev/null | awk '{print $2}' | tr -d "'\"" | head -1)
[ -z "$FAKEIP" ] && FAKEIP="198.18.0.0/16"

# 规则 1: 公网入站走 main（防止被 TUN 劫持）
[ -n "$IFACE" ] && ip rule "$ACTION" priority 100 iif "$IFACE" lookup main 2>/dev/null || true

# 规则 2: Docker 容器访问 fake-ip → 送回 Mihomo（DNS 还原）
ip rule "$ACTION" priority 190 from 172.16.0.0/12 to "$FAKEIP" lookup 2022 2>/dev/null || true

# 规则 3: Docker 其余流量（DNAT 回包等）→ main 直连
ip rule "$ACTION" priority 200 from 172.16.0.0/12 lookup main 2>/dev/null || true
RULES
    chmod +x "$CONFIG_DIR/mihomo-rules.sh"
    info "路由修正脚本已创建: $CONFIG_DIR/mihomo-rules.sh"

    cat > "$SERVICE_FILE" << 'EOF'
[Unit]
Description=Mihomo Proxy Service
After=network.target NetworkManager.service systemd-networkd.service

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/mihomo -d /etc/mihomo
ExecStartPost=/bin/bash -c 'sleep 1 && /etc/mihomo/mihomo-rules.sh add'
ExecStopPost=/etc/mihomo/mihomo-rules.sh del
Restart=always
RestartSec=5
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME" >/dev/null 2>&1
    info "systemd 服务注册完成，已设为开机自启"
}

_install_alias() {
    ln -sf "$SCRIPT_PATH" /usr/local/bin/fluxo-cli
    info "已创建快捷命令 fluxo-cli"
}

menu_config() {
    while true; do
        clear
        title "配置文件管理"
        echo -e "  配置文件路径: ${BOLD}$CONFIG_FILE${NC}"
        echo ""
        echo "  1. 查看当前配置摘要"
        echo "  2. 从路径导入配置文件"
        echo "  3. 查看目录结构说明"
        echo "  4. 编辑配置文件"
        echo "  5. 更新 GeoIP/GeoSite 数据库"
        echo "  6. 添加域名直连/代理规则"
        echo "  7. 重建路由规则"
        echo "  0. 返回主菜单"
        echo ""
        printf "  请输入选项: "
        read -r c
        case "$c" in
            1) _config_show ;;
            2) _config_import ;;
            3) _config_tree ;;
            4) _config_edit ;;
            5) _config_update_geodata ;;
            6) _config_add_rule ;;
            7) _config_rebuild_rules ;;
            0) return ;;
            *) error "无效选项"; sleep 1 ;;
        esac
    done
}

_config_show() {
    clear
    title "当前配置摘要"
    if [ ! -f "$CONFIG_FILE" ]; then
        warn "配置文件不存在: $CONFIG_FILE"
        pause; return
    fi
    info "混合端口:  $(grep 'mixed-port' "$CONFIG_FILE" | awk '{print $2}')"
    info "控制面板:  $(grep 'external-controller' "$CONFIG_FILE" | awk '{print $2}')"
    info "代理模式:  $(grep '^mode:' "$CONFIG_FILE" | awk '{print $2}')"
    info "TUN 模式:  $(grep -A2 '^tun:' "$CONFIG_FILE" | grep 'enable' | awk '{print $2}')"
    info "DNS 模式:  $(grep 'enhanced-mode' "$CONFIG_FILE" | awk '{print $2}')"

    # fake-ip-range 检测
    local dns_mode fakeip_range
    dns_mode=$(grep 'enhanced-mode' "$CONFIG_FILE" | awk '{print $2}')
    if [ "$dns_mode" = "fake-ip" ]; then
        fakeip_range=$(grep 'fake-ip-range' "$CONFIG_FILE" | awk '{print $2}' | tr -d "'\"")
        if [ -n "$fakeip_range" ]; then
            info "Fake-IP:   $fakeip_range"
        else
            warn "Fake-IP:   未设置（将使用默认 198.18.0.0/16）"
        fi
        # 检查路由规则脚本是否存在且匹配
        if [ -f "$CONFIG_DIR/mihomo-rules.sh" ]; then
            local rule_fakeip
            rule_fakeip=$(grep 'FAKEIP=' "$CONFIG_DIR/mihomo-rules.sh" 2>/dev/null | grep -v '^\s*#' | tail -1 | grep -o '"[^"]*"' | tr -d '"')
            if [ -n "$rule_fakeip" ] && [ "$rule_fakeip" != "${fakeip_range:-198.18.0.0/16}" ]; then
                warn "路由规则中的 fake-ip-range（${rule_fakeip}）与配置不一致！"
                warn "请重新安装服务或运行「重建路由规则」修复"
            fi
        fi
    fi

    echo ""
    divider
    echo -e "  ${BOLD}代理节点:${NC}"
    grep '  - name:' "$CONFIG_FILE" | sed 's/  - name:/    •/'
    echo ""
    divider
    echo -e "  ${BOLD}策略组:${NC}"
    grep -A1 'proxy-groups:' "$CONFIG_FILE" | grep 'name:' | sed 's/.*name:/    •/'
    pause
}

_config_import() {
    require_root || { pause; return; }
    clear
    title "导入配置文件"
    printf "  请输入配置文件完整路径: "
    read -r src

    [ -z "$src" ] && { error "路径不能为空"; pause; return; }
    [ ! -f "$src" ] && { error "文件不存在: $src"; pause; return; }

    # YAML 语法校验
    if python3 -c "import yaml" 2>/dev/null; then
        if ! python3 -c "import yaml,sys; yaml.safe_load(sys.stdin)" < "$src" 2>/dev/null; then
            error "YAML 语法错误，请检查配置文件后重新导入"
            pause; return
        fi
        info "YAML 语法检查通过"
    fi

    # 备份旧配置
    if [ -f "$CONFIG_FILE" ]; then
        local bak="${CONFIG_FILE}.bak.$(date +%Y%m%d%H%M%S)"
        cp "$CONFIG_FILE" "$bak"
        info "旧配置已备份至 $bak"
    fi

    cp "$src" "$CONFIG_FILE"
    info "配置已导入到 $CONFIG_FILE"

    if systemctl is-active "$SERVICE_NAME" >/dev/null 2>&1; then
        echo ""
        if ask "服务正在运行，是否立即重启以应用新配置？" y; then
            systemctl restart "$SERVICE_NAME" && info "服务已重启" || error "重启失败"
        fi
    fi
    pause
}

_config_tree() {
    clear
    title "目录结构说明"
    echo "  $CONFIG_DIR/"
    echo -e "  ├── config.yaml     ← ${YELLOW}主配置文件（放这里）${NC}"
    echo "  ├── Country.mmdb    ← GeoIP 数据库（自动下载）"
    echo "  ├── ASN.mmdb        ← ASN 数据库（自动下载）"
    echo "  └── ruleset/        ← 规则集缓存目录"
    echo ""
    divider
    echo ""
    echo "  从本机 scp 上传配置："
    echo -e "  ${CYAN}scp /本机/config.yaml 服务器:$CONFIG_FILE${NC}"
    echo ""
    echo "  Web 控制面板（浏览器访问）："
    local ctrl
    ctrl=$(grep 'external-controller' "$CONFIG_FILE" 2>/dev/null | awk '{print $2}')
    [ -n "$ctrl" ] && echo -e "  ${CYAN}http://服务器IP:$(echo "$ctrl" | cut -d: -f2)${NC}" \
                   || echo -e "  ${DIM}（配置文件中未设置 external-controller）${NC}"
    pause
}

_config_edit() {
    require_root || { pause; return; }
    if [ ! -f "$CONFIG_FILE" ]; then
        error "配置文件不存在: $CONFIG_FILE"
        pause; return
    fi
    local editor
    if command -v nano >/dev/null 2>&1; then
        editor=nano
    elif command -v vi >/dev/null 2>&1; then
        editor=vi
    else
        error "未找到可用编辑器（nano/vi）"
        pause; return
    fi
    info "使用 ${editor} 打开配置文件..."
    sleep 1
    $editor "$CONFIG_FILE"
    echo ""
    if systemctl is-active "$SERVICE_NAME" >/dev/null 2>&1; then
        if ask "是否重启服务以应用更改？" y; then
            systemctl restart "$SERVICE_NAME" && info "服务已重启" || error "重启失败"
            pause
        fi
    fi
}

_config_update_geodata() {
    require_root || { pause; return; }
    clear
    title "更新 GeoIP/GeoSite 数据库"

    local geoip_url="https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/country.mmdb"
    local asn_url="https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/ASN.mmdb"
    local geosite_url="https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/geosite.dat"

    local dl_tool
    if command -v curl >/dev/null 2>&1; then
        dl_tool="curl"
    elif command -v wget >/dev/null 2>&1; then
        dl_tool="wget"
    else
        error "未找到 curl 或 wget"
        pause; return
    fi

    _dl_file() {
        local url="$1" dest="$2" name="$3"
        info "正在下载 ${name}..."
        if [ "$dl_tool" = "curl" ]; then
            curl -fsSL --connect-timeout 15 -o "$dest.tmp" "$url"
        else
            wget -q --timeout=15 -O "$dest.tmp" "$url"
        fi
        if [ $? -eq 0 ] && [ -s "$dest.tmp" ]; then
            [ -f "$dest" ] && cp "$dest" "${dest}.bak"
            mv "$dest.tmp" "$dest"
            info "${name} 更新成功（$(du -sh "$dest" | cut -f1)）"
        else
            rm -f "$dest.tmp"
            error "${name} 下载失败"
        fi
    }

    _dl_file "$geoip_url"   "$CONFIG_DIR/country.mmdb"  "Country.mmdb"
    _dl_file "$asn_url"     "$CONFIG_DIR/ASN.mmdb"      "ASN.mmdb"
    _dl_file "$geosite_url" "$CONFIG_DIR/geosite.dat"   "GeoSite.dat"

    echo ""
    if systemctl is-active "$SERVICE_NAME" >/dev/null 2>&1; then
        if ask "是否重启服务以加载新数据库？" y; then
            systemctl restart "$SERVICE_NAME" && info "服务已重启" || error "重启失败"
        fi
    fi
    pause
}

_config_add_rule() {
    require_root || { pause; return; }
    clear
    title "添加域名规则"

    if [ ! -f "$CONFIG_FILE" ]; then
        error "配置文件不存在: $CONFIG_FILE"
        pause; return
    fi

    echo "  此操作将在 GEOIP,LAN,DIRECT 规则之前插入新的域名规则。"
    echo ""
    printf "  请输入域名（如 example.com）: "
    read -r domain
    [ -z "$domain" ] && { error "域名不能为空"; pause; return; }

    echo ""
    echo "  规则动作:"
    echo "  1. DIRECT  （直连）"
    echo "  2. 自定义策略组"
    echo ""
    printf "  请选择 [1/2]: "
    read -r action_choice

    local action
    case "$action_choice" in
        1)
            action="DIRECT"
            ;;
        2)
            echo ""
            echo "  当前策略组列表:"
            grep -A1 'proxy-groups:' "$CONFIG_FILE" | grep 'name:' | \
                sed 's/.*name:[[:space:]]*/    • /' | sed 's/[[:space:]]*$//'
            echo ""
            printf "  请输入策略组名称: "
            read -r action
            [ -z "$action" ] && { error "策略组名称不能为空"; pause; return; }
            ;;
        *)
            error "无效选项"
            pause; return
            ;;
    esac

    echo ""
    echo "  规则类型:"
    echo "  1. DOMAIN-SUFFIX  （匹配域名及子域名）"
    echo "  2. DOMAIN         （精确匹配域名）"
    echo "  3. DOMAIN-KEYWORD （关键词匹配）"
    echo ""
    printf "  请选择 [1/2/3，默认1]: "
    read -r type_choice

    local rule_type
    case "$type_choice" in
        2) rule_type="DOMAIN" ;;
        3) rule_type="DOMAIN-KEYWORD" ;;
        *) rule_type="DOMAIN-SUFFIX" ;;
    esac

    local new_rule="    - ${rule_type},${domain},${action}"

    # 找到 GEOIP,LAN 或 GEOIP,CN 行并在之前插入
    if grep -q 'GEOIP,LAN,DIRECT' "$CONFIG_FILE"; then
        local anchor='GEOIP,LAN,DIRECT'
    elif grep -q 'GEOIP,CN,DIRECT' "$CONFIG_FILE"; then
        local anchor='GEOIP,CN,DIRECT'
    else
        error "未找到 GEOIP,LAN,DIRECT 或 GEOIP,CN,DIRECT 锚点行，无法自动插入"
        pause; return
    fi

    # 备份
    cp "$CONFIG_FILE" "${CONFIG_FILE}.bak.$(date +%Y%m%d%H%M%S)"

    # 在锚点行前插入
    sed -i "/${anchor}/i\\${new_rule}" "$CONFIG_FILE"

    echo ""
    info "已添加规则: ${new_rule}"

    if systemctl is-active "$SERVICE_NAME" >/dev/null 2>&1; then
        if ask "是否重启服务以应用规则？" y; then
            systemctl restart "$SERVICE_NAME" && info "服务已重启" || error "重启失败"
        fi
    fi
    pause
}

_config_rebuild_rules() {
    require_root || { pause; return; }
    clear
    title "重建路由规则"

    if [ ! -f "$CONFIG_FILE" ]; then
        error "配置文件不存在: $CONFIG_FILE"
        pause; return
    fi

    # 读取当前 fake-ip-range
    local dns_mode fakeip
    dns_mode=$(grep 'enhanced-mode' "$CONFIG_FILE" | awk '{print $2}')
    fakeip=$(grep 'fake-ip-range' "$CONFIG_FILE" | awk '{print $2}' | tr -d "'\"")
    [ -z "$fakeip" ] && fakeip="198.18.0.0/16"

    info "DNS 模式:       $dns_mode"
    info "Fake-IP Range:  $fakeip"

    # 检查现有规则脚本
    if [ -f "$CONFIG_DIR/mihomo-rules.sh" ]; then
        local old_fakeip
        old_fakeip=$(grep 'FAKEIP=' "$CONFIG_DIR/mihomo-rules.sh" 2>/dev/null | grep -v '^\s*#' | tail -1 | grep -o '"[^"]*"' | tr -d '"')
        if [ -n "$old_fakeip" ] && [ "$old_fakeip" = "$fakeip" ]; then
            info "路由规则已是最新，无需重建"
            pause; return
        fi
        [ -n "$old_fakeip" ] && warn "当前规则中的范围: $old_fakeip → 将更新为: $fakeip"
    else
        warn "路由规则脚本不存在，将创建"
    fi

    echo ""
    if ! ask "确认重建路由规则？" y; then
        pause; return
    fi

    # 先清理旧规则
    [ -x "$CONFIG_DIR/mihomo-rules.sh" ] && "$CONFIG_DIR/mihomo-rules.sh" del 2>/dev/null

    # 重新生成规则脚本
    cat > "$CONFIG_DIR/mihomo-rules.sh" << 'RULES'
#!/bin/bash
# Mihomo TUN 路由修正脚本
# 由 mihomo-manager 自动生成，请勿手动修改
ACTION="${1:-add}"
CONFIG="/etc/mihomo/config.yaml"

# 检测默认出口网卡
IFACE=$(ip route show default 2>/dev/null | awk '/^default/{print $5}' | head -1)

# 从配置文件读取 fake-ip-range，未配置则使用默认值
FAKEIP=$(grep 'fake-ip-range' "$CONFIG" 2>/dev/null | awk '{print $2}' | tr -d "'\"" | head -1)
[ -z "$FAKEIP" ] && FAKEIP="198.18.0.0/16"

# 规则 1: 公网入站走 main（防止被 TUN 劫持）
[ -n "$IFACE" ] && ip rule "$ACTION" priority 100 iif "$IFACE" lookup main 2>/dev/null || true

# 规则 2: Docker 容器访问 fake-ip → 送回 Mihomo（DNS 还原）
ip rule "$ACTION" priority 190 from 172.16.0.0/12 to "$FAKEIP" lookup 2022 2>/dev/null || true

# 规则 3: Docker 其余流量（DNAT 回包等）→ main 直连
ip rule "$ACTION" priority 200 from 172.16.0.0/12 lookup main 2>/dev/null || true
RULES
    chmod +x "$CONFIG_DIR/mihomo-rules.sh"
    info "规则脚本已重建"

    # 应用新规则
    "$CONFIG_DIR/mihomo-rules.sh" add
    info "新规则已应用"

    echo ""
    echo -e "  ${BOLD}当前 ip rule:${NC}"
    ip rule show | grep -E 'priority (100|190|200)' | sed 's/^/    /'
    pause
}

menu_update() {
    require_root || { pause; return; }
    clear
    title "更新 Mihomo"

    local current latest
    current=$("$BINARY" -v 2>/dev/null | grep -o 'v[0-9.]*' | head -1 || echo "未安装")
    info "当前版本: $current"
    info "正在检查最新版本..."
    latest=$(curl -s --max-time 15 "$LATEST_VERSION_API" | grep '"tag_name"' | head -1 | grep -o 'v[0-9.]*')

    if [ -z "$latest" ]; then
        error "无法获取版本信息"; pause; return
    fi

    info "最新版本: $latest"

    if [ "$current" = "$latest" ]; then
        echo ""
        info "已是最新版本，无需更新"
        pause; return
    fi

    echo ""
    if ask "发现新版本 $latest，是否立即更新？" y; then
        systemctl stop "$SERVICE_NAME" 2>/dev/null || true
        menu_install
        systemctl start "$SERVICE_NAME" 2>/dev/null || true
    fi
}

# ════════════════════════════════════════════════════════════
#  诊断与监控
# ════════════════════════════════════════════════════════════
menu_test() {
    clear
    title "网络连通性测试"

    local port
    port=$(grep 'mixed-port' "$CONFIG_FILE" 2>/dev/null | awk '{print $2}' || echo "7890")

    local tmp
    tmp=$(mktemp -d)
    # shellcheck disable=SC2064
    trap "rm -rf '$tmp'" RETURN

    echo -e "  ${DIM}并行检测中，请稍候（最长约 15 秒）...${NC}"
    echo ""

    # ── 后台测试工作函数 ──────────────────────────────────────
    # 用法: _bg_test <id> <url> [trace_url]
    # 若提供 trace_url，则请求 trace_url（Cloudflare cdn-cgi/trace），
    # 同时从响应体提取出口 IP。
    # 结果写入 $tmp/<id>，格式: "CODE|ELAPSED|IP"
    _bg_test() {
        local id="$1" url="$2" trace_url="${3:-}"
        local fetch_url="${trace_url:-$url}"
        local tmpbody code elapsed ip=""
        tmpbody=$(mktemp)
        read -r code elapsed < <(
            curl -s --max-time 12 -o "$tmpbody" \
                 -w "%{http_code} %{time_total}" "$fetch_url" 2>/dev/null
        )
        if [ -n "$trace_url" ]; then
            ip=$(grep '^ip=' "$tmpbody" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
        fi
        printf "%s|%s|%s" "${code:-0}" "${elapsed:-0}" "$ip" > "$tmp/$id"
        rm -f "$tmpbody"
    }

    # ── 启动所有并行任务 ──────────────────────────────────────
    # 出口 IP 检测（TUN 直连 & HTTP 代理）
    curl -s --max-time 8 "https://api.ipify.org"  \
        > "$tmp/egress_tun"   2>/dev/null &
    curl -s --max-time 8 --proxy "http://127.0.0.1:$port" "https://api.ipify.org" \
        > "$tmp/egress_proxy" 2>/dev/null &

    # 常用网站
    _bg_test "google"      "https://www.google.com"          &
    _bg_test "youtube"     "https://www.youtube.com"         &
    _bg_test "github"      "https://github.com"              &
    _bg_test "twitter"     "https://twitter.com"             &
    _bg_test "discord"     "https://discord.com"             &
    _bg_test "netflix"     "https://www.netflix.com"         &
    _bg_test "spotify"     "https://www.spotify.com"         &
    _bg_test "wikipedia"   "https://www.wikipedia.org"       &
    _bg_test "baidu"       "https://www.baidu.com"           &

    # AI 服务（Claude/ChatGPT 通过 cdn-cgi/trace 同时获取出口 IP）
    _bg_test "claude"      "https://claude.ai" \
             "https://claude.ai/cdn-cgi/trace"                &
    _bg_test "chatgpt"     "https://chatgpt.com" \
             "https://chatgpt.com/cdn-cgi/trace"              &
    _bg_test "openai_api"  "https://api.openai.com"          &
    _bg_test "gemini"      "https://gemini.google.com"       &
    _bg_test "perplexity"  "https://www.perplexity.ai"       &
    _bg_test "telegram"    "https://telegram.org"            &

    wait  # 等待所有后台任务完成

    # ── 结果显示函数 ──────────────────────────────────────────
    _show_result() {
        local name="$1" id="$2"
        local result code elapsed ip time_str
        result=$(cat "$tmp/$id" 2>/dev/null || echo "0|0|")
        code="${result%%|*}"
        elapsed=$(echo "$result" | cut -d'|' -f2)
        ip=$(echo "$result" | cut -d'|' -f3)
        time_str=$(awk "BEGIN{t=${elapsed:-0}+0; \
            if(t<=0) print \"  --  \"; \
            else if(t<1) printf \"%5.0fms\",t*1000; \
            else printf \"%5.1fs\",t}" 2>/dev/null)

        printf "  %-26s" "$name"
        local c="${code:-0}"
        if [ "$c" -ge 200 ] && [ "$c" -lt 400 ] 2>/dev/null; then
            if [ -n "$ip" ]; then
                printf "${GREEN}✓ %-3s${NC}  ${DIM}%s  出口: %s${NC}\n" \
                    "$c" "$time_str" "$ip"
            else
                printf "${GREEN}✓ %-3s${NC}  ${DIM}%s${NC}\n" "$c" "$time_str"
            fi
        elif [ "$c" -ge 400 ] 2>/dev/null; then
            printf "${YELLOW}~ %-3s${NC}  ${DIM}%s  (可达，HTTP %s)${NC}\n" \
                "$c" "$time_str" "$c"
        else
            printf "${RED}✗ 超时/不可达${NC}\n"
        fi
    }

    # ── 输出结果 ──────────────────────────────────────────────
    local egress_tun egress_proxy
    egress_tun=$(cat "$tmp/egress_tun" 2>/dev/null)
    egress_proxy=$(cat "$tmp/egress_proxy" 2>/dev/null)

    if [ -n "$egress_tun" ]; then
        echo -e "  TUN  出口 IP : ${BOLD}${CYAN}$egress_tun${NC}"
    else
        echo -e "  TUN  出口 IP : ${DIM}获取失败（TUN 未启用？）${NC}"
    fi
    if [ -n "$egress_proxy" ]; then
        echo -e "  代理 出口 IP : ${BOLD}${CYAN}$egress_proxy${NC}"
    else
        echo -e "  代理 出口 IP : ${DIM}获取失败（Mihomo 未运行？）${NC}"
    fi

    echo ""
    divider
    echo ""
    echo -e "  ${BOLD}[ 常用网站 ]${NC}"
    echo ""
    _show_result "Google"        "google"
    _show_result "YouTube"       "youtube"
    _show_result "GitHub"        "github"
    _show_result "Twitter / X"   "twitter"
    _show_result "Discord"       "discord"
    _show_result "Netflix"       "netflix"
    _show_result "Spotify"       "spotify"
    _show_result "Wikipedia"     "wikipedia"
    _show_result "Baidu"         "baidu"
    echo ""
    divider
    echo ""
    echo -e "  ${BOLD}[ AI 服务 ]${NC}"
    echo ""
    _show_result "Claude (claude.ai)"    "claude"
    _show_result "ChatGPT"               "chatgpt"
    _show_result "OpenAI API"            "openai_api"
    _show_result "Gemini"                "gemini"
    _show_result "Perplexity"            "perplexity"
    _show_result "Telegram"              "telegram"
    echo ""
    echo -e "  ${DIM}✓=正常  ~=可达(需认证)  ✗=超时/不可达${NC}"
    echo -e "  ${DIM}出口 IP 仅 Cloudflare 站点(Claude/ChatGPT)支持逐站显示${NC}"
    pause
}

menu_log() {
    while true; do
        clear
        title "查看日志"
        echo "  1. 最近 50 条"
        echo "  2. 最近 100 条"
        echo "  3. 实时日志（Ctrl+C 退出后按 Enter 返回）"
        echo "  0. 返回"
        echo ""
        printf "  请输入选项: "
        read -r c
        case "$c" in
            1) clear; journalctl -u "$SERVICE_NAME" --no-pager -n 50; pause ;;
            2) clear; journalctl -u "$SERVICE_NAME" --no-pager -n 100; pause ;;
            3) clear; journalctl -u "$SERVICE_NAME" -f; pause ;;
            0) return ;;
            *) error "无效选项"; sleep 1 ;;
        esac
    done
}

# ════════════════════════════════════════════════════════════
#  Tailscale 管理
# ════════════════════════════════════════════════════════════
menu_tailscale_manage() {
    while true; do
        clear
        title "Tailscale 管理"

        # 状态摘要
        if command -v tailscale >/dev/null 2>&1; then
            local ts_svc ts_ip
            systemctl is-active tailscaled >/dev/null 2>&1 \
                && ts_svc="${GREEN}运行中${NC}" || ts_svc="${RED}已停止${NC}"
            ts_ip=$(tailscale ip 2>/dev/null | head -1 || echo "未连接")
            echo -e "  服务: $ts_svc  |  IP: ${CYAN}$ts_ip${NC}"
        else
            warn "Tailscale 未安装"
        fi

        echo ""
        echo "  1. 查看状态与设备列表"
        echo "  2. 连接 Tailscale 网络"
        echo "  3. 断开 Tailscale 网络"
        echo "  4. 重启 tailscaled 服务"
        divider
        echo "  5. 安装 Tailscale"
        echo "  6. 卸载 Tailscale"
        echo "  0. 返回"
        echo ""
        printf "  请输入选项: "
        read -r c
        case "$c" in
            1) _ts_status ;;
            2) _ts_up ;;
            3) _ts_down ;;
            4) _ts_restart ;;
            5) _ts_install ;;
            6) _ts_uninstall ;;
            0) return ;;
            *) error "无效选项"; sleep 1 ;;
        esac
    done
}

_ts_check() {
    command -v tailscale >/dev/null 2>&1 || { error "Tailscale 未安装，请先选择「安装 Tailscale」"; pause; return 1; }
}

_ts_status() {
    _ts_check || return
    clear
    title "Tailscale 状态"

    systemctl is-active tailscaled >/dev/null 2>&1 \
        && info "服务状态: ${GREEN}● 运行中${NC}" || error "服务状态: ● 已停止"

    info "本机 IP:  ${CYAN}$(tailscale ip 2>/dev/null | head -1 || echo '未连接')${NC}"
    echo ""
    divider
    echo ""
    tailscale status 2>/dev/null || warn "未连接到 Tailscale 网络"
    pause
}

_ts_up() {
    _ts_check || return
    require_root || { pause; return; }
    clear
    title "连接 Tailscale 网络"

    local extra=""
    if ask "是否接受其他节点共享的子网路由？（不确定选 n）" n; then
        extra="--accept-routes"
    fi
    echo ""

    if ! tailscale status >/dev/null 2>&1; then
        warn "尚未登录，请选择认证方式："
        echo ""
        echo "  1. URL 登录（浏览器扫码）"
        echo "  2. Auth Key 登录（从 Tailscale 控制台生成）"
        echo "  0. 取消"
        echo ""
        printf "  请输入选项: "
        read -r login_choice

        case "$login_choice" in
            1) _ts_login_url "$extra" ;;
            2) _ts_login_key "$extra" ;;
            *) return ;;
        esac
    else
        tailscale up $extra 2>&1 && info "已连接到 Tailscale 网络" || error "连接失败"
    fi

    echo ""
    local ts_ip
    ts_ip=$(tailscale ip 2>/dev/null | head -1)
    [ -n "$ts_ip" ] && info "本机 Tailscale IP: $ts_ip"
    pause
}

_ts_login_url() {
    local extra="$1"
    local ts_sock="/var/run/tailscale/tailscaled.sock"
    local ts_api="http://local-tailscaled.sock/localapi/v0/status"

    info "正在获取认证链接..."
    echo ""

    local _get_auth_url
    _get_auth_url() {
        curl -s --unix-socket "$ts_sock" "$ts_api" 2>/dev/null \
            | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('AuthURL',''))" 2>/dev/null
    }

    # 先检查是否已有 AuthURL（上次登录流程留下的）
    local auth_url
    auth_url=$(_get_auth_url)

    # 没有的话，后台启动 tailscale login 触发生成，再轮询
    if [ -z "$auth_url" ]; then
        tailscale login >/dev/null 2>&1 &
        local ts_pid=$!
        local i=0
        while [ $i -lt 30 ]; do
            sleep 0.5
            auth_url=$(_get_auth_url)
            [ -n "$auth_url" ] && break
            i=$((i + 1))
        done
        kill "$ts_pid" 2>/dev/null || true
    fi

    if [ -n "$auth_url" ]; then
        echo -e "  请在浏览器中打开以下链接完成认证："
        echo ""
        echo -e "  ${BOLD}${CYAN}$auth_url${NC}"
        echo ""
        echo -e "  ${DIM}提示：在登录页面可选择「Use a different sign-in method」${NC}"
        echo -e "  ${DIM}→ 输入邮箱接收验证码，无需 Google/GitHub OAuth 跳转${NC}"
        echo ""
        warn "认证完成后按 Enter 继续..."
        read -r
        echo ""
        info "正在建立连接..."
        tailscale up $extra 2>&1 && info "已连接到 Tailscale 网络" || error "连接失败，请稍后重试"
    else
        error "未能获取认证链接"
        echo ""
        warn "可能原因：代理节点无法访问 Tailscale 服务器"
        warn "建议切换代理节点后重试，或改用 Auth Key 方式登录"
        warn "Auth Key 生成地址：https://login.tailscale.com/admin/authkeys"
    fi
}

_ts_login_key() {
    local extra="$1"
    echo ""
    warn "请先在浏览器打开以下地址生成 Auth Key："
    echo ""
    echo -e "  ${BOLD}${CYAN}https://login.tailscale.com/admin/authkeys${NC}"
    echo ""
    warn "建议勾选 Reusable（可复用），方便多台服务器使用同一个 key"
    echo ""
    printf "  请粘贴 Auth Key（tskey-auth-xxx...）: "
    read -r auth_key

    if [ -z "$auth_key" ]; then
        error "Auth Key 不能为空"; return
    fi

    echo ""
    info "正在使用 Auth Key 连接..."
    tailscale up --auth-key="$auth_key" $extra 2>&1 \
        && info "已连接到 Tailscale 网络" \
        || error "连接失败，请检查 Auth Key 是否有效"
}

_ts_down() {
    _ts_check || return
    require_root || { pause; return; }
    clear
    title "断开 Tailscale 网络"
    ask "确定要断开 Tailscale 网络连接吗？（tailscaled 服务仍会保持运行）" n || return
    tailscale down && info "已断开 Tailscale 网络" || error "断开失败"
    pause
}

_ts_restart() {
    require_root || { pause; return; }
    _ts_check || return
    clear
    title "重启 tailscaled 服务"
    systemctl restart tailscaled && info "tailscaled 已重启" || error "重启失败"
    sleep 1
    systemctl status tailscaled --no-pager | tail -5
    pause
}

_ts_install() {
    require_root || { pause; return; }
    clear
    title "安装 Tailscale"

    if command -v tailscale >/dev/null 2>&1; then
        info "Tailscale 已安装: $(tailscale version 2>/dev/null | head -1)"
        pause; return
    fi

    info "正在下载并运行官方安装脚本..."
    echo ""
    if curl -fsSL https://tailscale.com/install.sh | sh; then
        echo ""
        info "安装成功！版本: $(tailscale version 2>/dev/null | head -1)"
        echo ""
        warn "下一步：选择「连接 Tailscale 网络」完成认证登录"
        if ! _tailscale_compat_enabled; then
            echo ""
            warn "建议返回主菜单开启「Tailscale 兼容设置」，避免与 Mihomo 冲突"
        fi
    else
        error "安装失败，请检查网络连接"
    fi
    pause
}

_ts_uninstall() {
    require_root || { pause; return; }
    _ts_check || return
    clear
    title "卸载 Tailscale"
    ask "确定要卸载 Tailscale 吗？" n || return
    echo ""

    tailscale down 2>/dev/null || true
    systemctl stop tailscaled 2>/dev/null || true

    if command -v apt >/dev/null 2>&1; then
        apt-get remove -y tailscale && info "已通过 apt 卸载"
    elif command -v yum >/dev/null 2>&1; then
        yum remove -y tailscale && info "已通过 yum 卸载"
    else
        rm -f /usr/bin/tailscale /usr/sbin/tailscaled
        rm -f /etc/systemd/system/tailscaled.service
        systemctl daemon-reload
        info "已手动删除 Tailscale 文件"
    fi

    if _tailscale_compat_enabled; then
        echo ""
        warn "Tailscale 已卸载，建议返回主菜单关闭「Tailscale 兼容设置」"
    fi
    pause
}

# ════════════════════════════════════════════════════════════
#  Tailscale 兼容设置
# ════════════════════════════════════════════════════════════
_tailscale_compat_enabled() {
    [ -f "$CONFIG_FILE" ] && grep -q 'tailscale0' "$CONFIG_FILE"
}

menu_tailscale_compat() {
    clear
    title "Tailscale 兼容设置"

    if _tailscale_compat_enabled; then
        info "当前状态: ${GREEN}已启用${NC}"
        local ts_ip
        ts_ip=$(ip addr show tailscale0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
        [ -n "$ts_ip" ] && info "Tailscale IP: $ts_ip"
    else
        warn "当前状态: 未启用"
    fi

    echo ""
    echo "  此设置修改 Mihomo 配置，防止与 Tailscale 流量冲突："
    echo "  • tun.exclude-interface: tailscale0"
    echo "  • dns.fake-ip-filter: *.ts.net"
    echo "  • rules: 100.64.0.0/10 → DIRECT"
    echo "  • rules: tailscaled 进程 → DIRECT"
    echo ""
    divider

    if _tailscale_compat_enabled; then
        echo ""
        echo "  1. 关闭兼容设置"
        echo "  0. 返回"
        echo ""
        printf "  请输入选项: "
        read -r c
        [ "$c" = "1" ] && _tailscale_compat_disable
    else
        echo ""
        echo "  1. 启用兼容设置"
        echo "  0. 返回"
        echo ""
        printf "  请输入选项: "
        read -r c
        [ "$c" = "1" ] && _tailscale_compat_enable
    fi
}

_tailscale_compat_enable() {
    require_root || { pause; return; }
    clear
    title "启用 Tailscale 兼容"

    # tun exclude-interface
    if grep -q 'exclude-interface' "$CONFIG_FILE"; then
        grep -q 'tailscale0' "$CONFIG_FILE" \
            && info "exclude-interface 已包含 tailscale0，跳过" \
            || { sed -i '/exclude-interface:/a\    - tailscale0' "$CONFIG_FILE"; info "已添加 tun.exclude-interface: tailscale0"; }
    else
        sed -i '/dns-hijack:/i\  exclude-interface:\n    - tailscale0' "$CONFIG_FILE"
        info "已添加 tun.exclude-interface: tailscale0"
    fi

    # fake-ip-filter
    if grep -q 'fake-ip-filter' "$CONFIG_FILE"; then
        grep -q 'ts.net' "$CONFIG_FILE" \
            && info "fake-ip-filter 已包含 *.ts.net，跳过" \
            || { sed -i "/fake-ip-filter:/a\    - '*.ts.net'" "$CONFIG_FILE"; info "已添加 dns.fake-ip-filter: *.ts.net"; }
    else
        sed -i "/enhanced-mode:/a\  fake-ip-filter:\n    - '*.ts.net'" "$CONFIG_FILE"
        info "已添加 dns.fake-ip-filter: *.ts.net"
    fi

    # 路由规则
    if ! grep -q '100.64.0.0/10' "$CONFIG_FILE"; then
        sed -i '/- GEOIP,LAN,DIRECT/i\  - IP-CIDR,100.64.0.0\/10,DIRECT,no-resolve\n  - IP-CIDR,100.100.100.100\/32,DIRECT\n  - PROCESS-NAME,tailscaled,DIRECT' "$CONFIG_FILE"
        info "已添加 Tailscale IP 段直连规则"
    else
        info "Tailscale 规则已存在，跳过"
    fi

    echo ""
    if systemctl is-active "$SERVICE_NAME" >/dev/null 2>&1; then
        systemctl restart "$SERVICE_NAME" && info "Mihomo 已重启，配置生效" || error "重启失败"
    else
        warn "Mihomo 未运行，下次启动时生效"
    fi
    pause
}

_tailscale_compat_disable() {
    require_root || { pause; return; }
    clear
    title "关闭 Tailscale 兼容"

    sed -i '/tailscale0/d' "$CONFIG_FILE"
    sed -i "/'\*\.ts\.net'/d" "$CONFIG_FILE"
    sed -i '/100\.64\.0\.0\/10/d' "$CONFIG_FILE"
    sed -i '/100\.100\.100\.100/d' "$CONFIG_FILE"
    sed -i '/PROCESS-NAME,tailscaled/d' "$CONFIG_FILE"
    info "已移除所有 Tailscale 兼容配置"

    echo ""
    if systemctl is-active "$SERVICE_NAME" >/dev/null 2>&1; then
        systemctl restart "$SERVICE_NAME" && info "Mihomo 已重启，配置生效" || error "重启失败"
    fi
    pause
}

# ════════════════════════════════════════════════════════════
#  脚本自更新
# ════════════════════════════════════════════════════════════
menu_self_update() {
    require_root || { pause; return; }
    clear
    title "脚本自更新"

    info "当前版本: v$SCRIPT_VERSION"
    info "正在检查最新版本（最长等待 30 秒）..."

    local latest_ver
    latest_ver=$(curl -fsSL --max-time 30 "$SCRIPT_VERSION_URL" 2>/dev/null | tr -d '[:space:]')

    if [ -z "$latest_ver" ]; then
        error "无法获取版本信息"
        echo ""
        warn "可能原因：raw.githubusercontent.com 网络延迟过高，可稍后重试"
        warn "或手动更新："
        echo ""
        echo "  curl -Lo $SCRIPT_PATH $SCRIPT_RAW_URL && chmod +x $SCRIPT_PATH"
        pause; return
    fi

    info "最新版本: v$latest_ver"

    if [ "$SCRIPT_VERSION" = "$latest_ver" ]; then
        echo ""
        info "已是最新版本，无需更新"
        pause; return
    fi

    echo ""
    ask "发现新版本 v$latest_ver，是否立即更新？" y || return

    clear
    title "下载更新..."

    local tmp_script
    tmp_script=$(mktemp /tmp/mihomo-manager-XXXXXX.sh)

    if curl -fsSL --max-time 60 -o "$tmp_script" "$SCRIPT_RAW_URL"; then
        if ! bash -n "$tmp_script" 2>/dev/null; then
            error "下载的文件校验失败，已中止更新"
            rm -f "$tmp_script"; pause; return
        fi

        chmod +x "$tmp_script"
        cp "$SCRIPT_PATH" "${SCRIPT_PATH}.bak"
        info "已备份当前版本到 ${SCRIPT_PATH}.bak"
        mv "$tmp_script" "$SCRIPT_PATH"
        info "更新完成！v$SCRIPT_VERSION → v$latest_ver"
        echo ""
        warn "即将重新启动..."
        sleep 2
        exec "$SCRIPT_PATH"
    else
        rm -f "$tmp_script"
        error "下载失败，更新已中止"
        warn "可手动更新："
        echo ""
        echo "  curl -Lo $SCRIPT_PATH $SCRIPT_RAW_URL && chmod +x $SCRIPT_PATH"
        pause
    fi
}

# ════════════════════════════════════════════════════════════
#  系统网络设置
# ════════════════════════════════════════════════════════════
_ipv6_enabled() {
    [ "$(cat /proc/sys/net/ipv6/conf/all/disable_ipv6 2>/dev/null)" = "0" ]
}

menu_network_settings() {
    while true; do
        clear
        title "系统网络设置"

        if _ipv6_enabled; then
            echo -e "  IPv6 状态: ${GREEN}● 已启用${NC}"
        else
            echo -e "  IPv6 状态: ${YELLOW}● 已禁用${NC}"
        fi

        echo ""
        echo "  1. 启用 IPv6"
        echo "  2. 禁用 IPv6"
        echo "  3. 查看当前 IPv6 地址"
        echo "  0. 返回"
        echo ""
        printf "  请输入选项: "
        read -r c
        case "$c" in
            1) _ipv6_enable ;;
            2) _ipv6_disable ;;
            3) _ipv6_show ;;
            0) return ;;
            *) error "无效选项"; sleep 1 ;;
        esac
    done
}

_ipv6_enable() {
    require_root || { pause; return; }
    clear
    title "启用 IPv6"

    sysctl -w net.ipv6.conf.all.disable_ipv6=0 >/dev/null
    sysctl -w net.ipv6.conf.default.disable_ipv6=0 >/dev/null
    sysctl -w net.ipv6.conf.lo.disable_ipv6=0 >/dev/null
    info "IPv6 已立即启用"

    # 写入持久化配置
    local conf="/etc/sysctl.d/99-disable-ipv6.conf"
    cat > "$conf" << 'EOF'
net.ipv6.conf.all.disable_ipv6 = 0
net.ipv6.conf.default.disable_ipv6 = 0
net.ipv6.conf.lo.disable_ipv6 = 0
EOF
    info "持久化配置已写入 $conf（重启后仍生效）"

    # 清理 sysctl.conf 中可能存在的冲突旧配置
    if grep -q 'disable_ipv6' /etc/sysctl.conf 2>/dev/null; then
        sed -i '/disable_ipv6/d' /etc/sysctl.conf
        info "已清理 /etc/sysctl.conf 中的旧配置"
    fi

    echo ""
    echo -e "  ${BOLD}当前 IPv6 地址:${NC}"
    ip -6 addr show scope global 2>/dev/null | grep inet6 | awk '{print "    " $2}' \
        || warn "暂无全局 IPv6 地址（需等待网卡从 ISP 获取）"
    pause
}

_ipv6_disable() {
    require_root || { pause; return; }
    clear
    title "禁用 IPv6"
    warn "禁用后依赖 IPv6 的服务可能受影响"
    ask "确定要禁用 IPv6 吗？" n || return
    echo ""

    sysctl -w net.ipv6.conf.all.disable_ipv6=1 >/dev/null
    sysctl -w net.ipv6.conf.default.disable_ipv6=1 >/dev/null
    sysctl -w net.ipv6.conf.lo.disable_ipv6=1 >/dev/null
    info "IPv6 已立即禁用"

    # 写入持久化配置
    local conf="/etc/sysctl.d/99-disable-ipv6.conf"
    cat > "$conf" << 'EOF'
net.ipv6.conf.all.disable_ipv6 = 1
net.ipv6.conf.default.disable_ipv6 = 1
net.ipv6.conf.lo.disable_ipv6 = 1
EOF
    info "持久化配置已写入 $conf（重启后仍生效）"

    # 清理 sysctl.conf 中可能存在的冲突旧配置
    if grep -q 'disable_ipv6' /etc/sysctl.conf 2>/dev/null; then
        sed -i '/disable_ipv6/d' /etc/sysctl.conf
        info "已清理 /etc/sysctl.conf 中的旧配置"
    fi

    pause
}

_ipv6_show() {
    clear
    title "IPv6 地址信息"
    if _ipv6_enabled; then
        info "IPv6 状态: 已启用"
    else
        warn "IPv6 状态: 已禁用"
    fi
    echo ""
    echo -e "  ${BOLD}各网卡 IPv6 地址:${NC}"
    ip -6 addr show 2>/dev/null | grep -E '(^[0-9]+:|inet6)' | sed 's/^/  /' \
        || warn "无 IPv6 地址信息"
    echo ""
    echo -e "  ${BOLD}IPv6 路由:${NC}"
    ip -6 route show default 2>/dev/null | sed 's/^/  /' || warn "无 IPv6 默认路由"
    pause
}

# ════════════════════════════════════════════════════════════
#  Docker 代理设置
# ════════════════════════════════════════════════════════════
DOCKER_PROXY_CONF="/etc/systemd/system/docker.service.d/proxy.conf"
DOCKER_DAEMON_JSON="/etc/docker/daemon.json"

# 检测 Docker 是由系统（飞牛OS/群晖等 NAS）托管还是标准 systemd 方式
_docker_is_nas_managed() {
    # 飞牛OS 的 docker.service 描述含 "trim"，或 daemon.json 有 data-root 非默认路径
    systemctl cat docker 2>/dev/null | grep -qi 'trim\|fnos\|fnnas' && return 0
    local data_root
    data_root=$(python3 -c "import json,sys; d=json.load(open('$DOCKER_DAEMON_JSON')); print(d.get('data-root',''))" 2>/dev/null)
    [ -n "$data_root" ] && [ "$data_root" != "/var/lib/docker" ] && return 0
    return 1
}

_docker_proxy_enabled_systemd() {
    [ -f "$DOCKER_PROXY_CONF" ] && grep -q 'HTTP_PROXY' "$DOCKER_PROXY_CONF" 2>/dev/null
}

_docker_proxy_enabled_daemonjson() {
    [ -f "$DOCKER_DAEMON_JSON" ] && python3 -c "
import json,sys
d=json.load(open('$DOCKER_DAEMON_JSON'))
p=d.get('proxies',{})
sys.exit(0 if p.get('http-proxy') or p.get('https-proxy') else 1)
" 2>/dev/null
}

_docker_proxy_enabled() {
    _docker_proxy_enabled_systemd || _docker_proxy_enabled_daemonjson
}

menu_docker_proxy() {
    while true; do
        clear
        title "Docker 代理设置"

        if ! command -v docker >/dev/null 2>&1; then
            warn "Docker 未安装或当前用户无权访问"
            echo ""
            echo -e "  ${DIM}提示: Docker 可能需要 root 或 docker 组权限${NC}"
            echo ""
            echo "  0. 返回"
            echo ""
            printf "  请输入选项: "
            read -r _c; return
        fi

        local port
        port=$(grep 'mixed-port' "$CONFIG_FILE" 2>/dev/null | awk '{print $2}' | head -1)
        port="${port:-7890}"
        local docker_host_ip="172.17.0.1"

        # 检测 Docker 托管类型
        local managed_type="标准 systemd"
        _docker_is_nas_managed && managed_type="${YELLOW}NAS 系统托管（飞牛OS等）${NC}"

        echo -e "  Docker 托管方式: ${managed_type}"
        echo ""

        # 显示当前代理状态
        if _docker_proxy_enabled_systemd; then
            local cur
            cur=$(grep 'HTTPS_PROXY' "$DOCKER_PROXY_CONF" 2>/dev/null | grep -o 'http[^"]*' | head -1)
            echo -e "  daemon 代理（systemd）: ${GREEN}● 已启用${NC}  ${DIM}${cur}${NC}"
        else
            echo -e "  daemon 代理（systemd）: ${DIM}● 未配置${NC}"
        fi

        if _docker_proxy_enabled_daemonjson; then
            local cur2
            cur2=$(python3 -c "import json; d=json.load(open('$DOCKER_DAEMON_JSON')); print(d.get('proxies',{}).get('https-proxy',''))" 2>/dev/null)
            echo -e "  daemon 代理（daemon.json）: ${GREEN}● 已启用${NC}  ${DIM}${cur2}${NC}"
        else
            echo -e "  daemon 代理（daemon.json）: ${DIM}● 未配置${NC}"
        fi

        echo ""
        divider
        echo -e "  ${BOLD}两种代理方式说明:${NC}"
        echo -e "  ${CYAN}A. systemd 方式${NC}  适合标准 Linux，daemon 拉镜像走代理"
        echo -e "  ${CYAN}B. daemon.json 方式${NC}  适合飞牛OS/群晖等，容器内程序也走代理"
        echo -e "  ${DIM}（Dify 插件安装失败请用 B 方式）${NC}"
        echo ""
        echo -e "  1. 启用代理 - A（systemd drop-in）  ${YELLOW}[需要root]${NC}"
        echo -e "  2. 启用代理 - B（daemon.json）      ${YELLOW}[需要root]${NC}"
        echo -e "  3. 禁用全部代理配置                 ${YELLOW}[需要root]${NC}"
        echo "  4. 测试 Docker 容器网络"
        echo "  0. 返回"
        echo ""
        printf "  请输入选项: "
        read -r c
        case "$c" in
            1) _docker_proxy_enable_systemd ;;
            2) _docker_proxy_enable_daemonjson ;;
            3) _docker_proxy_disable ;;
            4) _docker_proxy_test ;;
            0) return ;;
            *) error "无效选项"; sleep 1 ;;
        esac
    done
}

_docker_proxy_enable_systemd() {
    require_root || { pause; return; }
    clear
    title "启用 Docker daemon 代理（systemd 方式）"

    local port
    port=$(grep 'mixed-port' "$CONFIG_FILE" 2>/dev/null | awk '{print $2}' | head -1)
    port="${port:-7890}"

    mkdir -p /etc/systemd/system/docker.service.d
    cat > "$DOCKER_PROXY_CONF" << EOF
[Service]
Environment="HTTP_PROXY=http://127.0.0.1:${port}"
Environment="HTTPS_PROXY=http://127.0.0.1:${port}"
Environment="NO_PROXY=localhost,127.0.0.1,172.16.0.0/12,192.168.0.0/16,10.0.0.0/8"
EOF
    info "代理配置已写入 $DOCKER_PROXY_CONF"
    systemctl daemon-reload

    if systemctl is-active docker >/dev/null 2>&1; then
        if ask "是否立即重启 Docker daemon 使配置生效？" y; then
            systemctl restart docker && info "Docker daemon 已重启，代理生效" || error "重启失败"
        else
            warn "下次重启 Docker daemon 后生效"
        fi
    fi

    echo ""
    warn "注意: 此方式只影响 daemon 拉取镜像，容器内程序还需单独设代理环境变量"
    echo -e "  ${DIM}如需容器内也走代理，请改用选项 2（daemon.json 方式）${NC}"
    pause
}

_docker_proxy_enable_daemonjson() {
    require_root || { pause; return; }
    clear
    title "启用 Docker 代理（daemon.json 方式）"
    echo -e "  ${DIM}此方式修改 /etc/docker/daemon.json，适合飞牛OS等 NAS 系统${NC}"
    echo -e "  ${DIM}配置后容器内的 pip/curl/wget 等程序也会自动走代理${NC}"
    echo ""

    local port
    port=$(grep 'mixed-port' "$CONFIG_FILE" 2>/dev/null | awk '{print $2}' | head -1)
    port="${port:-7890}"
    local proxy_url="http://172.17.0.1:${port}"

    if [ ! -f "$DOCKER_DAEMON_JSON" ]; then
        warn "$DOCKER_DAEMON_JSON 不存在，将创建新文件"
        echo "{}" > "$DOCKER_DAEMON_JSON"
    fi

    # 用 python3 安全地修改 JSON（保留原有字段）
    if ! command -v python3 >/dev/null 2>&1; then
        error "需要 python3 来安全修改 JSON，请手动编辑 $DOCKER_DAEMON_JSON"
        echo ""
        echo -e "  在 ${CYAN}proxies${NC} 字段中添加："
        echo "  {\"http-proxy\": \"${proxy_url}\", \"https-proxy\": \"${proxy_url}\", \"no-proxy\": \"localhost,127.0.0.1,172.16.0.0/12\"}"
        pause; return
    fi

    python3 - << PYEOF
import json, sys
path = "$DOCKER_DAEMON_JSON"
try:
    with open(path) as f:
        d = json.load(f)
except Exception:
    d = {}
d["proxies"] = {
    "http-proxy":  "$proxy_url",
    "https-proxy": "$proxy_url",
    "no-proxy":    "localhost,127.0.0.1,172.16.0.0/12,192.168.0.0/16,10.0.0.0/8"
}
with open(path, "w") as f:
    json.dump(d, f, indent=2)
print("OK")
PYEOF

    if [ $? -eq 0 ]; then
        info "daemon.json 已更新: $DOCKER_DAEMON_JSON"
    else
        error "写入失败，请检查文件权限"
        pause; return
    fi

    if systemctl is-active docker >/dev/null 2>&1; then
        echo ""
        warn "需要重启 Docker daemon 才能生效（会重启所有容器！）"
        if ask "是否立即重启 Docker daemon？" n; then
            systemctl restart docker && info "Docker daemon 已重启，代理生效" || error "重启失败"
        else
            warn "请稍后手动执行: sudo systemctl restart docker"
        fi
    fi

    echo ""
    info "生效后 Dify 插件安装等操作将自动走代理，无需额外配置"
    pause
}

_docker_proxy_disable() {
    require_root || { pause; return; }
    clear
    title "禁用 Docker 代理配置"
    ask "确定要移除全部 Docker 代理配置吗？" n || return

    # 移除 systemd drop-in
    if [ -f "$DOCKER_PROXY_CONF" ]; then
        rm -f "$DOCKER_PROXY_CONF"
        rmdir /etc/systemd/system/docker.service.d 2>/dev/null || true
        systemctl daemon-reload
        info "systemd 代理配置已移除"
    fi

    # 清空 daemon.json 中的 proxies
    if [ -f "$DOCKER_DAEMON_JSON" ] && command -v python3 >/dev/null 2>&1; then
        python3 - << PYEOF
import json
path = "$DOCKER_DAEMON_JSON"
try:
    with open(path) as f:
        d = json.load(f)
except Exception:
    d = {}
d["proxies"] = {}
with open(path, "w") as f:
    json.dump(d, f, indent=2)
PYEOF
        info "daemon.json 代理配置已清空"
    fi

    if systemctl is-active docker >/dev/null 2>&1; then
        if ask "是否立即重启 Docker daemon 使配置生效？" y; then
            systemctl restart docker && info "Docker daemon 已重启" || error "重启失败"
        fi
    fi
    pause
}

_docker_proxy_test() {
    clear
    title "Docker 容器网络测试"

    if ! command -v docker >/dev/null 2>&1; then
        error "Docker 未安装"; pause; return
    fi
    if ! systemctl is-active docker >/dev/null 2>&1; then
        error "Docker daemon 未运行"; pause; return
    fi

    local port img="alpine"
    port=$(grep 'mixed-port' "$CONFIG_FILE" 2>/dev/null | awk '{print $2}' || echo "7890")

    # 确保测试镜像就绪
    if ! docker image inspect "$img" >/dev/null 2>&1; then
        echo -e "  ${DIM}本地无 $img 镜像，尝试拉取（需要网络）...${NC}"
        if ! docker pull "$img" -q 2>/dev/null; then
            error "拉取 $img 失败"
            warn "请先启用 Docker daemon 代理（选项1）后重试，或手动执行: docker pull $img"
            pause; return
        fi
    fi
    info "测试镜像就绪: $img"
    echo ""
    echo -e "  ${DIM}并行启动容器测试中，请稍候（最长约 20 秒）...${NC}"
    echo ""

    local tmp
    tmp=$(mktemp -d)
    # shellcheck disable=SC2064
    trap "rm -rf '$tmp'" RETURN

    local pe="HTTP_PROXY=http://172.17.0.1:${port}"
    local pse="HTTPS_PROXY=http://172.17.0.1:${port}"

    # ── TUN 透明代理（不设代理环境变量）──────────────────────
    docker run --rm "$img" wget -qO- --timeout=10 \
        "https://api.ipify.org" > "$tmp/tun_ip" 2>/dev/null &

    ( docker run --rm "$img" \
        wget -qO /dev/null --timeout=12 "https://www.google.com" 2>/dev/null \
        && echo "OK" || echo "FAIL" ) > "$tmp/tun_google" &

    ( docker run --rm "$img" \
        wget -qO /dev/null --timeout=12 "https://telegram.org" 2>/dev/null \
        && echo "OK" || echo "FAIL" ) > "$tmp/tun_tg" &

    ( docker run --rm "$img" \
        wget -qO /dev/null --timeout=12 "https://claude.ai" 2>/dev/null \
        && echo "OK" || echo "FAIL" ) > "$tmp/tun_claude" &

    # ── 显式 HTTP 代理环境变量 ────────────────────────────────
    docker run --rm -e "$pe" -e "$pse" "$img" \
        wget -qO- --timeout=10 "https://api.ipify.org" > "$tmp/prx_ip" 2>/dev/null &

    ( docker run --rm -e "$pe" -e "$pse" "$img" \
        wget -qO /dev/null --timeout=12 "https://www.google.com" 2>/dev/null \
        && echo "OK" || echo "FAIL" ) > "$tmp/prx_google" &

    ( docker run --rm -e "$pe" -e "$pse" "$img" \
        wget -qO /dev/null --timeout=12 "https://telegram.org" 2>/dev/null \
        && echo "OK" || echo "FAIL" ) > "$tmp/prx_tg" &

    ( docker run --rm -e "$pe" -e "$pse" "$img" \
        wget -qO /dev/null --timeout=12 "https://claude.ai" 2>/dev/null \
        && echo "OK" || echo "FAIL" ) > "$tmp/prx_claude" &

    wait

    # ── 显示结果 ──────────────────────────────────────────────
    _dshow() {
        local name="$1" file="$2"
        local val
        val=$(cat "$tmp/$file" 2>/dev/null)
        printf "  %-22s" "$name"
        case "$val" in
            OK)   echo -e "${GREEN}✓ 可达${NC}" ;;
            FAIL) echo -e "${RED}✗ 不可达${NC}" ;;
            "")   echo -e "${RED}✗ 超时${NC}" ;;
            *)    echo -e "${GREEN}✓${NC}  ${CYAN}$val${NC}" ;;  # IP address
        esac
    }

    local tun_ip prx_ip
    tun_ip=$(cat "$tmp/tun_ip" 2>/dev/null)
    prx_ip=$(cat "$tmp/prx_ip" 2>/dev/null)

    echo -e "  ${BOLD}[ TUN 透明代理（不设环境变量）]${NC}"
    echo ""
    printf "  %-22s" "出口 IP"
    [ -n "$tun_ip" ] \
        && echo -e "${GREEN}✓${NC}  ${CYAN}$tun_ip${NC}" \
        || echo -e "${RED}✗ 获取失败（TUN 未覆盖容器流量）${NC}"
    _dshow "Google"   "tun_google"
    _dshow "Telegram" "tun_tg"
    _dshow "Claude"   "tun_claude"

    echo ""
    divider
    echo ""
    echo -e "  ${BOLD}[ 显式 HTTP 代理 (172.17.0.1:${port}) ]${NC}"
    echo ""
    printf "  %-22s" "出口 IP"
    [ -n "$prx_ip" ] \
        && echo -e "${GREEN}✓${NC}  ${CYAN}$prx_ip${NC}" \
        || echo -e "${RED}✗ 获取失败（Mihomo 未运行或端口不通）${NC}"
    _dshow "Google"   "prx_google"
    _dshow "Telegram" "prx_tg"
    _dshow "Claude"   "prx_claude"

    echo ""
    # 结论提示
    if [ -z "$tun_ip" ] && [ -n "$prx_ip" ]; then
        warn "TUN 未覆盖容器，建议容器启动时加 -e HTTP_PROXY / -e HTTPS_PROXY"
    elif [ -n "$tun_ip" ] && [ -z "$prx_ip" ]; then
        warn "TUN 透明代理可用，但显式代理不通（检查 Mihomo 是否监听 0.0.0.0:${port}）"
    elif [ -n "$tun_ip" ] && [ -n "$prx_ip" ]; then
        info "两种方式均可用"
        [ "$tun_ip" = "$prx_ip" ] && info "出口 IP 一致，均通过同一代理节点" \
                                   || warn "出口 IP 不同，路由策略可能有差异"
    else
        error "两种方式均失败，请检查 Mihomo 是否正常运行"
    fi
    pause
}

# ════════════════════════════════════════════════════════════
#  管理面板（Web UI）
# ════════════════════════════════════════════════════════════
UI_DIR="$CONFIG_DIR/ui"

_webui_read_config() {
    local ctrl_addr
    ctrl_addr=$(grep 'external-controller' "$CONFIG_FILE" 2>/dev/null | awk '{print $2}')
    WEBUI_PORT=$(echo "$ctrl_addr" | cut -d: -f2)
    WEBUI_SECRET=$(grep '^secret:' "$CONFIG_FILE" 2>/dev/null | awk '{print $2}' | head -1)
    WEBUI_EXTUI=$(grep '^external-ui:' "$CONFIG_FILE" 2>/dev/null | awk '{print $2}' | head -1)
    WEBUI_IP=$(_local_ip)
}

_webui_url() {
    # 生成完整访问链接
    local base="$1"  # http://IP:PORT/ui 或外部 URL
    local secret="${WEBUI_SECRET}"
    if [ -n "$secret" ]; then
        echo "${base}?hostname=${WEBUI_IP}&port=${WEBUI_PORT}&secret=${secret}"
    else
        echo "${base}?hostname=${WEBUI_IP}&port=${WEBUI_PORT}&secret="
    fi
}

menu_webui() {
    while true; do
        clear
        title "管理面板（Web UI）"

        if [ ! -f "$CONFIG_FILE" ]; then
            error "配置文件不存在"; pause; return
        fi

        _webui_read_config

        if [ -z "$WEBUI_PORT" ]; then
            warn "配置文件中未设置 external-controller"
            warn "请在 config.yaml 中添加：external-controller: 0.0.0.0:9090"
            pause; return
        fi

        # 状态栏
        echo -e "  API地址:  ${CYAN}http://${WEBUI_IP}:${WEBUI_PORT}${NC}"
        if [ -n "$WEBUI_SECRET" ]; then
            echo -e "  Secret:   ${GREEN}${WEBUI_SECRET}${NC}"
        else
            echo -e "  Secret:   ${YELLOW}未设置（建议配置）${NC}"
        fi
        if [ -n "$WEBUI_EXTUI" ]; then
            echo -e "  本地 UI:  ${GREEN}已安装 → http://${WEBUI_IP}:${WEBUI_PORT}/ui${NC}"
        else
            echo -e "  本地 UI:  ${DIM}未安装（当前使用在线版）${NC}"
        fi

        echo ""
        divider
        # 访问链接
        if [ -n "$WEBUI_EXTUI" ]; then
            echo -e "  ${BOLD}本地面板地址（推荐）:${NC}"
            echo -e "  ${CYAN}http://${WEBUI_IP}:${WEBUI_PORT}/ui${NC}"
            echo ""
        fi
        echo -e "  ${BOLD}在线面板备用:${NC}"
        echo -e "  Metacubexd: ${CYAN}$(_webui_url "https://metacubex.github.io/metacubexd")${NC}"
        echo -e "  Yacd-meta:  ${CYAN}$(_webui_url "http://yacd.metacubex.one")${NC}"
        echo ""
        divider
        echo -e "  1. 安装本地 UI（Metacubexd）    ${YELLOW}[需要root]${NC}"
        echo -e "  2. 安装本地 UI（Yacd-meta）     ${YELLOW}[需要root]${NC}"
        echo -e "  3. 设置 / 修改 Secret           ${YELLOW}[需要root]${NC}"
        echo -e "  4. 移除本地 UI                  ${YELLOW}[需要root]${NC}"
        echo "  0. 返回"
        echo ""
        printf "  请输入选项: "
        read -r c
        case "$c" in
            1) _webui_install "metacubexd" ;;
            2) _webui_install "yacd" ;;
            3) _webui_set_secret ;;
            4) _webui_remove ;;
            0) return ;;
            *) error "无效选项"; sleep 1 ;;
        esac
    done
}

_webui_install() {
    require_root || { pause; return; }
    local flavor="$1"
    clear
    title "安装本地 UI - ${flavor}"

    local download_url filename
    if [ "$flavor" = "metacubexd" ]; then
        download_url="https://github.com/MetaCubeX/metacubexd/releases/latest/download/compressed-dist.tgz"
        filename="compressed-dist.tgz"
    else
        download_url="https://github.com/MetaCubeX/yacd/releases/latest/download/yacd-meta.gh-pages.zip"
        filename="yacd-meta.gh-pages.zip"
    fi

    local tmp
    tmp=$(mktemp -d)
    trap "rm -rf '$tmp'" RETURN

    info "下载 ${flavor}..."
    if ! curl -L --max-time 60 -o "$tmp/$filename" "$download_url" --progress-bar; then
        error "下载失败，请检查网络后重试"
        pause; return
    fi

    info "解压安装到 ${UI_DIR}..."
    rm -rf "$UI_DIR"
    mkdir -p "$UI_DIR"

    if [[ "$filename" == *.tgz ]]; then
        tar -xzf "$tmp/$filename" -C "$UI_DIR" --strip-components=0
    else
        if command -v unzip >/dev/null 2>&1; then
            unzip -q "$tmp/$filename" -d "$tmp/unzipped"
        else
            python3 -c "import zipfile,sys; zipfile.ZipFile('$tmp/$filename').extractall('$tmp/unzipped')"
        fi
        # yacd 解压后是 public 子目录
        local inner
        inner=$(ls "$tmp/unzipped/" | head -1)
        if [ -d "$tmp/unzipped/$inner" ]; then
            cp -r "$tmp/unzipped/$inner/." "$UI_DIR/"
        else
            cp -r "$tmp/unzipped/." "$UI_DIR/"
        fi
    fi

    # 写入 external-ui 配置
    if ! grep -q '^external-ui:' "$CONFIG_FILE"; then
        sed -i "s|^external-controller:|external-ui: ${UI_DIR}\nexternal-controller:|" "$CONFIG_FILE"
    else
        sed -i "s|^external-ui:.*|external-ui: ${UI_DIR}|" "$CONFIG_FILE"
    fi

    info "UI 文件已安装到 ${UI_DIR}"
    info "配置已写入 external-ui: ${UI_DIR}"

    echo ""
    if systemctl is-active mihomo >/dev/null 2>&1; then
        if ask "是否立即重启 Mihomo 使配置生效？" y; then
            systemctl restart mihomo && info "Mihomo 已重启" || error "重启失败"
        fi
    fi

    _webui_read_config
    echo ""
    info "安装完成！访问地址："
    echo -e "  ${CYAN}http://${WEBUI_IP}:${WEBUI_PORT}/ui${NC}"
    pause
}

_webui_set_secret() {
    require_root || { pause; return; }
    clear
    title "设置 Secret"

    local current
    current=$(grep '^secret:' "$CONFIG_FILE" 2>/dev/null | awk '{print $2}' | head -1)
    [ -n "$current" ] && echo -e "  当前 Secret: ${YELLOW}${current}${NC}" || echo -e "  当前 Secret: ${DIM}未设置${NC}"
    echo ""
    echo -e "  ${DIM}Secret 用于保护管理面板，防止未授权访问${NC}"
    echo -e "  ${DIM}留空并回车可生成随机 Secret，输入 - 可清除${NC}"
    echo ""
    printf "  请输入新 Secret（留空自动生成）: "
    read -r new_secret

    if [ "$new_secret" = "-" ]; then
        new_secret=""
        echo -e "  ${DIM}将清除 Secret${NC}"
    elif [ -z "$new_secret" ]; then
        new_secret=$(tr -dc 'A-Za-z0-9' </dev/urandom 2>/dev/null | head -c 16 || \
                     python3 -c "import secrets; print(secrets.token_urlsafe(12))")
        echo -e "  自动生成: ${GREEN}${new_secret}${NC}"
    fi

    # 更新或写入 secret
    if grep -q '^secret:' "$CONFIG_FILE"; then
        sed -i "s|^secret:.*|secret: ${new_secret}|" "$CONFIG_FILE"
    else
        sed -i "s|^external-controller:|secret: ${new_secret}\nexternal-controller:|" "$CONFIG_FILE"
    fi

    [ -n "$new_secret" ] && info "Secret 已设置为: ${new_secret}" || info "Secret 已清除"

    echo ""
    if systemctl is-active mihomo >/dev/null 2>&1; then
        if ask "是否立即重启 Mihomo 使配置生效？" y; then
            systemctl restart mihomo && info "Mihomo 已重启" || error "重启失败"
        fi
    fi
    pause
}

_webui_remove() {
    require_root || { pause; return; }
    clear
    title "移除本地 UI"
    ask "确定要移除本地 UI 文件并清除 external-ui 配置吗？" n || return

    rm -rf "$UI_DIR"
    sed -i '/^external-ui:/d' "$CONFIG_FILE"
    info "本地 UI 已移除"

    if systemctl is-active mihomo >/dev/null 2>&1; then
        ask "是否重启 Mihomo？" y && systemctl restart mihomo
    fi
    pause
}

# ════════════════════════════════════════════════════════════
#  复制代理链接
# ════════════════════════════════════════════════════════════
menu_proxy_link() {
    clear
    title "代理链接"

    if [ ! -f "$CONFIG_FILE" ]; then
        error "配置文件不存在，无法读取端口信息"
        pause; return
    fi

    local mixed_port http_port socks_port lan_ip
    mixed_port=$(grep 'mixed-port' "$CONFIG_FILE" | awk '{print $2}' | head -1)
    http_port=$(grep '^port:' "$CONFIG_FILE" | awk '{print $2}' | head -1)
    socks_port=$(grep '^socks-port:' "$CONFIG_FILE" | awk '{print $2}' | head -1)
    lan_ip=$(_local_ip)

    echo -e "  ${BOLD}服务器 IP: ${CYAN}${lan_ip}${NC}"
    echo ""

    local primary_port="${mixed_port:-${http_port}}"
    if [ -n "$primary_port" ]; then
        local proxy_link="http://${lan_ip}:${primary_port}"
        echo -e "  ${BOLD}HTTP/混合代理链接（可直接填入各客户端）:${NC}"
        echo ""
        echo -e "  ${CYAN}${proxy_link}${NC}"
        echo ""
        divider
        echo -e "  ${BOLD}各场景配置格式:${NC}"
        echo ""
        echo -e "  ${YELLOW}curl / wget:${NC}"
        echo -e "  ${DIM}http_proxy=${proxy_link} https_proxy=${proxy_link}${NC}"
        echo ""
        echo -e "  ${YELLOW}Linux 环境变量:${NC}"
        echo -e "  ${DIM}export http_proxy=${proxy_link}${NC}"
        echo -e "  ${DIM}export https_proxy=${proxy_link}${NC}"
        echo ""
        echo -e "  ${YELLOW}Docker 容器代理（可通过主菜单 16 设置）:${NC}"
        echo -e "  ${DIM}http_proxy=${proxy_link}${NC}"
        echo ""

        # 尝试复制到剪贴板
        if command -v xclip >/dev/null 2>&1; then
            echo -n "$proxy_link" | xclip -selection clipboard 2>/dev/null \
                && info "已复制到剪贴板 (xclip): ${proxy_link}"
        elif command -v xsel >/dev/null 2>&1; then
            echo -n "$proxy_link" | xsel --clipboard --input 2>/dev/null \
                && info "已复制到剪贴板 (xsel): ${proxy_link}"
        elif command -v pbcopy >/dev/null 2>&1; then
            echo -n "$proxy_link" | pbcopy 2>/dev/null \
                && info "已复制到剪贴板 (pbcopy): ${proxy_link}"
        else
            warn "未检测到剪贴板工具，请手动复制上方链接"
        fi
    else
        warn "配置文件中未找到 mixed-port / port，请检查配置"
    fi

    if [ -n "$socks_port" ]; then
        echo ""
        divider
        echo -e "  ${BOLD}SOCKS5 代理链接:${NC}"
        echo -e "  ${CYAN}socks5://${lan_ip}:${socks_port}${NC}"
    fi

    pause
}

# ════════════════════════════════════════════════════════════
#  卸载 Mihomo
# ════════════════════════════════════════════════════════════
menu_uninstall() {
    require_root || { pause; return; }
    clear
    title "卸载 Mihomo"

    echo "  1. 卸载程序（保留配置文件）"
    echo "  2. 完全卸载（删除程序 + 配置）"
    echo "  0. 返回"
    echo ""
    printf "  请输入选项: "
    read -r mode

    [ "$mode" = "0" ] && return
    [[ "$mode" != "1" && "$mode" != "2" ]] && { error "无效选项"; sleep 1; return; }

    echo ""
    ask "确认卸载？" n || return

    echo ""
    systemctl stop "$SERVICE_NAME" 2>/dev/null && info "服务已停止"
    systemctl disable "$SERVICE_NAME" 2>/dev/null && info "开机自启已取消"
    rm -f "$SERVICE_FILE" && systemctl daemon-reload
    rm -f "$BINARY" /usr/local/bin/fluxo-cli && info "二进制和 fluxo-cli 命令已删除"

    if [ "$mode" = "2" ]; then
        rm -rf "$CONFIG_DIR" && info "配置目录已删除"
    else
        warn "配置文件保留在 $CONFIG_DIR"
    fi

    info "卸载完成"
    pause
}

# ════════════════════════════════════════════════════════════
#  入口：支持命令行参数直接调用
# ════════════════════════════════════════════════════════════
case "${1:-}" in
    start)      require_root && systemctl start "$SERVICE_NAME" ;;
    stop)       require_root && systemctl stop "$SERVICE_NAME" ;;
    restart)    require_root && systemctl restart "$SERVICE_NAME" ;;
    status)     menu_status ;;
    test)       menu_test ;;
    log)        journalctl -u "$SERVICE_NAME" --no-pager -n "${2:-50}" ;;
    log-follow) journalctl -u "$SERVICE_NAME" -f ;;
    "")         main_menu ;;
    *)          echo "用法: $(basename "$0") [start|stop|restart|status|test|log|log-follow]" ;;
esac

