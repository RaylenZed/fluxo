import yaml from 'js-yaml';
import { getDb } from '../../database/db';
import { getSetting, updateSettings } from '../settings/settings.service';
import { getEffectiveMihomoSecret, getMihomoHeaders } from '../mihomo/mihomo.config';

type MihomoRuntimeProxyState = {
  all?: string[];
  now?: string;
};

type MihomoRuntimeProxyMap = Record<string, MihomoRuntimeProxyState>;

function parseStringList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
  } catch {
    return [];
  }
}

function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
}

function collectProviderNamesFromGroup(
  groupName: string,
  groupByName: Map<string, { proxies: string | null; providers: string | null }>,
  visited = new Set<string>()
): string[] {
  if (visited.has(groupName)) return [];
  visited.add(groupName);

  const group = groupByName.get(groupName);
  if (!group) return [];

  const ownProviders = parseStringList(group.providers);
  const nestedProviders = parseStringList(group.proxies).flatMap((memberName) =>
    collectProviderNamesFromGroup(memberName, groupByName, visited)
  );

  return uniqueStrings([...ownProviders, ...nestedProviders]);
}

function parseInlineList(raw: string | null | undefined, fallback?: string): string[] {
  const source = raw?.trim() || fallback;
  if (!source) return [];
  return source
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonRecord(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function readProxyNameAliases(): Record<string, string> {
  const stored = getSetting('runtime.proxy_name_aliases');
  return stored && typeof stored === 'object' && !Array.isArray(stored)
    ? { ...(stored as Record<string, string>) }
    : {};
}

function clearProxyNameAliases() {
  updateSettings({ 'runtime.proxy_name_aliases': {} }, { internal: true });
}

function resolveRenamedProxyName(name: string, aliases: Record<string, string>): string {
  let current = name;
  const visited = new Set<string>();

  while (aliases[current] && !visited.has(current)) {
    visited.add(current);
    current = aliases[current];
  }

  return current;
}

function parseRuntimeProxyMap(payload: unknown): MihomoRuntimeProxyMap {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const proxies = (payload as { proxies?: unknown }).proxies;
  return proxies && typeof proxies === 'object' && !Array.isArray(proxies)
    ? proxies as MihomoRuntimeProxyMap
    : {};
}

function collectRuntimeSelections(proxyMap: MihomoRuntimeProxyMap): Record<string, string> {
  return Object.fromEntries(
    Object.entries(proxyMap)
      .filter(([, state]) => Array.isArray(state?.all) && typeof state.now === 'string' && state.now.length > 0)
      .map(([groupName, state]) => [groupName, state.now as string])
  );
}

function applyTransportOptions(base: Record<string, unknown>, cfg: Record<string, string>, network: string): void {
  switch (network) {
    case 'ws': {
      const wsOpts: Record<string, unknown> = { path: cfg.wsPath || '/' };
      const wsHeaders = parseJsonRecord(cfg.wsHeaders);
      if (wsHeaders) wsOpts.headers = wsHeaders;
      base['ws-opts'] = wsOpts;
      break;
    }
    case 'http': {
      const path = parseInlineList(cfg.httpPath, '/');
      const hosts = parseInlineList(cfg.httpHost);
      const httpHeaders = parseJsonRecord(cfg.httpHeaders) ?? {};
      if (hosts.length > 0 && httpHeaders.Host === undefined) {
        httpHeaders.Host = hosts;
      }

      const httpOpts: Record<string, unknown> = {
        method: cfg.httpMethod || 'GET',
        path: path.length > 0 ? path : ['/'],
      };
      if (Object.keys(httpHeaders).length > 0) httpOpts.headers = httpHeaders;
      base['http-opts'] = httpOpts;
      break;
    }
    case 'h2': {
      const h2Opts: Record<string, unknown> = { path: cfg.h2Path || '/' };
      const hosts = parseInlineList(cfg.h2Host);
      if (hosts.length > 0) h2Opts.host = hosts;
      base['h2-opts'] = h2Opts;
      break;
    }
    case 'grpc': {
      const grpcOpts: Record<string, unknown> = {};
      if (cfg.grpcServiceName) grpcOpts['grpc-service-name'] = cfg.grpcServiceName;
      if (Object.keys(grpcOpts).length > 0) base['grpc-opts'] = grpcOpts;
      break;
    }
    default:
      break;
  }
}

// ─── Proxy field normalizer ────────────────────────────────────────────────────
// The dialog stores all config values as strings in a JSON blob.
// This function maps those raw strings into the Mihomo YAML field names and types.
function normalizeProxy(row: { name: string; type: string; server: string; port: number; config: string }): Record<string, unknown> {
  const cfg: Record<string, string> = (() => {
    try { return JSON.parse(row.config) as Record<string, string>; } catch { return {}; }
  })();

  const base: Record<string, unknown> = {
    name: row.name,
    type: row.type,
    server: row.server,
    port: row.port,
  };

  // Universal options (stored as actual booleans from the dialog Switch components)
  if (cfg.udp === true as unknown as string || cfg.udp === 'true') base.udp = true;
  if (cfg.tfo === true as unknown as string || cfg.tfo === 'true') base.tfo = true;
  // remarks is Fluxo-internal — omit from Mihomo config

  const tlsBool = cfg.tls === 'true';
  const sni = cfg.sni ?? '';
  const skipCert = cfg.skipCert === 'true';

  switch (row.type) {
    case 'http':
    case 'https': {
      if (cfg.username) base.username = cfg.username;
      if (cfg.password) base.password = cfg.password;
      if (row.type === 'https') {
        base.tls = true;
        if (sni) base.sni = sni;
        if (skipCert) base['skip-cert-verify'] = true;
      }
      break;
    }
    case 'socks5':
    case 'socks5-tls': {
      if (cfg.username) base.username = cfg.username;
      if (cfg.password) base.password = cfg.password;
      if (row.type === 'socks5-tls') {
        base.tls = true;
        if (sni) base.sni = sni;
        if (skipCert) base['skip-cert-verify'] = true;
      }
      break;
    }
    case 'ss': {
      base.cipher = cfg.cipher || 'aes-256-gcm';
      base.password = cfg.password || '';
      if (cfg.plugin && cfg.plugin !== '__none__') {
        base.plugin = cfg.plugin;
        if (cfg.pluginOpts) {
          const opts: Record<string, string> = {};
          for (const part of cfg.pluginOpts.split(';')) {
            const [k, ...rest] = part.split('=');
            if (k?.trim()) opts[k.trim()] = rest.join('=').trim();
          }
          base['plugin-opts'] = opts;
        }
      }
      break;
    }
    case 'vmess': {
      base.uuid = cfg.uuid || '';
      base.alterId = parseInt(cfg.alterId || '0', 10);
      base.cipher = cfg.cipher || 'auto';
      base.network = cfg.network || 'tcp';
      if (tlsBool) {
        base.tls = true;
        if (sni) base.servername = sni;
        if (skipCert) base['skip-cert-verify'] = true;
      }
      applyTransportOptions(base, cfg, base.network as string);
      break;
    }
    case 'vless': {
      base.uuid = cfg.uuid || '';
      if (cfg.flow && cfg.flow !== '__none__') base.flow = cfg.flow;
      base.network = cfg.network || 'tcp';
      const security = cfg.security || (tlsBool ? 'tls' : 'none');
      if (security !== 'none') {
        base.tls = true;
        if (sni) base.servername = sni;
        if (skipCert) base['skip-cert-verify'] = true;
        if (security === 'reality') {
          if (cfg.fingerprint) base['client-fingerprint'] = cfg.fingerprint;

          const realityOpts: Record<string, string> = {};
          if (cfg.publicKey) realityOpts['public-key'] = cfg.publicKey;
          if (cfg.shortId) realityOpts['short-id'] = cfg.shortId;
          if (Object.keys(realityOpts).length > 0) base['reality-opts'] = realityOpts;
        }
      }
      applyTransportOptions(base, cfg, base.network as string);
      break;
    }
    case 'trojan': {
      base.password = cfg.password || '';
      base.network = cfg.network || 'tcp';
      base.tls = true; // Trojan always uses TLS
      if (sni) base.servername = sni;
      if (skipCert) base['skip-cert-verify'] = true;
      applyTransportOptions(base, cfg, base.network as string);
      break;
    }
    case 'snell': {
      base.psk = cfg.psk || '';
      base.version = parseInt(cfg.version || '3', 10);
      const obfsMode = cfg.obfs || 'simple';
      const obfsOpts: Record<string, unknown> = { mode: obfsMode };
      if (cfg.obfsHost) obfsOpts.host = cfg.obfsHost;
      base['obfs-opts'] = obfsOpts;
      break;
    }
    case 'tuic': {
      base.uuid = cfg.uuid || '';
      base.password = cfg.password || '';
      if (cfg.congestion) base['congestion-controller'] = cfg.congestion;
      if (cfg.udpRelay) base['udp-relay-mode'] = cfg.udpRelay;
      if (sni) base.sni = sni;
      if (skipCert) base['skip-cert-verify'] = true;
      break;
    }
    case 'tuicv5': {
      base.uuid = cfg.uuid || '';
      base.password = cfg.password || '';
      if (cfg.congestion) base['congestion-controller'] = cfg.congestion;
      if (cfg.alpn) base.alpn = cfg.alpn.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (sni) base.sni = sni;
      if (skipCert) base['skip-cert-verify'] = true;
      break;
    }
    case 'hysteria2': {
      base.password = cfg.password || '';
      if (cfg.up) base.up = parseInt(cfg.up, 10);
      if (cfg.down) base.down = parseInt(cfg.down, 10);
      if (cfg.obfs && cfg.obfs !== '__none__') {
        base.obfs = { type: cfg.obfs, password: cfg.obfsPassword || '' };
      }
      if (sni) base.sni = sni;
      if (skipCert) base['skip-cert-verify'] = true;
      break;
    }
    case 'wireguard': {
      if (cfg.ip) base.ip = cfg.ip;
      base['private-key'] = cfg.privateKey || '';
      base['public-key'] = cfg.publicKey || '';
      if (cfg.presharedKey) base['pre-shared-key'] = cfg.presharedKey;
      if (cfg.dns) base.dns = cfg.dns.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (cfg.mtu) base.mtu = parseInt(cfg.mtu, 10);
      if (cfg.reserved) {
        const parts = cfg.reserved.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n));
        if (parts.length > 0) base.reserved = parts;
      }
      break;
    }
    case 'anytls': {
      base.password = cfg.password || '';
      if (sni) base.sni = sni;
      if (skipCert) base['skip-cert-verify'] = true;
      break;
    }
    case 'ssh': {
      base.username = cfg.username || 'root';
      if (cfg.privateKey) {
        base['private-key'] = cfg.privateKey;
      } else if (cfg.password) {
        base.password = cfg.password;
      }
      if (cfg.hostKey) base['host-key'] = [cfg.hostKey];
      break;
    }
    default: {
      // Unknown type — pass through raw config minus internal fields
      const { udp: _u, tfo: _t, remarks: _r, sni: _s, skipCert: _sc, ...rest } = cfg;
      Object.assign(base, rest);
    }
  }

  return base;
}

export async function generateConfig(): Promise<string> {
  const db = getDb();

  // Load settings
  const settingsRows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const settings: Record<string, unknown> = {};
  for (const row of settingsRows) {
    settings[row.key] = JSON.parse(row.value);
  }

  // Load proxies
  const proxyRows = db.prepare('SELECT * FROM proxies ORDER BY sort_order').all() as any[];
  const proxies = proxyRows.map(row => normalizeProxy(row));
  const proxyNames = proxyRows.map((row) => row.name as string);

  // Load providers
  const providerRows = db.prepare('SELECT * FROM providers').all() as any[];
  const proxyProviders: Record<string, unknown> = {};
  for (const p of providerRows) {
    proxyProviders[p.name] = {
      type: 'http',
      url: p.url,
      interval: p.interval,
      path: `./providers/${p.name}.yaml`,
      ...(p.filter ? { filter: p.filter } : {}),
      ...(p.health_check_url ? { 'health-check': { enable: true, interval: 600, url: p.health_check_url } } : {}),
    };
  }

  // Load proxy groups
  const groupRows = db.prepare('SELECT * FROM proxy_groups ORDER BY sort_order').all() as any[];
  const groupByName = new Map<string, { proxies: string | null; providers: string | null }>(
    groupRows.map((row) => [row.name as string, { proxies: row.proxies, providers: row.providers }])
  );
  const proxyGroups = groupRows.flatMap(row => {
    const isDefaultGroup = row.id === 'default-proxy-group' || row.name === 'Proxy';
    let explicitProxies = parseStringList(row.proxies);
    let providers = parseStringList(row.providers);

    if (row.filter) {
      const providerGroupNames = explicitProxies.filter((memberName) =>
        collectProviderNamesFromGroup(memberName, groupByName).length > 0
      );
      if (providerGroupNames.length > 0) {
        providers = uniqueStrings([
          ...providers,
          ...providerGroupNames.flatMap((memberName) => collectProviderNamesFromGroup(memberName, groupByName)),
        ]);
        explicitProxies = explicitProxies.filter((memberName) => !providerGroupNames.includes(memberName));
      }
    }

    const includeAll = Boolean(row.use_all_proxies) || (isDefaultGroup && explicitProxies.length === 0 && providers.length === 0);
    const fallbackProxies = isDefaultGroup ? ['DIRECT'] : [];
    const proxiesForGroup = explicitProxies.length > 0 ? explicitProxies : fallbackProxies;

    if (proxiesForGroup.length === 0 && providers.length === 0 && !includeAll) {
      return [];
    }

    const base: Record<string, unknown> = {
      name: row.name,
      type: row.type,
    };
    if (proxiesForGroup.length > 0) {
      base.proxies = proxiesForGroup;
    }
    if (providers.length > 0) {
      base['use'] = providers;
    }
    if (row.filter) base['filter'] = row.filter;
    if (includeAll && (proxyNames.length > 0 || isDefaultGroup)) base['include-all'] = true;
    if (row.type === 'url-test' || row.type === 'fallback') {
      base['url'] = row.url || 'https://www.google.com/generate_204';
      base['interval'] = row.interval || 300;
      base['tolerance'] = row.tolerance || 150;
    }
    if (row.type === 'load-balance') {
      base['strategy'] = row.strategy || 'consistent-hashing';
    }
    return [base];
  });

  // Load rule providers
  const ruleProviderRows = db.prepare('SELECT * FROM rule_providers').all() as any[];
  const ruleProviders: Record<string, unknown> = {};
  for (const rp of ruleProviderRows) {
    ruleProviders[rp.name] = {
      type: rp.type,
      behavior: rp.behavior,
      ...(rp.url ? { url: rp.url } : {}),
      path: rp.path || `./rule-providers/${rp.name}.yaml`,
      interval: rp.interval || 86400,
    };
  }

  // Load rules
  const ruleRows = db.prepare('SELECT * FROM rules ORDER BY sort_order').all() as any[];
  const explicitRuleSetNames = new Set(
    ruleRows
      .filter((row) => row.type === 'RULE-SET' && typeof row.value === 'string' && row.value.length > 0)
      .map((row) => row.value as string)
  );

  const normalRules: string[] = [];
  const finalRules: string[] = [];
  for (const row of ruleRows) {
    const rendered = (() => {
      if (row.type === 'FINAL') return `MATCH,${row.policy}`;
      if (row.type === 'MATCH') return `MATCH,${row.policy}`;
      if (row.type === 'RULE-SET') return `RULE-SET,${row.value},${row.policy}`;
      if (!row.value) return `${row.type},${row.policy}`;

      return [row.type, row.value, row.policy].join(',');
    })();

    if (row.type === 'FINAL' || row.type === 'MATCH') {
      finalRules.push(rendered);
    } else {
      normalRules.push(rendered);
    }
  }

  const autoRuleProviderRules = ruleProviderRows
    .filter((rp) => !explicitRuleSetNames.has(rp.name))
    .map((rp) => `RULE-SET,${rp.name},${rp.policy}`);

  const rules = [...normalRules, ...autoRuleProviderRules, ...finalRules];

  // Load DNS config
  const dnsRow = db.prepare('SELECT * FROM dns_config WHERE id = 1').get() as any;

  // Build config object
  const config: Record<string, unknown> = {
    'mixed-port': settings['general.mixed_port'] ?? 7890,
    'allow-lan': settings['general.allow_lan'] ?? false,
    mode: settings['general.mode'] ?? 'rule',
    'log-level': settings['general.log_level'] ?? 'info',
    ipv6: settings['general.ipv6'] ?? false,
    'external-controller': settings['mihomo.external_controller'] ?? '127.0.0.1:9090',
    ...(getEffectiveMihomoSecret() ? { secret: getEffectiveMihomoSecret() } : {}),
  };

  // TUN section
  const tunEnable = settings['tun.enable'] === true || settings['tun.enable'] === 'true';
  // tun.dns_hijack may be stored as JSON array string or plain string
  const rawDnsHijack = (settings['tun.dns_hijack'] as string) ?? '["any:53"]';
  let dnsHijackArr: string[];
  try {
    const parsed = JSON.parse(rawDnsHijack);
    dnsHijackArr = Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    dnsHijackArr = rawDnsHijack.split(',').map((s: string) => s.trim()).filter(Boolean);
  }
  config['tun'] = {
    enable: tunEnable,
    stack: settings['tun.stack'] ?? 'system',
    'auto-route': settings['tun.auto_route'] ?? true,
    'auto-redirect': false,
    'dns-hijack': dnsHijackArr,
  };

  // DNS section
  if (dnsRow) {
    // Use mode column directly; fall back to enhanced_mode boolean for legacy rows
    const dnsMode = dnsRow.mode || (dnsRow.enhanced_mode ? 'fake-ip' : 'normal');
    const dns: Record<string, unknown> = {
      enable: Boolean(dnsRow.enable),
      'enhanced-mode': dnsMode,
      nameserver: JSON.parse(dnsRow.nameservers || '[]'),
      fallback: JSON.parse(dnsRow.fallback_dns || '[]'),
      'use-hosts': Boolean(dnsRow.use_hosts),
    };
    if (dnsMode === 'fake-ip') {
      dns['fake-ip-range'] = '198.18.0.0/15';
      dns['fake-ip-filter'] = JSON.parse(dnsRow.fake_ip_filter || '[]');
    }
    config['dns'] = dns;
  }

  if (proxies.length > 0) config['proxies'] = proxies;
  if (Object.keys(proxyProviders).length > 0) config['proxy-providers'] = proxyProviders;
  if (proxyGroups.length > 0) config['proxy-groups'] = proxyGroups;
  if (Object.keys(ruleProviders).length > 0) config['rule-providers'] = ruleProviders;
  if (rules.length > 0) config['rules'] = rules;

  return yaml.dump(config, { lineWidth: -1, quotingType: '"' });
}

export async function writeConfigAndReload(configPath: string, mihomoApiUrl: string, mihomoSecret?: string): Promise<void> {
  const fs = await import('fs/promises');
  const axios = (await import('axios')).default;

  const targetSecret = mihomoSecret ?? '';
  const headers = getMihomoHeaders(targetSecret);

  const beforeReloadSelections = await axios
    .get(`${mihomoApiUrl}/proxies`, { headers, timeout: 5000 })
    .then((res) => collectRuntimeSelections(parseRuntimeProxyMap(res.data)))
    .catch(() => ({} as Record<string, string>));

  const proxyNameAliases = readProxyNameAliases();

  const yamlContent = await generateConfig();
  const previousConfig = await fs.readFile(configPath, 'utf-8').catch(() => null);
  const previousSecret = extractConfigSecret(previousConfig);
  const reloadSecrets = Array.from(new Set([targetSecret, previousSecret, ''].filter((secret): secret is string => secret !== null)));
  await fs.writeFile(configPath, yamlContent, 'utf-8');

  // Reload via Mihomo REST API
  try {
    await reloadWithSecrets(axios, mihomoApiUrl, configPath, reloadSecrets);
  } catch (err) {
    if (previousConfig !== null) {
      await fs.writeFile(configPath, previousConfig, 'utf-8');
      await reloadWithSecrets(axios, mihomoApiUrl, configPath, reloadSecrets).catch(() => undefined);
    }
    throw err;
  }

  try {
    const runtimeProxyMap = await axios
      .get(`${mihomoApiUrl}/proxies`, { headers, timeout: 5000 })
      .then((res) => parseRuntimeProxyMap(res.data));

    for (const [groupName, selectedName] of Object.entries(beforeReloadSelections)) {
      const runtimeGroup = runtimeProxyMap[groupName];
      if (!runtimeGroup || !Array.isArray(runtimeGroup.all) || runtimeGroup.all.length === 0) continue;

      const restoredName = resolveRenamedProxyName(selectedName, proxyNameAliases);
      if (!runtimeGroup.all.includes(restoredName) || runtimeGroup.now === restoredName) continue;

      await axios.put(
        `${mihomoApiUrl}/proxies/${encodeURIComponent(groupName)}`,
        { name: restoredName },
        { headers, timeout: 5000 },
      );
    }
  } finally {
    clearProxyNameAliases();
  }
}

function extractConfigSecret(content: string | null): string | null {
  if (!content) return null;
  try {
    const parsed = yaml.load(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const secret = (parsed as Record<string, unknown>).secret;
      return typeof secret === 'string' ? secret : null;
    }
  } catch {
    return null;
  }
  return null;
}

async function reloadWithSecrets(
  axios: typeof import('axios').default,
  mihomoApiUrl: string,
  configPath: string,
  secrets: string[],
) {
  let lastError: unknown;
  for (const secret of secrets) {
    try {
      await axios.put(
        `${mihomoApiUrl}/configs`,
        { path: configPath },
        { headers: getMihomoHeaders(secret), timeout: 5000 },
      );
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
