// ============================================================
// Proxy Node Types
// ============================================================
export type ProxyType =
  | "http"
  | "https"
  | "socks5"
  | "socks5-tls"
  | "ssh"
  | "snell"
  | "ss"
  | "vmess"
  | "vless"
  | "trojan"
  | "anytls"
  | "tuic"
  | "tuic5"
  | "hysteria2"
  | "wireguard";

export interface ProxyNode {
  id: string;
  name: string;
  type: ProxyType;
  server: string;
  port: number;
  // Auth
  password?: string;
  username?: string;
  uuid?: string;
  // TLS
  sni?: string;
  tls?: boolean;
  skipCertVerify?: boolean;
  // Protocol-specific
  obfs?: string;
  obfsParam?: string;
  network?: string;
  wsPath?: string;
  wsHeaders?: Record<string, string>;
  // TUIC
  congestionController?: string;
  // Hysteria2
  up?: string;
  down?: string;
  // WireGuard
  privateKey?: string;
  publicKey?: string;
  ip?: string;
  mtu?: number;
  // Extra
  udp?: boolean;
  tfo?: boolean;
  quicDisable?: boolean;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Proxy Provider (Subscription) Types
// ============================================================
export interface ProxyProvider {
  id: string;
  name: string;
  url: string;
  interval: number; // seconds
  healthCheckUrl?: string;
  filter?: string; // regex
  nodeCount?: number;
  lastUpdated?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Proxy Group Types
// ============================================================
export type GroupType = "select" | "url-test" | "fallback" | "load-balance";

export interface ProxyGroup {
  id: string;
  name: string;
  type: GroupType;
  // proxies: list of proxy node names or group names
  proxies: string[];
  // providers: list of proxy-provider names
  providers?: string[];
  // Filter (regex) applied to provider nodes
  filter?: string;
  // URL test settings
  url?: string;
  interval?: number;
  tolerance?: number;
  // Load balance strategy
  strategy?: "consistent-hashing" | "round-robin";
  // Currently selected proxy (for select type)
  selected?: string;
  hidden?: boolean;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Rule Types
// ============================================================
export type RuleType =
  | "DOMAIN"
  | "DOMAIN-SUFFIX"
  | "DOMAIN-KEYWORD"
  | "DOMAIN-WILDCARD"
  | "DOMAIN-SET"
  | "IP-CIDR"
  | "IP-CIDR6"
  | "GEOIP"
  | "IP-ASN"
  | "PROCESS-NAME"
  | "USER-AGENT"
  | "URL-REGEX"
  | "IN-PORT"
  | "DEST-PORT"
  | "SRC-PORT"
  | "SRC-IP"
  | "DEVICE-NAME"
  | "PROTOCOL"
  | "SUBNET"
  | "HOSTNAME-TYPE"
  | "RULE-SET"
  | "MATCH";

export interface Rule {
  id: string;
  order: number;
  type: RuleType;
  payload: string;
  policy: string; // group name or DIRECT/REJECT
  noResolve?: boolean;
  extendedMatching?: boolean;
  notify?: boolean;
  remarks?: string;
  enabled: boolean;
  groupLabel?: string; // for UI grouping display
  hitCount?: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Rule Set Types
// ============================================================
export type RuleSetType = "system" | "lan" | "external" | "inline";

export interface RuleSet {
  id: string;
  name: string;
  type: RuleSetType;
  url?: string; // for external type
  interval?: number; // auto-update seconds
  noResolve?: boolean;
  extendedMatching?: boolean;
  policy: string;
  ruleCount?: number;
  lastUpdated?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// DNS Settings
// ============================================================
export type DnsMode = "system" | "system-with-custom" | "custom";

export interface DnsSettings {
  mode: DnsMode;
  servers: string[];
  // Encrypted DNS (DoH/DoT/DoQ)
  encryptedServers: string[];
  // Options
  useHostsFile: boolean;
  resolveAllDomains: boolean;
  // Fake-IP
  fakeIpEnabled: boolean;
  fakeIpRange: string;
  fakeIpFilter: string[];
  // Local DNS mapping
  hosts: Array<{ domain: string; value: string; dnsServer?: string; remarks?: string }>;
}

// ============================================================
// General Settings
// ============================================================
export type ProxyMode = "rule" | "global" | "direct";
export type LogLevel = "silent" | "error" | "warning" | "info" | "debug";

export interface GeneralSettings {
  // Ports
  mixedPort: number;
  httpPort: number;
  socksPort: number;
  // Network
  allowLan: boolean;
  bindAddress: string;
  mode: ProxyMode;
  logLevel: LogLevel;
  ipv6: boolean;
  // TUN
  tun: TunSettings;
  // External Controller
  externalController: string;
  externalControllerSecret: string;
  externalUi?: string;
  // Advanced
  tcpConcurrent: boolean;
  geodataMode: boolean;
  geoipUrl: string;
  geositeUrl: string;
  // Test URLs
  proxyTestUrl: string;
  testTimeout: number;
  // Sniffer
  snifferEnabled: boolean;
  findProcessMode: "strict" | "off" | "always";
}

export interface TunSettings {
  enable: boolean;
  stack: "system" | "gvisor" | "mixed";
  autoRoute: boolean;
  autoDetectInterface: boolean;
  dnsHijack: string[];
  strictRoute: boolean;
}

// ============================================================
// Profile (Config file)
// ============================================================
export interface Profile {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  proxyCount: number;
  ruleCount: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Realtime / Monitoring Types
// ============================================================
export interface TrafficStats {
  up: number; // bytes/s
  down: number; // bytes/s
  totalUp: number;
  totalDown: number;
}

export interface ConnectionInfo {
  id: string;
  metadata: {
    network: string;
    type: string;
    sourceIP: string;
    sourcePort: string;
    destinationIP: string;
    destinationPort: string;
    host: string;
    dnsMode: string;
    processPath: string;
    specialProxy: string;
    uid: number;
  };
  upload: number;
  download: number;
  start: string;
  chains: string[];
  rule: string;
  rulePayload: string;
}

export interface MihomoConnectionsData {
  downloadTotal: number;
  uploadTotal: number;
  connections: ConnectionInfo[];
  memory: number;
}

// ============================================================
// System Info
// ============================================================
export interface MihomoStatus {
  running: boolean;
  version?: string;
  tunActive?: boolean;
  pid?: number;
}

export interface SystemInfo {
  os: string;
  arch: string;
  hostname: string;
  uptime: number;
}

// ============================================================
// WebSocket Message Types
// ============================================================
export type WsMessageType =
  | "traffic"
  | "connections"
  | "logs"
  | "mihomo_status"
  | "subscribe"
  | "unsubscribe";

export interface WsMessage<T = unknown> {
  type: WsMessageType;
  data: T;
}

// ============================================================
// API Response Types
// ============================================================
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
