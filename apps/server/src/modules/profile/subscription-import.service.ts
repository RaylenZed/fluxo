import axios from 'axios';
import yaml from 'js-yaml';
import { randomUUID } from 'crypto';
import { getDb } from '../../database/db';
import { HttpError, assertNonEmptyName } from '../policy/policy.validation';

type JsonRecord = Record<string, unknown>;

type ImportedProxy = {
  name: string;
  type: string;
  server: string;
  port: number;
  config: JsonRecord;
};

type ExistingProxy = {
  id: string;
  name: string;
  config: string;
};

type ImportResult = {
  profileId: string;
  profileName: string;
  imported: number;
  created: number;
  updated: number;
  skipped: number;
};

const SUPPORTED_TYPES = new Set([
  'http',
  'https',
  'socks5',
  'socks5-tls',
  'ss',
  'vmess',
  'vless',
  'trojan',
  'snell',
  'tuic',
  'tuicv5',
  'hysteria2',
  'wireguard',
  'anytls',
  'ssh',
]);

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value === undefined || value === null ? '' : String(value).trim();
}

function numberValue(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(stringValue(value));
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : null;
}

function boolString(value: unknown): string {
  return value === true || value === 'true' || value === '1' || value === 1 ? 'true' : 'false';
}

function safeDecodeUri(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeBase64(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!normalized || normalized.length < 4) return null;

  try {
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf8').trim();
    return decoded && decoded !== value ? decoded : null;
  } catch {
    return null;
  }
}

function cleanName(value: string, fallback: string): string {
  const name = value.replace(/[\u0000\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
  return (name || fallback).slice(0, 160);
}

function stringifyHostHeader(host: string | undefined): string | undefined {
  return host ? JSON.stringify({ Host: host }) : undefined;
}

function stringifyOptionObject(value: unknown): string | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const parts = Object.entries(record)
    .map(([key, val]) => `${key}=${typeof val === 'object' ? JSON.stringify(val) : stringValue(val)}`)
    .filter((part) => part !== '=');

  return parts.length > 0 ? parts.join(';') : undefined;
}

function jsonString(value: unknown): string | undefined {
  const record = asRecord(value);
  return record ? JSON.stringify(record) : undefined;
}

function parseInlineList(value: unknown): string {
  if (Array.isArray(value)) return value.map(stringValue).filter(Boolean).join(',');
  return stringValue(value);
}

function applyCommonOptions(config: JsonRecord, source: JsonRecord) {
  if (source.udp !== undefined) config.udp = source.udp === true || source.udp === 1 || source.udp === 'true';
  if (source.tfo !== undefined) config.tfo = source.tfo === true || source.tfo === 1 || source.tfo === 'true';

  const sni = stringValue(source.sni || source.servername);
  if (sni) config.sni = sni;

  if (source['skip-cert-verify'] !== undefined || source.skipCert !== undefined) {
    config.skipCert = boolString(source['skip-cert-verify'] ?? source.skipCert);
  }
}

function applyTransportOptions(config: JsonRecord, source: JsonRecord) {
  const network = stringValue(source.network) || stringValue(source.net) || '';
  if (network) config.network = network;

  const wsOpts = asRecord(source['ws-opts']);
  if (network === 'ws' || wsOpts) {
    config.network = 'ws';
    if (wsOpts?.path !== undefined) config.wsPath = stringValue(wsOpts.path) || '/';
    if (wsOpts?.headers !== undefined) config.wsHeaders = jsonString(wsOpts.headers);
  }

  const httpOpts = asRecord(source['http-opts']);
  if (network === 'http' || httpOpts) {
    config.network = 'http';
    if (httpOpts?.path !== undefined) config.httpPath = parseInlineList(httpOpts.path) || '/';
    if (httpOpts?.headers !== undefined) {
      const headers = asRecord(httpOpts.headers);
      const host = headers?.Host ?? headers?.host;
      if (host !== undefined) config.httpHost = parseInlineList(host);
      config.httpHeaders = JSON.stringify(headers ?? httpOpts.headers);
    }
  }

  const h2Opts = asRecord(source['h2-opts']);
  if (network === 'h2' || h2Opts) {
    config.network = 'h2';
    if (h2Opts?.path !== undefined) config.h2Path = stringValue(h2Opts.path) || '/';
    if (h2Opts?.host !== undefined) config.h2Host = parseInlineList(h2Opts.host);
  }

  const grpcOpts = asRecord(source['grpc-opts']);
  if (network === 'grpc' || grpcOpts) {
    config.network = 'grpc';
    if (grpcOpts?.['grpc-service-name'] !== undefined) config.grpcServiceName = stringValue(grpcOpts['grpc-service-name']);
  }
}

function canonicalType(rawType: string): string {
  const type = rawType.toLowerCase();
  if (type === 'hy2') return 'hysteria2';
  if (type === 'socks') return 'socks5';
  return type;
}

function fromClashProxy(raw: unknown, index: number): ImportedProxy | null {
  const record = asRecord(raw);
  if (!record) return null;

  const type = canonicalType(stringValue(record.type));
  if (!SUPPORTED_TYPES.has(type)) return null;

  const server = stringValue(record.server);
  const port = numberValue(record.port);
  if (!server || !port) return null;

  const config: JsonRecord = {};
  const fallbackName = `${type}-${server}-${port}`;
  const name = cleanName(stringValue(record.name), fallbackName || `node-${index + 1}`);
  applyCommonOptions(config, record);

  if (type === 'http' || type === 'https' || type === 'socks5' || type === 'socks5-tls') {
    if (record.username !== undefined) config.username = stringValue(record.username);
    if (record.password !== undefined) config.password = stringValue(record.password);
    if (type === 'https' || type === 'socks5-tls') config.tls = 'true';
  }

  if (type === 'ss') {
    config.cipher = stringValue(record.cipher || record.method) || 'aes-256-gcm';
    config.password = stringValue(record.password);
    if (record.plugin !== undefined) config.plugin = stringValue(record.plugin);
    const pluginOpts = stringifyOptionObject(record['plugin-opts']);
    if (pluginOpts) config.pluginOpts = pluginOpts;
  }

  if (type === 'vmess') {
    config.uuid = stringValue(record.uuid || record.id);
    config.alterId = stringValue(record.alterId ?? record['alter-id'] ?? '0');
    config.cipher = stringValue(record.cipher) || 'auto';
    config.tls = record.tls === 'tls' ? 'true' : boolString(record.tls);
    applyTransportOptions(config, record);
  }

  if (type === 'vless') {
    config.uuid = stringValue(record.uuid || record.id);
    if (record.flow !== undefined) config.flow = stringValue(record.flow);
    const realityOpts = asRecord(record['reality-opts']);
    const security = realityOpts ? 'reality' : record.tls ? 'tls' : 'none';
    config.security = security;
    config.tls = security === 'none' ? 'false' : 'true';
    if (record['client-fingerprint'] !== undefined) config.fingerprint = stringValue(record['client-fingerprint']);
    if (realityOpts?.['public-key'] !== undefined) config.publicKey = stringValue(realityOpts['public-key']);
    if (realityOpts?.['short-id'] !== undefined) config.shortId = stringValue(realityOpts['short-id']);
    applyTransportOptions(config, record);
  }

  if (type === 'trojan') {
    config.password = stringValue(record.password);
    applyTransportOptions(config, record);
  }

  if (type === 'snell') {
    config.psk = stringValue(record.psk);
    config.version = stringValue(record.version || '3');
    const obfsOpts = asRecord(record['obfs-opts']);
    if (obfsOpts?.mode !== undefined) config.obfs = stringValue(obfsOpts.mode);
    if (obfsOpts?.host !== undefined) config.obfsHost = stringValue(obfsOpts.host);
  }

  if (type === 'tuic' || type === 'tuicv5') {
    config.uuid = stringValue(record.uuid);
    config.password = stringValue(record.password);
    if (record['congestion-controller'] !== undefined) config.congestion = stringValue(record['congestion-controller']);
    if (record.alpn !== undefined) config.alpn = parseInlineList(record.alpn);
    if (record['udp-relay-mode'] !== undefined) config.udpRelay = stringValue(record['udp-relay-mode']);
  }

  if (type === 'hysteria2') {
    config.password = stringValue(record.password);
    if (record.up !== undefined) config.up = stringValue(record.up);
    if (record.down !== undefined) config.down = stringValue(record.down);
    const obfs = asRecord(record.obfs);
    if (obfs) {
      if (obfs.type !== undefined) config.obfs = stringValue(obfs.type);
      if (obfs.password !== undefined) config.obfsPassword = stringValue(obfs.password);
    }
  }

  if (type === 'wireguard') {
    if (record.ip !== undefined) config.ip = stringValue(record.ip);
    if (record['private-key'] !== undefined) config.privateKey = stringValue(record['private-key']);
    if (record['public-key'] !== undefined) config.publicKey = stringValue(record['public-key']);
    if (record['pre-shared-key'] !== undefined) config.presharedKey = stringValue(record['pre-shared-key']);
    if (record.dns !== undefined) config.dns = parseInlineList(record.dns);
    if (record.mtu !== undefined) config.mtu = stringValue(record.mtu);
    if (record.reserved !== undefined) config.reserved = parseInlineList(record.reserved);
  }

  if (type === 'anytls') {
    config.password = stringValue(record.password);
  }

  if (type === 'ssh') {
    config.username = stringValue(record.username) || 'root';
    if (record.password !== undefined) config.password = stringValue(record.password);
    if (record['private-key'] !== undefined) config.privateKey = stringValue(record['private-key']);
    if (record['host-key'] !== undefined) config.hostKey = parseInlineList(record['host-key']);
  }

  return { name, type, server, port, config };
}

function parseQuery(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams.entries());
}

function proxyFromUrl(raw: string): ImportedProxy | null {
  const value = raw.trim();
  try {
    if (value.startsWith('vmess://')) {
      const encoded = value.slice(8).split('#')[0];
      const decoded = decodeBase64(encoded);
      if (!decoded) return null;
      const json = JSON.parse(decoded) as JsonRecord;
      const server = stringValue(json.add);
      const port = numberValue(json.port);
      if (!server || !port) return null;
      const network = stringValue(json.net) || 'tcp';
      return {
        type: 'vmess',
        server,
        port,
        name: cleanName(stringValue(json.ps) || safeDecodeUri(value.split('#')[1] ?? ''), `vmess-${server}-${port}`),
        config: {
          uuid: stringValue(json.id),
          alterId: stringValue(json.aid ?? '0'),
          cipher: stringValue(json.scy || json.type) || 'auto',
          network,
          ...(network === 'ws' ? { wsPath: stringValue(json.path) || '/', wsHeaders: stringifyHostHeader(stringValue(json.host) || undefined) } : {}),
          ...(network === 'http' ? { httpPath: stringValue(json.path) || '/', httpHost: stringValue(json.host) } : {}),
          ...(network === 'h2' ? { h2Path: stringValue(json.path) || '/', h2Host: stringValue(json.host) } : {}),
          ...(network === 'grpc' ? { grpcServiceName: stringValue(json.path || json.serviceName) } : {}),
          tls: stringValue(json.tls) === 'tls' ? 'true' : 'false',
          sni: stringValue(json.sni || json.host),
        },
      };
    }

    if (value.startsWith('vless://')) {
      const parsed = new URL(value.replace('vless://', 'http://'));
      const params = parseQuery(parsed);
      const server = parsed.hostname;
      const port = numberValue(parsed.port);
      if (!server || !port) return null;
      const network = params.type || 'tcp';
      const security = params.security || (params.tls === 'tls' || params.sni || params.servername ? 'tls' : 'none');
      return {
        type: 'vless',
        server,
        port,
        name: cleanName(safeDecodeUri(parsed.hash.slice(1)), `vless-${server}-${port}`),
        config: {
          uuid: parsed.username,
          flow: params.flow || '',
          network,
          ...(network === 'ws' ? { wsPath: params.path || '/', wsHeaders: stringifyHostHeader(params.host) } : {}),
          ...(network === 'http' ? { httpPath: params.path || '/', httpHost: params.host || '' } : {}),
          ...(network === 'h2' ? { h2Path: params.path || '/', h2Host: params.host || '' } : {}),
          ...(network === 'grpc' ? { grpcServiceName: params.serviceName || '' } : {}),
          security,
          tls: security === 'tls' || security === 'reality' ? 'true' : 'false',
          sni: params.sni || params.servername || '',
          fingerprint: params.fp || '',
          publicKey: params.pbk || params['public-key'] || '',
          shortId: params.sid || params['short-id'] || '',
          skipCert: params.allowInsecure === '1' || params.insecure === '1' ? 'true' : 'false',
        },
      };
    }

    if (value.startsWith('trojan://')) {
      const parsed = new URL(value.replace('trojan://', 'http://'));
      const params = parseQuery(parsed);
      const server = parsed.hostname;
      const port = numberValue(parsed.port);
      if (!server || !port) return null;
      const network = params.type || 'tcp';
      return {
        type: 'trojan',
        server,
        port,
        name: cleanName(safeDecodeUri(parsed.hash.slice(1)), `trojan-${server}-${port}`),
        config: {
          password: parsed.username,
          network,
          ...(network === 'ws' ? { wsPath: params.path || '/', wsHeaders: stringifyHostHeader(params.host) } : {}),
          ...(network === 'grpc' ? { grpcServiceName: params.serviceName || '' } : {}),
          sni: params.sni || params.peer || '',
          skipCert: params.allowInsecure === '1' || params.insecure === '1' ? 'true' : 'false',
        },
      };
    }

    if (value.startsWith('ss://')) {
      return parseShadowsocksUrl(value);
    }

    if (value.startsWith('hysteria2://') || value.startsWith('hy2://')) {
      const parsed = new URL(value.replace('hysteria2://', 'http://').replace('hy2://', 'http://'));
      const params = parseQuery(parsed);
      const server = parsed.hostname;
      const port = numberValue(parsed.port);
      if (!server || !port) return null;
      return {
        type: 'hysteria2',
        server,
        port,
        name: cleanName(safeDecodeUri(parsed.hash.slice(1)), `hysteria2-${server}-${port}`),
        config: {
          password: parsed.username,
          sni: params.sni || '',
          skipCert: params.insecure === '1' ? 'true' : 'false',
          obfs: params.obfs || '',
          obfsPassword: params['obfs-password'] || '',
          up: params.up || '',
          down: params.down || '',
        },
      };
    }

    if (value.startsWith('tuic://')) {
      const parsed = new URL(value.replace('tuic://', 'http://'));
      const params = parseQuery(parsed);
      const server = parsed.hostname;
      const port = numberValue(parsed.port);
      if (!server || !port) return null;
      return {
        type: 'tuic',
        server,
        port,
        name: cleanName(safeDecodeUri(parsed.hash.slice(1)), `tuic-${server}-${port}`),
        config: {
          uuid: parsed.username,
          password: parsed.password,
          congestion: params.congestion_control || params.congestion || 'bbr',
          alpn: params.alpn || 'h3',
          sni: params.sni || '',
          skipCert: params.allow_insecure === '1' || params.insecure === '1' ? 'true' : 'false',
        },
      };
    }
  } catch {
    return null;
  }

  return null;
}

function parseShadowsocksUrl(value: string): ImportedProxy | null {
  const hashIndex = value.indexOf('#');
  const name = hashIndex >= 0 ? safeDecodeUri(value.slice(hashIndex + 1)) : '';
  const withoutSchemeAndHash = hashIndex >= 0 ? value.slice(5, hashIndex) : value.slice(5);
  const [main] = withoutSchemeAndHash.split('?');

  try {
    if (main.includes('@')) {
      const parsed = new URL(`http://${main}`);
      const decodedUser = safeDecodeUri(parsed.username);
      const decodedPassword = safeDecodeUri(parsed.password);
      const decodedCredentials = decodedPassword ? `${decodedUser}:${decodedPassword}` : decodeBase64(decodedUser) || decodedUser;
      const splitIndex = decodedCredentials.indexOf(':');
      const cipher = splitIndex >= 0 ? decodedCredentials.slice(0, splitIndex) : decodedCredentials;
      const password = splitIndex >= 0 ? decodedCredentials.slice(splitIndex + 1) : decodedPassword;
      const port = numberValue(parsed.port);
      if (!parsed.hostname || !port || !cipher || !password) return null;
      return {
        type: 'ss',
        server: parsed.hostname,
        port,
        name: cleanName(name, `ss-${parsed.hostname}-${port}`),
        config: { cipher, password },
      };
    }

    const decoded = decodeBase64(main);
    if (!decoded) return null;
    const atIndex = decoded.lastIndexOf('@');
    const colonIndex = decoded.lastIndexOf(':');
    if (atIndex < 0 || colonIndex < atIndex) return null;

    const credentials = decoded.slice(0, atIndex);
    const host = decoded.slice(atIndex + 1, colonIndex);
    const port = numberValue(decoded.slice(colonIndex + 1));
    const splitIndex = credentials.indexOf(':');
    if (!host || !port || splitIndex < 0) return null;
    return {
      type: 'ss',
      server: host,
      port,
      name: cleanName(name, `ss-${host}-${port}`),
      config: {
        cipher: credentials.slice(0, splitIndex),
        password: credentials.slice(splitIndex + 1),
      },
    };
  } catch {
    return null;
  }
}

function parseYamlProxies(content: string): ImportedProxy[] {
  try {
    const parsed = yaml.load(content);
    const record = asRecord(parsed);
    const proxies = Array.isArray(record?.proxies) ? record.proxies : Array.isArray(parsed) ? parsed : [];
    return proxies
      .map((item, index) => fromClashProxy(item, index))
      .filter((item): item is ImportedProxy => item !== null);
  } catch {
    return [];
  }
}

export function parseSubscriptionContent(content: string): { proxies: ImportedProxy[]; skipped: number } {
  const directYaml = parseYamlProxies(content);
  if (directYaml.length > 0) {
    const seen = new Set<string>();
    return {
      proxies: directYaml.filter((proxy) => {
        const key = subscriptionKey(proxy);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
      skipped: 0,
    };
  }

  const variants = [content];
  const decoded = decodeBase64(content);
  if (decoded) variants.push(decoded);

  const seen = new Set<string>();
  const proxies: ImportedProxy[] = [];
  let skipped = 0;

  for (const variant of variants) {
    const yamlProxies = parseYamlProxies(variant);
    for (const proxy of yamlProxies) {
      const key = subscriptionKey(proxy);
      if (seen.has(key)) continue;
      seen.add(key);
      proxies.push(proxy);
    }

    for (const line of variant.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
      if (!/^[a-z0-9+.-]+:\/\//i.test(line)) continue;
      const proxy = proxyFromUrl(line);
      if (!proxy) {
        skipped += 1;
        continue;
      }

      const key = subscriptionKey(proxy);
      if (seen.has(key)) continue;
      seen.add(key);
      proxies.push(proxy);
    }
  }

  return { proxies, skipped };
}

function subscriptionKey(proxy: ImportedProxy): string {
  return `${proxy.type}|${proxy.name}|${proxy.server}|${proxy.port}`;
}

function deriveProfileName(url: string): string {
  try {
    const parsed = new URL(url);
    const tail = parsed.pathname.split('/').filter(Boolean).pop();
    return cleanName(tail ? `${parsed.hostname}/${tail}` : parsed.hostname, 'Imported Subscription');
  } catch {
    return 'Imported Subscription';
  }
}

function uniqueName(base: string, existingNames: Set<string>): string {
  const normalized = cleanName(base, 'Imported');
  if (!existingNames.has(normalized)) {
    existingNames.add(normalized);
    return normalized;
  }

  for (let i = 2; i < 10_000; i += 1) {
    const candidate = `${normalized} (${i})`;
    if (!existingNames.has(candidate)) {
      existingNames.add(candidate);
      return candidate;
    }
  }

  const fallback = `${normalized} (${Date.now()})`;
  existingNames.add(fallback);
  return fallback;
}

function parseConfigMetadata(config: string): JsonRecord {
  try {
    const parsed = JSON.parse(config);
    return asRecord(parsed) ?? {};
  } catch {
    return {};
  }
}

function findExistingBySource(rows: ExistingProxy[], url: string, key: string): ExistingProxy | undefined {
  return rows.find((row) => {
    const config = parseConfigMetadata(row.config);
    return config.subscriptionUrl === url && config.subscriptionKey === key;
  });
}

async function fetchSubscription(url: string): Promise<string> {
  const response = await axios.get<string>(url, {
    responseType: 'text',
    timeout: 20_000,
    maxContentLength: 8 * 1024 * 1024,
    transformResponse: (data) => data,
    headers: {
      'User-Agent': 'Fluxo/0.1.2',
      Accept: 'text/plain, application/x-yaml, application/yaml, */*',
    },
  });

  return typeof response.data === 'string' ? response.data : String(response.data ?? '');
}

export async function importSubscriptionFromUrl(data: { url: string; name?: string }): Promise<ImportResult> {
  const url = assertNonEmptyName(data.url, 'Subscription URL');
  if (!/^https?:\/\//i.test(url)) {
    throw new HttpError(400, 'Subscription URL must start with http:// or https://');
  }

  const content = await fetchSubscription(url);
  const { proxies, skipped } = parseSubscriptionContent(content);
  if (proxies.length === 0) {
    throw new HttpError(400, 'No supported proxy nodes found in subscription');
  }

  const db = getDb();
  const now = new Date().toISOString();
  const existingProfile = db.prepare('SELECT id, name FROM profiles WHERE description = ? LIMIT 1').get(url) as
    | { id: string; name: string }
    | undefined;

  let profileId = existingProfile?.id ?? randomUUID();
  let profileName = existingProfile?.name ?? cleanName(data.name ?? deriveProfileName(url), 'Imported Subscription');
  let created = 0;
  let updated = 0;

  const transaction = db.transaction(() => {
    const profileNames = new Set((db.prepare('SELECT name FROM profiles').all() as Array<{ name: string }>).map((row) => row.name));
    if (existingProfile) {
      db.prepare('UPDATE profiles SET updated_at = ? WHERE id = ?').run(now, profileId);
    } else {
      profileName = uniqueName(profileName, profileNames);
      db.prepare(
        `INSERT INTO profiles (id, name, description, is_active, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, 0, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM profiles), ?, ?)`
      ).run(profileId, profileName, url, now, now);
    }

    const existingRows = db.prepare('SELECT id, name, config FROM proxies').all() as ExistingProxy[];
    const proxyNames = new Set(existingRows.map((row) => row.name));
    const insertProxy = db.prepare(
      `INSERT INTO proxies (id, name, type, server, port, config, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM proxies), ?, ?)`
    );
    const updateProxy = db.prepare(
      `UPDATE proxies SET type = ?, server = ?, port = ?, config = ?, updated_at = ? WHERE id = ?`
    );

    for (const proxy of proxies) {
      const key = subscriptionKey(proxy);
      const existing = findExistingBySource(existingRows, url, key);
      const config = {
        ...proxy.config,
        subscriptionUrl: url,
        subscriptionProfileId: profileId,
        subscriptionName: proxy.name,
        subscriptionKey: key,
        subscriptionImportedAt: now,
      };

      if (existing) {
        updateProxy.run(proxy.type, proxy.server, proxy.port, JSON.stringify(config), now, existing.id);
        updated += 1;
        continue;
      }

      const id = randomUUID();
      const name = uniqueName(proxy.name, proxyNames);
      insertProxy.run(id, name, proxy.type, proxy.server, proxy.port, JSON.stringify(config), now, now);
      existingRows.push({ id, name, config: JSON.stringify(config) });
      created += 1;
    }
  });

  transaction();

  return {
    profileId,
    profileName,
    imported: created + updated,
    created,
    updated,
    skipped,
  };
}
