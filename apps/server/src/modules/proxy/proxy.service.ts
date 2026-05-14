import { getDb } from '../../database/db';
import { randomUUID } from 'crypto';
import { getSetting, updateSettings } from '../settings/settings.service';
import { HttpError, assertNonEmptyName } from '../policy/policy.validation';

function parseProxyNames(raw: string | null | undefined): string[] {
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

function dedupeProxyNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const name of names) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }

  return result;
}

function updateGroupProxyReferences(transform: (names: string[]) => string[], changedName: string) {
  const db = getDb();
  const groups = db.prepare('SELECT id, proxies FROM proxy_groups').all() as Array<{ id: string; proxies: string }>;
  const now = new Date().toISOString();
  const stmt = db.prepare('UPDATE proxy_groups SET proxies = ?, updated_at = ? WHERE id = ?');

  for (const group of groups) {
    const currentNames = parseProxyNames(group.proxies);
    if (!currentNames.includes(changedName)) continue;

    const nextNames = dedupeProxyNames(transform(currentNames));
    if (JSON.stringify(nextNames) === JSON.stringify(currentNames)) continue;

    stmt.run(JSON.stringify(nextNames), now, group.id);
  }
}

function updatePolicyReferences(oldName: string, nextName: string) {
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare('UPDATE rules SET policy = ?, updated_at = ? WHERE policy = ?').run(nextName, now, oldName);
  db.prepare('UPDATE rule_providers SET policy = ?, updated_at = ? WHERE policy = ?').run(nextName, now, oldName);
}

function getProxyNameAliases(): Record<string, string> {
  const stored = getSetting('runtime.proxy_name_aliases');
  return stored && typeof stored === 'object' && !Array.isArray(stored)
    ? { ...(stored as Record<string, string>) }
    : {};
}

function saveProxyNameAliases(aliases: Record<string, string>) {
  updateSettings({ 'runtime.proxy_name_aliases': aliases }, { internal: true });
}

function assertProxyCanBeRemovedFromGroups(proxyName: string) {
  const db = getDb();
  const groups = db.prepare('SELECT id, name, proxies, providers, use_all_proxies FROM proxy_groups').all() as Array<{
    id: string;
    name: string;
    proxies: string;
    providers: string;
    use_all_proxies: number;
  }>;

  for (const group of groups) {
    const currentProxies = parseProxyNames(group.proxies);
    if (!currentProxies.includes(proxyName)) continue;

    const remainingProxies = currentProxies.filter((name) => name !== proxyName);
    const providers = parseProxyNames(group.providers);
    const isDefaultGroup = group.id === 'default-proxy-group' || group.name === 'Proxy';
    const hasFallbackMembers = isDefaultGroup || group.use_all_proxies === 1 || providers.length > 0 || remainingProxies.length > 0;

    if (!hasFallbackMembers) {
      throw new HttpError(409, `Proxy is the last member of policy group: ${group.name}`);
    }
  }
}

export function getAllProxies() {
  return getDb().prepare('SELECT * FROM proxies ORDER BY sort_order').all();
}

export function getProxyById(id: string) {
  return getDb().prepare('SELECT * FROM proxies WHERE id = ?').get(id);
}

export function createProxy(data: {
  name: string;
  type: string;
  server: string;
  port: number;
  config: Record<string, unknown>;
}) {
  const name = assertNonEmptyName(data.name, 'Proxy name');
  const type = assertNonEmptyName(data.type, 'Proxy type');
  const server = assertNonEmptyName(data.server, 'Server');
  if (!Number.isInteger(data.port) || data.port <= 0 || data.port > 65535) {
    throw new HttpError(400, 'Port must be between 1 and 65535');
  }

  const existing = getDb().prepare('SELECT 1 FROM proxies WHERE name = ?').get(name);
  if (existing) throw new HttpError(409, `Proxy already exists: ${name}`);

  const now = new Date().toISOString();
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO proxies (id, name, type, server, port, config, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM proxies), ?, ?)`
    )
    .run(id, name, type, server, data.port, JSON.stringify(data.config), now, now);
  return { id };
}

export function updateProxy(
  id: string,
  data: Partial<{ name: string; type: string; server: string; port: number; config: Record<string, unknown> }>
) {
  const db = getDb();
  const existing = db.prepare('SELECT name FROM proxies WHERE id = ?').get(id) as { name: string } | undefined;
  if (!existing) throw new HttpError(404, 'Proxy not found');

  if (data.name !== undefined) {
    const nextName = assertNonEmptyName(data.name, 'Proxy name');
    const duplicate = db.prepare('SELECT 1 FROM proxies WHERE name = ? AND id != ?').get(nextName, id);
    if (duplicate) throw new HttpError(409, `Proxy already exists: ${nextName}`);
    data.name = nextName;
  }
  if (data.server !== undefined) data.server = assertNonEmptyName(data.server, 'Server');
  if (data.type !== undefined) data.type = assertNonEmptyName(data.type, 'Proxy type');
  if (data.port !== undefined && (!Number.isInteger(data.port) || data.port <= 0 || data.port > 65535)) {
    throw new HttpError(400, 'Port must be between 1 and 65535');
  }

  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now];
  if (data.name !== undefined) { sets.push('name = ?'); vals.push(data.name); }
  if (data.type !== undefined) { sets.push('type = ?'); vals.push(data.type); }
  if (data.server !== undefined) { sets.push('server = ?'); vals.push(data.server); }
  if (data.port !== undefined) { sets.push('port = ?'); vals.push(data.port); }
  if (data.config !== undefined) { sets.push('config = ?'); vals.push(JSON.stringify(data.config)); }
  vals.push(id);

  const update = db.transaction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.prepare(`UPDATE proxies SET ${sets.join(', ')} WHERE id = ?`).run(...(vals as any[]));

    if (data.name !== undefined && data.name !== existing.name) {
      const nextName = data.name;
      updateGroupProxyReferences(
        (names) => names.map((name) => (name === existing.name ? nextName : name)),
        existing.name
      );
      updatePolicyReferences(existing.name, nextName);

      const aliases = getProxyNameAliases();
      for (const [from, to] of Object.entries(aliases)) {
        if (to === existing.name) aliases[from] = nextName;
      }
      aliases[existing.name] = nextName;
      saveProxyNameAliases(aliases);
    }
  });

  update();
}

export function deleteProxy(id: string) {
  const db = getDb();
  const existing = db.prepare('SELECT name FROM proxies WHERE id = ?').get(id) as { name: string } | undefined;
  if (!existing) throw new HttpError(404, 'Proxy not found');

  const ruleRefs = (db.prepare('SELECT COUNT(*) as count FROM rules WHERE policy = ?').get(existing.name) as { count: number }).count;
  const ruleProviderRefs = (db.prepare('SELECT COUNT(*) as count FROM rule_providers WHERE policy = ?').get(existing.name) as { count: number }).count;
  if (ruleRefs > 0 || ruleProviderRefs > 0) {
    throw new HttpError(409, `Proxy is still used as a policy by ${ruleRefs + ruleProviderRefs} rule(s)`);
  }
  assertProxyCanBeRemovedFromGroups(existing.name);

  const remove = db.transaction(() => {
    db.prepare('DELETE FROM proxies WHERE id = ?').run(id);
    updateGroupProxyReferences(
      (names) => names.filter((name) => name !== existing.name),
      existing.name
    );

    const aliases = getProxyNameAliases();
    let changed = false;
    for (const key of Object.keys(aliases)) {
      if (key === existing.name || aliases[key] === existing.name) {
        delete aliases[key];
        changed = true;
      }
    }
    if (changed) saveProxyNameAliases(aliases);
  });

  remove();
}
