// Re-export shared types for convenience within the server package
export type {
  ProxyType,
  ProxyNode,
  ProxyProvider,
  GroupType,
  ProxyGroup,
  RuleType,
  Rule,
  RuleSet,
  Profile,
  MihomoStatus,
  TrafficStats,
  ConnectionInfo,
  MihomoConnectionsData,
  WsMessage,
  WsMessageType,
  ApiResponse,
} from '@fluxo/shared';

// Server-specific types
export interface DbRow {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface ProxyRow extends DbRow {
  name: string;
  type: string;
  server: string;
  port: number;
  config: string; // JSON
  sort_order: number;
}

export interface GroupRow extends DbRow {
  name: string;
  type: string;
  proxies: string; // JSON array
  providers: string; // JSON array
  url: string | null;
  interval: number;
  tolerance: number;
  filter: string | null;
  use_all_proxies: number;
  strategy: string | null;
  sort_order: number;
}

export interface RuleRow extends DbRow {
  type: string;
  value: string | null;
  policy: string;
  notify: number;
  extended_matching: number;
  sort_order: number;
  note: string;
}

export interface SettingRow {
  key: string;
  value: string; // JSON-encoded
  updated_at: string;
}
