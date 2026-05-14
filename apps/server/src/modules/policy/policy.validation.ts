import { getDb } from '../../database/db';

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const BUILTIN_POLICIES = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS']);
const GROUP_TYPES = new Set(['select', 'url-test', 'fallback', 'load-balance']);
const PROVIDER_TYPES = new Set(['http', 'file', 'inline']);
const RULE_PROVIDER_BEHAVIORS = new Set(['domain', 'ipcidr', 'classical']);

export function parseNameList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
  } catch {
    return [];
  }
}

export function assertNonEmptyName(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${label} is required`);
  }
  return value.trim();
}

export function assertValidGroupType(type: string) {
  if (!GROUP_TYPES.has(type)) {
    throw new HttpError(400, `Unsupported group type: ${type}`);
  }
}

export function assertValidProviderType(type: string) {
  if (!PROVIDER_TYPES.has(type)) {
    throw new HttpError(400, `Unsupported provider type: ${type}`);
  }
}

export function assertValidRuleProviderBehavior(behavior: string) {
  if (!RULE_PROVIDER_BEHAVIORS.has(behavior)) {
    throw new HttpError(400, `Unsupported rule provider behavior: ${behavior}`);
  }
}

export function assertPolicyExists(policy: string) {
  if (BUILTIN_POLICIES.has(policy)) return;

  const db = getDb();
  const group = db.prepare('SELECT 1 FROM proxy_groups WHERE name = ?').get(policy);
  if (group) return;

  const proxy = db.prepare('SELECT 1 FROM proxies WHERE name = ?').get(policy);
  if (proxy) return;

  throw new HttpError(400, `Policy does not exist: ${policy}`);
}

export function assertRuleProviderExists(name: string) {
  const existing = getDb().prepare('SELECT 1 FROM rule_providers WHERE name = ?').get(name);
  if (!existing) {
    throw new HttpError(400, `Rule provider does not exist: ${name}`);
  }
}

export function assertGroupMembersExist(groupId: string | null, proxies: string[], providers: string[]) {
  const db = getDb();

  for (const proxyName of proxies) {
    if (BUILTIN_POLICIES.has(proxyName)) continue;

    const proxy = db.prepare('SELECT 1 FROM proxies WHERE name = ?').get(proxyName);
    const group = db.prepare('SELECT 1 FROM proxy_groups WHERE name = ? AND id != ?').get(proxyName, groupId ?? '');
    if (!proxy && !group) {
      throw new HttpError(400, `Proxy or group does not exist: ${proxyName}`);
    }
  }

  for (const providerName of providers) {
    const provider = db.prepare('SELECT 1 FROM providers WHERE name = ?').get(providerName);
    if (!provider) {
      throw new HttpError(400, `Proxy provider does not exist: ${providerName}`);
    }
  }
}

export function getHttpStatus(err: unknown): number {
  return typeof (err as { statusCode?: unknown }).statusCode === 'number'
    ? (err as { statusCode: number }).statusCode
    : 500;
}
