# Mihomo Party

> A modern Surge-style web dashboard for Mihomo (Clash.Meta)

Mihomo Party 是一个面向 Linux VPS 的现代化 Web 控制面板，像素级复刻 Surge (macOS/iOS) 的设计感和交互体验，将可视化配置管理、实时流量监控和系统管理合为一体。

## Features

- **Surge 风格 UI** — Apple 设计语言，毛玻璃侧边栏，圆角卡片，紫色主题
- **全功能配置管理** — 可视化添加节点、编辑策略组、管理规则，一键生成 YAML
- **实时监控** — 流量统计、连接列表、请求日志、世界流量地图
- **系统管理** — Mihomo 安装/更新、TUN 模式、Tailscale、Docker 代理
- **Docker 一键部署** — `docker-compose up` 即可运行

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + React 19 + TypeScript |
| Styling | Tailwind CSS 4 + Radix UI |
| Charts | Recharts + react-simple-maps |
| Backend | Fastify 5 + TypeScript |
| Database | SQLite (better-sqlite3) |
| Realtime | WebSocket |
| Deploy | Docker + Docker Compose |

## Quick Start

### Development

```bash
pnpm install
pnpm dev  # starts both web (port 38080) and API server (port 8090)
```

Open http://localhost:38080

### Production (Direct Install on Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/RaylenZed/mihomo-party/main/install.sh | sudo bash
```

### Production (Docker)

```bash
docker compose up -d
```

## Architecture

- **Web UI**: Next.js 16 on port 38080 (dev) / 8080 (production)
- **API Server**: Fastify 5 on port 8090
- **Mihomo Core**: Runs on host machine, managed via REST API

The web panel connects to Mihomo's external controller (default `127.0.0.1:9090`). Configure in Settings → Remote.

## Development (full)

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build
pnpm build
```

## License

MIT

## Credits

- [Mihomo (Clash.Meta)](https://github.com/MetaCubeX/mihomo) — Proxy core
- [neko-master](https://github.com/foru17/neko-master) — Traffic monitoring architecture reference
- [Zashboard](https://github.com/Zephyruso/zashboard) — Dashboard design reference
- [mihomo-manager](https://github.com/RaylenZed/mihomo-manager) — System management scripts
- [Surge](https://nssurge.com/) — UI/UX design inspiration
