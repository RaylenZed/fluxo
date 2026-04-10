# Fluxo

> Let it flow. — Modern web dashboard for Mihomo (Clash.Meta)

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

Fluxo 是面向 Linux VPS 的现代化 Web 控制面板，将 Mihomo (Clash.Meta) 的可视化配置管理、实时流量监控和系统管理合为一体。支持中英文界面切换。

---

## Features

### 概览 & 监控
- **仪表板** — 实时内存占用、服务运行时长、网络模式、TUN 状态
- **活动** — WebSocket 实时连接日志，带流量统计
- **总览** — 实时上行/下行流量图表、连接数、日志流

### 代理管理
- **策略页** — 可视化管理代理节点与策略组
  - 支持 15 种协议：HTTP / HTTPS / SOCKS5 / SOCKS5-TLS / SSH / SS / VMess / VLESS / Trojan / Snell / TUIC / TUICv5 / Hysteria2 / WireGuard / AnyTLS
  - **URL 自动解析**：粘贴 `vmess://` `vless://` `ss://` `trojan://` `hysteria2://` `tuic://` 链接自动填充表单
  - 节点编辑 / 删除
  - 策略组：手动选择 / 自动测速 / 故障转移 / 负载均衡
  - **应用配置**：将 DB 中所有节点、策略组、规则生成 YAML 并热重载 Mihomo
- **规则** — 可视化规则列表，支持拖拽排序、新增、删除

### 系统配置
- **设置** — 混合端口、allow-lan、日志级别、IPv6、TUN 模式（即时生效）、远程控制器地址和密钥
- **DNS** — Fake-IP / redir-host / normal 模式，上游 DNS、fallback DNS、Fake-IP 过滤列表
- **配置编辑器** — 直接编辑原始 YAML；保护 8080/8090/9090 等关键端口，修改前警告
- **订阅** — 代理 Provider 订阅链接管理（URL、更新间隔、健康检查）
- **规则集** — Rule Provider 管理

### 系统工具
- **进程** — 查看经过代理的进程
- **设备** — 局域网设备列表
- **日志** — Mihomo 实时日志（WebSocket）
- **系统** — Mihomo 服务状态、内存、连接数、运行时长；一键重启/重载

### 其他
- **中英文** — 完整的 zh / en 双语界面，右下角一键切换
- **fluxo-cli** — 交互式 Shell 工具（直接安装时附带）

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + React 19 + TypeScript |
| Styling | Tailwind CSS 4 + Radix UI (shadcn/ui) |
| Charts | Recharts |
| State | TanStack Query v5 |
| Backend | Fastify 5 + TypeScript |
| Database | SQLite (better-sqlite3) |
| Realtime | WebSocket |
| i18n | React Context + translations.ts |
| Deploy | Docker Compose / systemd |

---

## Quick Start

### Development

```bash
pnpm install
pnpm dev  # Web: http://localhost:38080 | API: http://localhost:8090
```

### Production — Direct Install (Debian/Ubuntu)

```bash
curl -fsSL https://fluxo.click | sudo bash
```

国内服务器可指定 GitHub 下载代理：

```bash
curl -fsSL https://fluxo.click | sudo GH_PROXY=https://gh-proxy.com/ bash
```

安装后自动创建三个 systemd 服务：

| 服务 | 说明 | 端口 |
|------|------|------|
| `mihomo` | Mihomo 代理核心 | 9090 (API) / 7890 (proxy) |
| `fluxo` | Fastify API 服务 | 8090 |
| `fluxo-web` | Next.js Web UI | 8080 |

#### 首次访问

安装完成后打开 `http://<服务器IP>:8080`，会进入密码设置页，**设置一个密码**即可开始使用。之后每次访问需要输入密码登录。

> Mihomo API（端口 9090）的访问密钥由安装脚本自动生成，无需手动配置。

#### 常用管理命令

```bash
# 服务状态
systemctl status mihomo          # Mihomo 核心状态
systemctl status fluxo           # API 服务状态
systemctl status fluxo-web       # Web UI 状态

# 实时日志
journalctl -fu mihomo            # Mihomo 日志
journalctl -fu fluxo             # API 服务日志
journalctl -fu fluxo-web         # Web UI 日志

# 配置
nano /etc/mihomo/config.yaml     # 直接编辑配置
systemctl reload mihomo          # 热重载配置（不中断连接）
systemctl restart mihomo         # 重启核心
```

#### 卸载

```bash
curl -fsSL https://fluxo.click | sudo bash -- --uninstall
```

> 卸载会删除 Mihomo 二进制、Fluxo 应用及数据库，**Mihomo 配置文件 `/etc/mihomo/` 会保留**。

#### 重装

先卸载，再执行安装命令即可：

```bash
curl -fsSL https://fluxo.click | sudo bash -- --uninstall
curl -fsSL https://fluxo.click | sudo bash
```

### Production — Docker

前提：宿主机已运行 Mihomo，且 `external-controller: 0.0.0.0:9090`。

```bash
# 默认（Mihomo API 在 host-gateway:9090）
docker compose up -d

# 自定义 Mihomo 地址
MIHOMO_API_URL=http://192.168.1.100:9090 MIHOMO_SECRET=yourSecret docker compose up -d
```

Docker 挂载说明：

| 挂载 | 说明 |
|------|------|
| `/etc/mihomo` (rw) | Mihomo 配置目录，Fluxo 会写入 `config.yaml` |
| `fluxo_data:/data` | SQLite 数据库持久化 |

---

## Environment Variables

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MIHOMO_API_URL` | *(读 DB 设置)* | Mihomo REST API 地址，优先级高于 DB |
| `MIHOMO_SECRET` | *(自动生成)* | Mihomo API 密钥，与 `MIHOMO_API_URL` 配合使用 |
| `CONFIG_PATH` | `/etc/mihomo/config.yaml` | Mihomo 配置文件路径 |
| `DB_PATH` | `./data/fluxo.db` | SQLite 数据库路径 |
| `WEB_PORT` | `8080` | Web UI 监听端口 |
| `SERVER_PORT` | `8090` | API 服务监听端口 |
| `BACKEND_URL` | `http://127.0.0.1:8090` | Web UI 转发 API 请求的地址（与 `SERVER_PORT` 保持一致） |

> **注意**：`MIHOMO_SECRET` 在首次启动时自动随机生成并存入数据库，无需手动设置。`MIHOMO_API_URL` 设置后优先于数据库中的 `mihomo.external_controller`，适合 Docker 环境下固定连接宿主机 Mihomo。

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser  →  Fluxo Web UI (Next.js :8080)           │
│               ↕ /api/* proxy (relative paths)        │
│  API Server (Fastify :8090)  →  SQLite DB            │
│               ↕ HTTP + WebSocket relay               │
│  Mihomo Core (host :9090)                            │
└─────────────────────────────────────────────────────┘
```

- **Web UI**: Next.js 16 standalone，所有 `/api/*` 请求由 Next.js server-side 转发到 Fastify，远程浏览器无需直连 8090
- **API Server**: Fastify 5，管理 SQLite DB、生成/应用 YAML、转发 Mihomo REST API
- **Mihomo Core**: 运行在宿主机（TUN 模式需要宿主机内核权限）

---

## Config Generation

点击策略页"**应用配置**"时，Fluxo 执行：

1. 从 SQLite 读取所有代理节点、策略组、规则、规则集、DNS 配置
2. 生成 YAML（`js-yaml`）
3. 写入 `CONFIG_PATH`（默认 `/etc/mihomo/config.yaml`）
4. 通过 Mihomo REST API `PUT /configs` 热重载

---

## Reserved Ports

以下端口由 Fluxo 自身使用，**配置编辑器会在保存前警告**：

| 端口 | 服务 |
|------|------|
| 8080 | Fluxo Web UI |
| 8090 | Fluxo API Server |
| 9090 | Mihomo external-controller |

---

## fluxo-cli

直接安装后自动获得 `fluxo-cli` 交互式管理工具（`/usr/local/bin/fluxo-cli`）：

```bash
fluxo-cli            # 进入交互菜单
fluxo-cli status     # 快速查看 Mihomo 状态
fluxo-cli test       # 网络连通性测试（Google / YouTube / GitHub 等）
fluxo-cli log        # 查看最近 50 条日志
fluxo-cli log-follow # 实时跟踪日志
fluxo-cli start      # 启动 Mihomo
fluxo-cli stop       # 停止 Mihomo
fluxo-cli restart    # 重启 Mihomo
```

功能涵盖：Mihomo 版本管理、TUN 路由配置、GeoIP 数据库更新、代理连通性测试。

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and PR guidelines.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Credits

- [Mihomo (Clash.Meta)](https://github.com/MetaCubeX/mihomo) — Proxy core
- [neko-master](https://github.com/foru17/neko-master) — Traffic monitoring architecture reference
- [mihomo-manager](https://github.com/RaylenZed/mihomo-manager) — Merged into `fluxo-cli` (`tools/fluxo-cli.sh`)
