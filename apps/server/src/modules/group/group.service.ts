import { getDb } from '../../database/db';
import { randomUUID } from 'crypto';
import {
  HttpError,
  assertGroupMembersExist,
  assertNonEmptyName,
  assertValidGroupType,
  parseNameList,
} from '../policy/policy.validation';

export function getAllGroups() {
  return getDb().prepare('SELECT * FROM proxy_groups ORDER BY sort_order').all();
}

export function getGroupById(id: string) {
  return getDb().prepare('SELECT * FROM proxy_groups WHERE id = ?').get(id);
}

export function createGroup(data: {
  name: string;
  type: string;
  proxies: string[];
  providers?: string[];
  url?: string;
  interval?: number;
  tolerance?: number;
  filter?: string;
  use_all_proxies?: boolean;
  strategy?: string;
}) {
  const name = assertNonEmptyName(data.name, 'Group name');
  assertValidGroupType(data.type);
  const proxies = data.proxies ?? [];
  const providers = data.providers ?? [];
  assertGroupMembersExist(null, proxies, providers);

  if (!data.use_all_proxies && proxies.length === 0 && providers.length === 0) {
    throw new HttpError(400, 'Policy group must include at least one proxy, provider, or all proxies');
  }

  const existing = getDb().prepare('SELECT 1 FROM proxy_groups WHERE name = ?').get(name);
  if (existing) {
    throw new HttpError(409, `Policy group already exists: ${name}`);
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO proxy_groups (id, name, type, proxies, providers, url, interval, tolerance, filter, use_all_proxies, strategy, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM proxy_groups), ?, ?)`
    )
    .run(
      id,
      name,
      data.type,
      JSON.stringify(proxies),
      JSON.stringify(providers),
      data.url ?? null,
      data.interval ?? 300,
      data.tolerance ?? 150,
      data.filter ?? null,
      data.use_all_proxies ? 1 : 0,
      data.strategy ?? null,
      now,
      now
    );
  return { id };
}

export function updateGroup(
  id: string,
  data: Partial<{
    name: string;
    type: string;
    proxies: string[];
    providers: string[];
    url: string;
    interval: number;
    tolerance: number;
    filter: string;
    use_all_proxies: boolean;
    strategy: string;
  }>
) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM proxy_groups WHERE id = ?').get(id) as
    | { id: string; name: string; type: string; proxies: string; providers: string; use_all_proxies: number }
    | undefined;
  if (!existing) {
    throw new HttpError(404, 'Group not found');
  }

  const nextName = data.name !== undefined ? assertNonEmptyName(data.name, 'Group name') : existing.name;
  const nextType = data.type ?? existing.type;
  assertValidGroupType(nextType);

  if (nextName !== existing.name) {
    const duplicate = db.prepare('SELECT 1 FROM proxy_groups WHERE name = ? AND id != ?').get(nextName, id);
    if (duplicate) throw new HttpError(409, `Policy group already exists: ${nextName}`);
  }

  const nextProxies = data.proxies !== undefined ? data.proxies : parseNameList(existing.proxies);
  const nextProviders = data.providers !== undefined ? data.providers : parseNameList(existing.providers);
  const nextUseAll = data.use_all_proxies !== undefined ? data.use_all_proxies : Boolean(existing.use_all_proxies);
  assertGroupMembersExist(id, nextProxies, nextProviders);
  if (!nextUseAll && nextProxies.length === 0 && nextProviders.length === 0) {
    throw new HttpError(400, 'Policy group must include at least one proxy, provider, or all proxies');
  }

  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now];
  if (data.name !== undefined) { sets.push('name = ?'); vals.push(nextName); }
  if (data.type !== undefined) { sets.push('type = ?'); vals.push(data.type); }
  if (data.proxies !== undefined) { sets.push('proxies = ?'); vals.push(JSON.stringify(data.proxies)); }
  if (data.providers !== undefined) { sets.push('providers = ?'); vals.push(JSON.stringify(data.providers)); }
  if (data.url !== undefined) { sets.push('url = ?'); vals.push(data.url); }
  if (data.interval !== undefined) { sets.push('interval = ?'); vals.push(data.interval); }
  if (data.tolerance !== undefined) { sets.push('tolerance = ?'); vals.push(data.tolerance); }
  if (data.filter !== undefined) { sets.push('filter = ?'); vals.push(data.filter); }
  if (data.use_all_proxies !== undefined) { sets.push('use_all_proxies = ?'); vals.push(data.use_all_proxies ? 1 : 0); }
  if (data.strategy !== undefined) { sets.push('strategy = ?'); vals.push(data.strategy); }
  vals.push(id);

  const update = db.transaction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.prepare(`UPDATE proxy_groups SET ${sets.join(', ')} WHERE id = ?`).run(...(vals as any[]));

    if (nextName !== existing.name) {
      renameGroupReferences(existing.name, nextName, id);
    }
  });
  update();
}

export function deleteGroup(id: string) {
  if (id === 'default-proxy-group') {
    throw new HttpError(400, 'Default policy group cannot be deleted');
  }

  const db = getDb();
  const existing = db.prepare('SELECT name FROM proxy_groups WHERE id = ?').get(id) as { name: string } | undefined;
  if (!existing) throw new HttpError(404, 'Group not found');

  const refs = findGroupReferences(existing.name, id);
  if (refs.length > 0) {
    throw new HttpError(409, `Policy group is still referenced by: ${refs.join(', ')}`);
  }

  db.prepare('DELETE FROM proxy_groups WHERE id = ?').run(id);
}

function findGroupReferences(groupName: string, groupId: string): string[] {
  const db = getDb();
  const refs: string[] = [];

  const ruleCount = (db.prepare('SELECT COUNT(*) as count FROM rules WHERE policy = ?').get(groupName) as { count: number }).count;
  if (ruleCount > 0) refs.push(`${ruleCount} rule(s)`);

  const ruleProviderCount = (db.prepare('SELECT COUNT(*) as count FROM rule_providers WHERE policy = ?').get(groupName) as { count: number }).count;
  if (ruleProviderCount > 0) refs.push(`${ruleProviderCount} rule set(s)`);

  const groups = db.prepare('SELECT id, name, proxies FROM proxy_groups WHERE id != ?').all(groupId) as Array<{ id: string; name: string; proxies: string }>;
  const groupRefs = groups.filter((group) => parseNameList(group.proxies).includes(groupName));
  if (groupRefs.length > 0) refs.push(`${groupRefs.length} policy group(s)`);

  return refs;
}

function renameGroupReferences(oldName: string, nextName: string, groupId: string) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare('UPDATE rules SET policy = ?, updated_at = ? WHERE policy = ?').run(nextName, now, oldName);
  db.prepare('UPDATE rule_providers SET policy = ?, updated_at = ? WHERE policy = ?').run(nextName, now, oldName);

  const groups = db.prepare('SELECT id, proxies FROM proxy_groups WHERE id != ?').all(groupId) as Array<{ id: string; proxies: string }>;
  const updateGroupProxies = db.prepare('UPDATE proxy_groups SET proxies = ?, updated_at = ? WHERE id = ?');
  for (const group of groups) {
    const names = parseNameList(group.proxies);
    if (!names.includes(oldName)) continue;
    updateGroupProxies.run(JSON.stringify(names.map((name) => (name === oldName ? nextName : name))), now, group.id);
  }
}
