# Mihomo Party — 现代化 Mihomo Web 管理面板

## Context

在无界面的 Linux VPS 上管理 Mihomo (Clash.Meta) 代理，目前缺乏一个将"可视化配置生成"与"面板实时监控"合二为一的现代化 Web 工具。现有的 Metacubexd 只是个"遥控器"，无法添加节点、编辑策略组或管理规则。

**目标**: 开发一个现代化 Web 控制面板，功能对标 Surge (macOS/iOS)，但拥有自己独特的设计语言。整合 mihomo-manager 脚本的所有系统管理功能，支持 Docker 和宿主机直装两种部署方式。

**设计语言**: 不照搬 Surge 的 macOS 原生风格，而是打造独立的现代 Web 美学 —— 参考 Coursue Dashboard 的设计风格：
- **紫色主题色** (#7C5CFC) 为主色调，配合柔和渐变
- **三栏布局**: 白色左侧导航栏 + 灰蓝背景主内容区 + 可选右侧信息面板
- **圆角卡片** (16px radius)，超柔阴影 (0 4px 24px rgba(0,0,0,0.06))
- **分类导航**: 侧边栏按 OVERVIEW / PROXY / HTTP / SYSTEM 等分类，带图标
- **信息密度适中**: 大量留白，重要数据用大号加粗字体突出
- **深色/浅色模式**: 双主题支持
- 与 Surge 的关键区别: Surge 是 macOS 原生拟物风格，我们是 **现代 Web SaaS 风格**

---

## 技术栈

| 层级 | 技术 | 理由 |
|------|------|------|
| 前端 | Next.js 16 + React 19 + TypeScript | neko-master 已验证，组件可复用 |
| 样式 | Tailwind CSS 4 + Radix UI | 现代化 + 无障碍，参考 neko-master |
| 图表 | Recharts + react-simple-maps | 流量图表 + 世界地图，neko-master 可复用 |
| 流程图 | @xyflow/react | 规则链可视化，neko-master 可复用 |
| 动画 | Framer Motion | 流畅的页面切换和交互动效 |
| 后端 | Fastify 5 + TypeScript | 高性能 REST API + WebSocket |
| 数据库 | better-sqlite3 (WAL) | 轻量，存储配置数据 + 流量统计 |
| 实时推送 | WebSocket (ws) | 流量/连接/日志实时推送 |
| 包管理 | pnpm + Turborepo | Monorepo 管理 |
| 部署 | Docker + Docker Compose | 一键部署，含 Mihomo 内核 |

---

## 项目结构

```
mihomo-party/
├── apps/
│   ├── web/                    # Next.js 前端
│   │   ├── app/                # App Router 页面
│   │   │   ├── dashboard/      # Dashboard (活动/概览)
│   │   │   ├── proxies/        # 代理节点管理
│   │   │   ├── policies/       # 策略组管理
│   │   │   ├── rules/          # 规则管理
│   │   │   ├── dns/            # DNS 配置
│   │   │   ├── settings/       # 设置 (通用/远程/高级)
│   │   │   ├── profiles/       # 配置管理 (多配置切换)
│   │   │   ├── modules/        # 模块管理
│   │   │   ├── http/           # HTTP 处理 (MitM/重写/捕获)
│   │   │   ├── scripts/        # 脚本管理
│   │   │   └── system/         # 系统管理 (从 mihomo-manager 迁移)
│   │   ├── components/
│   │   │   ├── layout/         # Sidebar, Header, StatusBar
│   │   │   ├── surge/          # Surge 风格组件 (卡片, 开关, 表单)
│   │   │   ├── charts/         # 流量图表 (复用 neko-master)
│   │   │   ├── maps/           # 世界流量地图 (复用 neko-master)
│   │   │   └── common/         # 通用组件
│   │   └── lib/
│   │       ├── api.ts          # REST API 客户端
│   │       ├── websocket.ts    # WebSocket 客户端 (复用 neko-master)
│   │       └── stores/         # 状态管理 (React Query)
│   │
│   └── server/                 # Fastify 后端
│       ├── src/
│       │   ├── modules/
│       │   │   ├── config/     # YAML 配置生成器 (核心!)
│       │   │   ├── mihomo/     # Mihomo 进程管理 + REST API 代理
│       │   │   ├── collector/  # 流量收集 (复用 neko-master)
│       │   │   ├── proxy/      # 代理节点 CRUD
│       │   │   ├── group/      # 策略组 CRUD
│       │   │   ├── rule/       # 规则 CRUD
│       │   │   ├── dns/        # DNS 配置
│       │   │   ├── profile/    # 多配置管理
│       │   │   ├── system/     # 系统管理 (mihomo-manager 功能 Web 化)
│       │   │   └── realtime/   # WebSocket 实时推送
│       │   ├── database/
│       │   │   ├── schema.ts   # 数据库表结构
│       │   │   └── migrations/ # 数据库迁移
│       │   └── main.ts
│       └── package.json
│
├── packages/
│   └── shared/                 # 前后端共享类型
│       └── src/index.ts
│
├── docker-compose.yml
├── Dockerfile
├── turbo.json
└── pnpm-workspace.yaml
```

---

## 功能模块与页面规划

### P0 — Phase 1: UI 骨架 + 核心配置管理

**目标**: 搭建完整的 Surge 风格 UI 骨架，实现配置 CRUD 和 YAML 生成。

#### 1.1 UI 骨架与全局布局
- 左侧毛玻璃导航栏
  - 监控: Dashboard, 活动, 概览
  - 客户端: 进程, 设备
  - 代理: 策略, 规则
  - HTTP: 捕获, 解密, 重写
  - 底部: 更多(设置), 面板
- 顶部状态栏: 配置名称、系统代理开关、增强模式开关
- 紫色主题色 + Apple 风格圆角卡片 + 柔和阴影
- 深色/浅色模式切换
- 响应式布局 (桌面优先)

#### 1.2 代理节点管理
- 节点列表卡片展示
- "增加代理"表单弹窗，支持所有协议:
  HTTP, HTTPS, SOCKS5, SOCKS5-TLS, SSH, Snell, Shadowsocks, VMess, Trojan, AnyTLS, TUIC, TUIC v5, Hysteria 2, WireGuard
- 每种协议的专属参数表单 (服务器/端口/密码/SNI/etc.)
- URL 订阅一键导入 (proxy-providers)，支持自动更新间隔
- 节点测速 (延迟测试)
- 节点编辑/删除/复制

#### 1.3 策略组管理
- 策略组卡片网格展示，显示当前选中节点
- 右键菜单: 编辑策略组、创建副本、删除、延迟测试、快速切换节点
- 策略组编辑弹窗:
  - 选择子策略 (勾选节点/其他组)
  - 同时包含外部策略 (proxy-provider URL + 更新间隔)
  - 同时包含其他策略组的策略 (嵌套)
  - 同时包含所有代理策略
  - 包含过滤 (正则表达式)
- 策略组类型: Select, URL-Test, Fallback, Load-Balance
- 出站模式切换: 直接连接 / 全局代理 / 规则判定

#### 1.4 规则管理
- 规则列表表格 (序号/类型/值/策略/使用计数/注释)
- 支持所有规则类型:
  DOMAIN, DOMAIN-SUFFIX, DOMAIN-KEYWORD, DOMAIN-WILDCARD, DOMAIN-SET,
  IP-CIDR, IP-CIDR6, GEOIP, IP-ASN, PROCESS-NAME, USER-AGENT, URL-REGEX,
  IN-PORT, DEST-PORT, SRC-PORT, SRC-IP, DEVICE-NAME, PROTOCOL, SUBNET,
  HOSTNAME-TYPE
- 新建规则弹窗: 规则类型下拉 + 值 + 策略选择 + 选项(通知/扩展匹配)
- 新建规则集弹窗: 内置/外部 URL 规则集、策略分配
- 规则拖拽排序 (优先级)
- 规则分组折叠显示 (按策略分组)

#### 1.5 后端: 配置生成器 (核心引擎)
- SQLite 存储: proxies, proxy_groups, rules, settings, profiles, dns_config
- YAML 配置生成器: 读取数据库 → 按 Mihomo 规范拼装 config.yaml
  - [General] 区段: mixed-port, allow-lan, mode, log-level, external-controller, secret
  - [TUN] 区段: enable, stack, auto-route, auto-redirect, dns-hijack
  - [DNS] 区段: nameserver, fallback, fake-ip-filter, hosts
  - [Proxy] 区段: 所有节点
  - [Proxy Group] 区段: 策略组 + provider
  - [Rule] 区段: 所有规则按优先级排列
- 配置热重载: 生成 YAML 后通过 Mihomo REST API 触发重载
- YAML 语法验证

---

### P1 — Phase 2: 监控仪表盘 + 实时数据

**目标**: 打通 Mihomo WebSocket，实现实时监控。

#### 2.1 Dashboard / 活动页面
- 网络连通性信息卡片: 延迟/DNS/速度
- 实时上下行网速折线图
- 活动连接数 + 进程列表 + 设备列表
- 当日/本月流量统计 (DIRECT vs 代理 分色条)
- 流量统计饼图 (按进程/按策略)

#### 2.2 概览页面
- 网络接管: 系统代理开关 + 增强模式(TUN)开关
- 局域网访问: HTTP & SOCKS5 代理地址和端口
- 网关模式开关

#### 2.3 进程页面
- 按进程展示流量 (进程图标 + 名称 + 实时速率)
- 支持按流量排序
- 计费网络模式开关

#### 2.4 设备页面
- 局域网设备列表 (IP/设备名)
- 网关模式下的设备管理

#### 2.5 实时请求日志
- 请求列表 (域名/方法/状态码/策略/发送接收量)
- 按策略染色标签
- 展开日志详情
- 清空/暂停功能

---

### P2 — Phase 3: 设置 + DNS + 配置管理

**目标**: 完成所有设置页面。

#### 3.1 设置页面
- 设置入口页: 7 个设置分类卡片 (通用/外观/DNS/模块/配置/授权&更新/脚本)
- 通用设置 - 通用 Tab:
  - 启动设置、故障恢复、系统权限
  - IPv6 DNS 查询、Surge VIF IPv6
  - 子网设置、GeoIP 数据库 (URL + 自动更新)
  - 日志级别
- 通用设置 - 远程访问 Tab:
  - 代理服务远程访问、LAN 外访问
  - 远程控制器 (TCP 端口)
  - HTTP API (端口 + HTTPS + 允许其他设备)
  - Web Dashboard 开关
- 通用设置 - 高级 Tab:
  - 连通性测试 URL
  - 默认代理测试 URL
  - Proxy UDP 测试参数
  - 代理测试超时
  - 错误页面设置
  - DNS 相关高级选项

#### 3.2 DNS 配置
- DNS 服务器选择 (系统/系统+额外/自定义)
- 加密 DNS (DoH/DoT/DoQ URL)
- DNS 选项 (从 /etc/hosts 读取、对所有域名解析 DNS)
- DDNS 配置
- 本地 DNS 映射表 (域名/值/DNS服务器/注释)

#### 3.3 配置管理
- 配置存储路径
- 多配置列表 (名称/描述/代理数/规则数)
- 操作: 导出/新配置/删除/重命名/导入/从 URL 安装
- 配置一键切换
- 配置升级、密钥管理

---

### P3 — Phase 4: HTTP 处理 + 高级功能

#### 4.1 HTTP 捕获 (请求抓包)
- 请求列表 (类似 Charles/Proxyman)
- 请求/响应详情查看

#### 4.2 MitM (HTTPS 解密)
- Hostname 白/黑名单管理
- CA 证书生成和管理
- auto-quic-block 开关

#### 4.3 URL 重写
- 重写规则列表 (正则 + 替换 + 类型)
- Header/302/Reject 三种模式

#### 4.4 模块管理
- 已安装模块列表 + 开关
- 从 URL 安装模块
- 模块参数配置

#### 4.5 脚本管理
- 脚本列表 (http-request/response/cron/event/dns/rule)
- 脚本编辑器 (集成 Monaco Editor)
- Cron 定时任务管理

---

### P4 — Phase 5: 系统管理 (mihomo-manager Web 化)

**目标**: 将 mihomo-manager.sh 的所有功能 Web 化。

#### 5.1 Mihomo 内核管理
- 一键安装/更新 Mihomo 二进制 (自动检测架构)
- 版本显示和更新检查
- 服务状态 (运行/停止/启动/重启/开机自启)
- GeoIP/GeoSite 数据库更新

#### 5.2 TUN 模式管理
- TUN 开关 + 状态检测 (检查 Meta 网卡)
- TUN 路由修复 (mihomo-rules.sh 逻辑 Web 化)
- Docker 兼容性修复 (ip rule 自动配置)

#### 5.3 网络诊断
- 多目标连通性测试 (Google/GitHub/ChatGPT 等 16 个目标)
- 出口 IP 检测 (TUN 直连 + HTTP 代理两种路径)
- DNS 测试

#### 5.4 Tailscale 集成
- 安装/连接/断开/状态
- Mihomo 兼容模式自动配置 (exclude-interface, fake-ip-filter, ip-cidr DIRECT)

#### 5.5 Docker 代理配置
- systemd drop-in 配置
- daemon.json 配置
- 容器网络测试

#### 5.6 IPv6 管理
- 启用/禁用 (sysctl 持久化)

#### 5.7 日志查看
- 实时日志流 (journalctl -f)
- 历史日志查看

---

### P5 — Phase 6: 部署与打包

#### 部署架构 (核心原则: Mihomo 必须在宿主机上)

> **为什么不能全部 Docker 化?**
> Mihomo 的 TUN 模式需要创建虚拟网卡并接管宿主机的全部网络流量（让 VPS 本身能翻墙分流）。
> 如果 Mihomo 运行在 Docker 容器中，TUN 只能接管容器内部网络，宿主机的 curl、wget、其他 Docker 容器等都无法走代理。
> 因此 Mihomo **必须直接安装在宿主机上**。

```
VPS 宿主机
├── Mihomo (直接安装在宿主机)          ← 接管宿主机全部流量 (TUN 模式)
│   ├── /usr/local/bin/mihomo          ← 二进制文件
│   ├── /etc/mihomo/config.yaml        ← 由 Web 后端动态生成
│   ├── /etc/mihomo/*.mmdb, *.dat      ← GeoIP 数据库
│   └── systemd: mihomo.service        ← 系统服务
│
├── mihomo-party-web (两种部署方式任选)
│   │
│   ├── 方式 A: Docker 容器 (推荐，干净隔离)
│   │   ├── 挂载 /etc/mihomo/          ← 读写宿主机配置目录
│   │   ├── 挂载 /var/run/dbus/        ← 通过 D-Bus 控制 systemd 服务
│   │   ├── 连接 Mihomo REST API       ← http://host.docker.internal:9090
│   │   └── 端口映射 8080:3000         ← Web UI 访问
│   │
│   └── 方式 B: 直接运行在宿主机 (最简单)
│       ├── Node.js 进程 (PM2 管理)
│       ├── 直接读写 /etc/mihomo/
│       ├── 直接调用 systemctl
│       └── 监听端口 3000
│
└── 用户浏览器 → http://<VPS_IP>:8080  ← 访问 Web UI 管理一切
```

#### 6.1 方式 A: Docker 部署 Web 面板 (推荐)
- 多阶段构建 Dockerfile: Node.js 22 Alpine
- 前端 SSR + 后端 API 统一服务
- docker-compose.yml:
  ```yaml
  services:
    mihomo-party:
      image: mihomo-party:latest
      ports:
        - "8080:3000"
      volumes:
        - /etc/mihomo:/etc/mihomo          # 宿主机 Mihomo 配置
        - /var/run/dbus:/var/run/dbus      # D-Bus (控制 systemctl)
        - mihomo-party-data:/data          # SQLite 数据
      environment:
        - MIHOMO_API=http://host.docker.internal:9090
        - MIHOMO_SECRET=your-secret
      extra_hosts:
        - "host.docker.internal:host-gateway"
  ```
- Docker 管理命令:
  - 安装: `docker compose up -d`
  - 更新: `docker compose pull && docker compose up -d`
  - 卸载: `docker compose down -v` (加 -v 删除数据卷)
  - 查看日志: `docker compose logs -f`

#### 6.2 方式 B: 宿主机直装 (一键脚本)
- 安装脚本: `curl -fsSL https://raw.githubusercontent.com/RaylenZed/mihomo-party/main/install.sh | bash`
- 安装流程:
  1. 检测系统环境 (Debian/Ubuntu/CentOS/Alpine)
  2. 安装 Node.js 22 LTS (如果未安装)
  3. 从 GitHub Releases 下载最新 mihomo-party 打包文件
  4. 解压到 `/opt/mihomo-party/`
  5. 创建 systemd service: `/etc/systemd/system/mihomo-party.service`
  6. 启动服务并设置开机自启
  7. 自动检测并对接已有的 Mihomo 安装
- 管理命令:
  - 启动: `systemctl start mihomo-party`
  - 停止: `systemctl stop mihomo-party`
  - 重启: `systemctl restart mihomo-party`
  - 状态: `systemctl status mihomo-party`
  - 查看日志: `journalctl -u mihomo-party -f`
- 更新: `mihomo-party update` 或重新运行安装脚本
- **完整卸载**: `mihomo-party uninstall` 或 `curl -fsSL .../install.sh | bash -s -- --uninstall`
  - 停止并删除 mihomo-party 服务
  - 删除 /opt/mihomo-party/ 目录
  - 可选: 是否同时卸载 Mihomo 及其配置 (/etc/mihomo/)
  - 可选: 是否删除 SQLite 数据库
  - 可选: 是否卸载 Node.js

#### 6.3 Mihomo 安装与生命周期管理 (Web 面板负责)
- 首次访问 Web UI 时引导安装向导:
  1. 检测是否已安装 Mihomo → 如有则自动对接
  2. 如未安装 → 引导一键安装 (自动检测架构 amd64/arm64/armv7)
  3. 配置基础参数 (端口/密钥/TUN 模式)
  4. 导入初始配置或订阅
- 从 GitHub releases 下载最新版
- 创建 systemd service + TUN 路由修复脚本
- 复用 mihomo-manager.sh 的安装逻辑

#### 6.4 完整服务管理 (Web UI 内)
通过 Web 界面可管理所有服务的完整生命周期:

| 服务 | 操作 |
|------|------|
| **Mihomo 内核** | 安装 / 启动 / 停止 / 重启 / 更新 / 开机自启 / 卸载 |
| **mihomo-party Web 面板** | 更新检查 / 在线更新 / 查看版本 |
| **Tailscale** | 安装 / 连接 / 断开 / 重启 / 卸载 / 查看状态 |
| **GeoIP 数据库** | 更新 / 自动更新开关 / 查看版本 |
| **TUN 路由** | 启用 / 禁用 / 修复 / 状态检测 |

#### 6.5 完整卸载支持
Web UI 设置页面提供"系统维护"区域:
- **卸载 Mihomo**: 停止服务 → 删除二进制 → 删除 systemd 服务 → 可选删除配置
- **卸载 Tailscale**: 断开连接 → 清理 Mihomo 兼容配置 → 卸载
- **卸载 mihomo-party**: 提供命令提示，引导用户在终端执行 (Web 面板无法自己删除自己)
- **重置所有配置**: 清空数据库 + 重置为默认 config.yaml
- **导出配置备份**: 打包所有配置/数据库/YAML 为 tar.gz 下载

---

## 参考资源

### 从 neko-master 复用的关键代码

| 模块 | 源路径 | 用途 |
|------|--------|------|
| Mihomo WebSocket 收集器 | `apps/collector/src/modules/collector/gateway.collector.ts` | 连接 Mihomo `/connections` 实时推流 |
| 批量缓冲器 | `apps/collector/src/modules/collector/batch-buffer.ts` | 流量增量内存缓冲 + 定时刷盘 |
| 实时存储 | `apps/collector/src/modules/realtime/` | 内存增量 + DB 快照合并 |
| WebSocket 客户端 Hook | `apps/web/lib/websocket.ts` | 前端 WebSocket 订阅/自动重连 |
| REST API 客户端 | `apps/web/lib/api.ts` | 请求去重/时间范围查询 |
| 世界流量地图 | `apps/web/components/features/countries/world-traffic-map.tsx` | GeoIP 流量可视化 |
| 规则链流程图 | `apps/web/components/features/rules/rule-chain-flow.tsx` | 规则→策略组→节点 链路可视化 |
| 流量图表组件 | `apps/web/components/features/stats/charts/` | Recharts 流量/趋势图 |
| GeoIP 服务 | `apps/collector/src/modules/geo/geo.service.ts` | IP 地理定位 + 缓存 |
| 共享类型定义 | `packages/shared/src/index.ts` | Clash ConnectionsData 等类型 |
| 数据库 schema | `apps/collector/src/database/schema.ts` | 多维流量聚合表结构 |
| Docker 部署模式 | `Dockerfile` + `docker-compose.yml` | 多阶段构建模板 |

### 从 Zashboard (ClashMac) 借鉴的设计

| 特性 | 借鉴点 |
|------|--------|
| 虚拟滚动 | @tanstack/react-virtual (高性能长列表) |
| 拖拽排序 | @dnd-kit/core (规则优先级排序) |
| PWA 支持 | next-pwa (可安装为桌面应用) |
| 连接拓扑图 | 节点图可视化 (源IP→进程→规则→代理→出口) |
| 路由地图 | 全球连接可视化 (飞线动画) |
| 隐私模式 | 一键隐藏 IP/节点名 (安全截图) |

### 从 mihomo-manager 迁移的系统功能

| 功能 | 原始实现 | Web 化方式 |
|------|----------|-----------|
| Mihomo 安装/更新 | GitHub API + curl 下载 | 后端 API 封装，前端一键操作 |
| TUN 路由修复 | mihomo-rules.sh (ip rule) | 后端 Node.js child_process 执行 |
| Tailscale 集成 | tailscale CLI 调用 | 后端 API 封装 + 状态轮询 |
| Docker 代理配置 | sed 编辑 daemon.json | 后端读写 JSON 文件 |
| 网络连通性测试 | curl 并行测试 16 目标 | 后端并行请求 + WebSocket 推送进度 |
| Web UI 管理 | 下载 Metacubexd/Yacd | 本项目自身即为 Web UI |
| 日志查看 | journalctl | 后端 spawn journalctl + WebSocket 流式推送 |
| GeoIP 数据库更新 | curl 下载 mmdb/dat | 后端定时任务 + 手动触发 |

---

## 验证方案

### 开发阶段验证
1. **P0 完成后**: 在浏览器打开 Web UI，验证可以:
   - 添加/编辑/删除代理节点
   - 创建/编辑策略组 (包含正则过滤、外部 Provider)
   - 添加/排序规则
   - 点击"应用"生成正确的 config.yaml
   - Mihomo 成功加载生成的配置

2. **P1 完成后**: 验证 Dashboard 实时数据:
   - WebSocket 连接 Mihomo 成功
   - 实时网速/连接数/流量统计正常
   - 请求日志实时刷新

3. **P2 完成后**: 验证设置功能:
   - 修改 DNS/TUN/端口等设置后生成的 YAML 正确
   - 多配置切换正常

4. **P4 完成后**: 验证系统管理:
   - Web 端可安装/更新 Mihomo
   - TUN 路由修复正常
   - Docker 代理配置生效

### 端到端验证
- 在一台干净的 Linux VPS 上 `docker-compose up`
- 通过浏览器访问 Web UI
- 导入订阅/手动添加节点 → 配置策略组 → 添加规则 → 应用配置
- 验证 VPS 流量通过代理出站 (curl 测试)
- Dashboard 实时显示流量数据
