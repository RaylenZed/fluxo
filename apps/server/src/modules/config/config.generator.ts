import yaml from 'js-yaml';
import { getDb } from '../../database/db';

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
      if (cfg.network === 'ws') {
        const wsOpts: Record<string, unknown> = { path: cfg.wsPath || '/' };
        if (cfg.wsHeaders) {
          try { wsOpts.headers = JSON.parse(cfg.wsHeaders); } catch { /* ignore malformed JSON */ }
        }
        base['ws-opts'] = wsOpts;
      }
      break;
    }
    case 'vless': {
      base.uuid = cfg.uuid || '';
      if (cfg.flow && cfg.flow !== '__none__') base.flow = cfg.flow;
      base.network = cfg.network || 'tcp';
      if (tlsBool) {
        base.tls = true;
        if (sni) base.servername = sni;
        if (skipCert) base['skip-cert-verify'] = true;
      }
      break;
    }
    case 'trojan': {
      base.password = cfg.password || '';
      base.network = cfg.network || 'tcp';
      base.tls = true; // Trojan always uses TLS
      if (sni) base.servername = sni;
      if (skipCert) base['skip-cert-verify'] = true;
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
  const proxyGroups = groupRows.map(row => {
    const base: Record<string, unknown> = {
      name: row.name,
      type: row.type,
      proxies: JSON.parse(row.proxies),
    };
    if (row.providers && JSON.parse(row.providers).length > 0) {
      base['use'] = JSON.parse(row.providers);
    }
    if (row.filter) base['filter'] = row.filter;
    if (row.use_all_proxies) base['include-all'] = true;
    if (row.type === 'url-test' || row.type === 'fallback') {
      base['url'] = row.url || 'https://www.google.com/generate_204';
      base['interval'] = row.interval || 300;
      base['tolerance'] = row.tolerance || 150;
    }
    if (row.type === 'load-balance') {
      base['strategy'] = row.strategy || 'consistent-hashing';
    }
    return base;
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
  const rules = ruleRows.map(row => {
    if (row.type === 'FINAL') return `MATCH,${row.policy}`;
    if (row.type === 'RULE-SET') return `RULE-SET,${row.value},${row.policy}`;
    if (!row.value) return `${row.type},${row.policy}`;
    const parts = [row.type, row.value, row.policy];
    // notify column stores the "no-resolve" flag for IP-type rules
    if (row.notify) parts.push('no-resolve');
    return parts.join(',');
  });

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
    ...(settings['mihomo.secret'] ? { secret: settings['mihomo.secret'] } : {}),
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

  const yamlContent = await generateConfig();
  await fs.writeFile(configPath, yamlContent, 'utf-8');

  // Reload via Mihomo REST API
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (mihomoSecret) headers['Authorization'] = `Bearer ${mihomoSecret}`;
  await axios.put(`${mihomoApiUrl}/configs`, { path: configPath }, { headers });
}
