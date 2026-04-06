# Fluxo

> Let it flow. — Modern web dashboard for Mihomo (Clash.Meta)

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

Fluxo 是一个面向 Linux VPS 的现代化 Web 控制面板，将 Mihomo (Clash.Meta) 的可视化配置管理、实时流量监控和系统管理合为一体。

## Features

- **Modern Dashboard UI** — 紫色 SaaS 风格，毛玻璃侧边栏，圆角卡片
- **全功能配置管理** — 可视化添加节点、编辑策略组、管理规则，一键生成并热重载 YAML
- **实时监控** — WebSocket 流量统计、连接列表、请求日志
- **DNS 管理** — Fake-IP / redir-host 模式，自定义上游 DNS
- **Proxy Provider** — 订阅链接管理，一键刷新
- **Rule Sets** — 规则集（Rule Provider）管理
- **Docker 一键部署** — `docker compose up -d` 即可运行
- **直接安装** — 支持 Debian/Ubuntu 直接安装（含 systemd 服务）

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + React 19 + TypeScript |
| Styling | Tailwind CSS 4 + Radix UI |
| Charts | Recharts |
| Backend | Fastify 5 + TypeScript |
| Database | SQLite (better-sqlite3) |
| Realtime | WebSocket |
| Deploy | Docker + Docker Compose / systemd |

## Quick Start

### Development

```bash
pnpm install
pnpm dev  # Web: http://localhost:38080 | API: http://localhost:8090
```

### Production — Direct Install (Debian/Ubuntu)

```bash
curl -fsSL https://raw.githubusercontent.com/raylenzed/fluxo/main/install.sh | sudo bash
```

### Production — Docker

```bash
docker compose up -d
```

Requires Mihomo running on the host with `external-controller: 0.0.0.0:9090`.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Browser  →  Fluxo Web UI (Next.js :8080)  │
│               ↕ REST + WebSocket             │
│  API Server (Fastify :8090)  →  SQLite DB   │
│               ↕ HTTP / WebSocket relay       │
│  Mihomo Core (host :9090)                   │
└─────────────────────────────────────────────┘
```

- **Web UI**: Next.js 16 standalone, port 38080 (dev) / 8080 (production)
- **API Server**: Fastify 5, port 8090
- **Mihomo Core**: Runs on the host machine (TUN mode requires host kernel access)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and PR guidelines.

## License

MIT — see [LICENSE](LICENSE) for details.

## Credits

- [Mihomo (Clash.Meta)](https://github.com/MetaCubeX/mihomo) — Proxy core
- [neko-master](https://github.com/foru17/neko-master) — Traffic monitoring architecture reference
- [mihomo-manager](https://github.com/RaylenZed/mihomo-manager) — System management scripts
