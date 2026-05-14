// Use relative path so requests go to the same origin (Next.js proxies /api/* to Fastify backend)
const API_BASE = '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? res.statusText);
  }
  return res.json();
}

// --- Proxy types (matching backend DB rows) ---
export interface ProxyRow {
  id: string;
  name: string;
  type: string;
  server: string;
  port: number;
  config: string; // JSON string
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GroupRow {
  id: string;
  name: string;
  type: string;
  proxies: string; // JSON array string
  providers: string;
  url?: string;
  interval?: number;
  tolerance?: number;
  filter?: string;
  use_all_proxies: number;
  strategy?: string;
  sort_order: number;
}

export interface ProviderRow {
  id: string;
  name: string;
  url: string;
  interval: number;
  filter: string | null;
  health_check_url: string | null;
  last_updated: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderPreviewResult {
  count: number;
  skipped: number;
  names: string[];
}

export interface RuleRow {
  id: string;
  type: string;
  value: string;
  policy: string;
  notify: number;
  extended_matching: number;
  sort_order: number;
  note: string;
}

export interface ProfileRow {
  id: string;
  name: string;
  description: string;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ImportSubscriptionResult {
  profileId: string;
  profileName: string;
  imported: number;
  created: number;
  updated: number;
  skipped: number;
}

export interface MihomoProxyState {
  name: string;
  type: string;
  all?: string[];
  now?: string;
  alive?: boolean;
}

export interface MihomoProxiesResponse {
  proxies: Record<string, MihomoProxyState>;
}

// --- Proxies ---
export const proxiesApi = {
  list: () => request<ProxyRow[]>('/api/proxies'),
  create: (data: { name: string; type: string; server: string; port: number; config: Record<string, unknown> }) =>
    request<{ id: string }>('/api/proxies', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ name: string; type: string; server: string; port: number; config: Record<string, unknown> }>) =>
    request<{ ok: boolean }>(`/api/proxies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ ok: boolean }>(`/api/proxies/${id}`, { method: 'DELETE' }),
};

// --- Groups ---
export const groupsApi = {
  list: () => request<GroupRow[]>('/api/groups'),
  create: (data: Record<string, unknown>) =>
    request<{ id: string }>('/api/groups', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/api/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ ok: boolean }>(`/api/groups/${id}`, { method: 'DELETE' }),
};

// --- Providers ---
export const providersApi = {
  list: () => request<ProviderRow[]>('/api/providers'),
  preview: (data: { url: string }) =>
    request<ProviderPreviewResult>('/api/providers/preview', { method: 'POST', body: JSON.stringify(data) }),
};

// --- Rules ---
export const rulesApi = {
  list: () => request<RuleRow[]>('/api/rules'),
  create: (data: Partial<RuleRow>) =>
    request<{ id: string }>('/api/rules', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<RuleRow>) =>
    request<{ ok: boolean }>(`/api/rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ ok: boolean }>(`/api/rules/${id}`, { method: 'DELETE' }),
  reorder: (ids: string[]) =>
    request<{ ok: boolean }>('/api/rules/reorder', { method: 'PUT', body: JSON.stringify({ ids }) }),
};

// --- Settings ---
export const settingsApi = {
  get: () => request<Record<string, unknown>>('/api/settings'),
  update: (data: Record<string, unknown>) =>
    request<{ ok: boolean }>('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  generateConfig: () => request<string>('/api/config/generated'),
  applyConfig: () => request<{ ok: boolean; configPath: string }>('/api/config/apply', { method: 'POST' }),
};

// --- Profiles ---
export const profilesApi = {
  list: () => request<ProfileRow[]>('/api/profiles'),
  create: (data: { name: string; description?: string }) =>
    request<{ id: string }>('/api/profiles', { method: 'POST', body: JSON.stringify(data) }),
  importUrl: (data: { url: string; name?: string }) =>
    request<ImportSubscriptionResult>('/api/profiles/import-url', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ProfileRow>) =>
    request<{ ok: boolean }>(`/api/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ ok: boolean }>(`/api/profiles/${id}`, { method: 'DELETE' }),
  activate: (id: string) =>
    request<{ ok: boolean }>(`/api/profiles/${id}/activate`, { method: 'POST' }),
};

// --- Mihomo ---
export const mihomoApi = {
  status: () => request<{ running: boolean; version: string | null }>('/api/mihomo/status'),
  version: () => request<{ version: string }>('/api/mihomo/version'),
  proxies: () => request<MihomoProxiesResponse>('/api/mihomo/proxies'),
  connections: () => request<{ connections: unknown[]; downloadTotal: number; uploadTotal: number }>('/api/mihomo/connections'),
  closeAllConnections: () => request<void>('/api/mihomo/connections', { method: 'DELETE' }),
  closeConnection: (id: string) => request<void>(`/api/mihomo/connections/${id}`, { method: 'DELETE' }),
  reload: () => request<{ ok: boolean }>('/api/mihomo/reload', { method: 'POST' }),
};

// --- Auth ---
export const authApi = {
  me: () => request<{ authenticated: boolean; setupRequired: boolean }>('/api/auth/me'),
  login: (password: string) =>
    request<{ ok: boolean }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  setup: (password: string) =>
    request<{ ok: boolean }>('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
};
