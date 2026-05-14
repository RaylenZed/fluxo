import { getDb } from '../../database/db';
import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import {
  HttpError,
  assertGroupMembersExist,
  assertNonEmptyName,
  assertValidGroupType,
  parseNameList,
} from '../policy/policy.validation';

type ExternalProviderInput = {
  url?: string;
  interval?: number;
} | null;

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
  externalProvider?: ExternalProviderInput;
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
  const baseProviders = data.providers ?? [];
  const externalProvider = normalizeExternalProvider(data.externalProvider);

  const existing = getDb().prepare('SELECT 1 FROM proxy_groups WHERE name = ?').get(name);
  if (existing) {
    throw new HttpError(409, `Policy group already exists: ${name}`);
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  const db = getDb();
  const transaction = db.transaction(() => {
    const providers = [...baseProviders];
    if (externalProvider) {
      providers.push(upsertExternalProvider(db, name, externalProvider, null, now));
    }
    const uniqueProviders = uniqueStrings(providers);

    assertGroupMembersExist(null, proxies, uniqueProviders);
    assertNoGroupCycle(db, id, [name], proxies);
    if (!data.use_all_proxies && proxies.length === 0 && uniqueProviders.length === 0) {
      throw new HttpError(400, 'Policy group must include at least one proxy, provider, or all proxies');
    }

    db.prepare(
        `INSERT INTO proxy_groups (id, name, type, proxies, providers, url, interval, tolerance, filter, use_all_proxies, strategy, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM proxy_groups), ?, ?)`
      )
      .run(
        id,
        name,
        data.type,
        JSON.stringify(proxies),
        JSON.stringify(uniqueProviders),
        data.url ?? null,
        data.interval ?? 300,
        data.tolerance ?? 150,
        data.filter ?? null,
        data.use_all_proxies ? 1 : 0,
        data.strategy ?? null,
        now,
        now
      );
  });
  transaction();
  return { id };
}

export function updateGroup(
  id: string,
  data: Partial<{
    name: string;
    type: string;
    proxies: string[];
    providers: string[];
    externalProvider: ExternalProviderInput;
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
  const existingProviders = parseNameList(existing.providers);
  let nextProviders = data.providers !== undefined ? data.providers : existingProviders;
  const externalProvider = data.externalProvider !== undefined ? normalizeExternalProvider(data.externalProvider) : undefined;
  if (externalProvider === null && data.providers === undefined) {
    nextProviders = [];
  }
  const nextUseAll = data.use_all_proxies !== undefined ? data.use_all_proxies : Boolean(existing.use_all_proxies);

  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now];
  if (data.name !== undefined) { sets.push('name = ?'); vals.push(nextName); }
  if (data.type !== undefined) { sets.push('type = ?'); vals.push(data.type); }
  if (data.proxies !== undefined) { sets.push('proxies = ?'); vals.push(JSON.stringify(data.proxies)); }
  if (data.url !== undefined) { sets.push('url = ?'); vals.push(data.url); }
  if (data.interval !== undefined) { sets.push('interval = ?'); vals.push(data.interval); }
  if (data.tolerance !== undefined) { sets.push('tolerance = ?'); vals.push(data.tolerance); }
  if (data.filter !== undefined) { sets.push('filter = ?'); vals.push(data.filter); }
  if (data.use_all_proxies !== undefined) { sets.push('use_all_proxies = ?'); vals.push(data.use_all_proxies ? 1 : 0); }
  if (data.strategy !== undefined) { sets.push('strategy = ?'); vals.push(data.strategy); }
  vals.push(id);

  const update = db.transaction(() => {
    if (externalProvider) {
      nextProviders = [
        ...nextProviders,
        upsertExternalProvider(db, nextName, externalProvider, nextProviders[0] ?? existingProviders[0] ?? null, now),
      ];
    }
    nextProviders = uniqueStrings(nextProviders);

    assertGroupMembersExist(id, nextProxies, nextProviders);
    assertNoGroupCycle(db, id, uniqueStrings([existing.name, nextName]), nextProxies);
    if (!nextUseAll && nextProxies.length === 0 && nextProviders.length === 0) {
      throw new HttpError(400, 'Policy group must include at least one proxy, provider, or all proxies');
    }

    if (data.providers !== undefined || data.externalProvider !== undefined) {
      sets.push('providers = ?');
      vals.splice(vals.length - 1, 0, JSON.stringify(nextProviders));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.prepare(`UPDATE proxy_groups SET ${sets.join(', ')} WHERE id = ?`).run(...(vals as any[]));

    if (nextName !== existing.name) {
      renameGroupReferences(existing.name, nextName, id);
    }
  });
  update();
}

function normalizeExternalProvider(input: ExternalProviderInput | undefined): { url: string; interval: number } | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;

  const url = assertNonEmptyName(input.url, 'Subscription URL');
  if (!/^https?:\/\//i.test(url)) {
    throw new HttpError(400, 'Subscription URL must start with http:// or https://');
  }

  const interval = Number.isFinite(input.interval) && Number(input.interval) > 0
    ? Math.trunc(Number(input.interval))
    : 86400;

  return { url, interval };
}

function upsertExternalProvider(
  db: Database.Database,
  groupName: string,
  provider: { url: string; interval: number },
  preferredName: string | null,
  now: string
): string {
  const preferred = preferredName ? preferredName.trim() : '';
  if (preferred) {
    const existing = db.prepare('SELECT name FROM providers WHERE name = ?').get(preferred);
    if (existing) {
      db.prepare('UPDATE providers SET url = ?, interval = ?, updated_at = ? WHERE name = ?')
        .run(provider.url, provider.interval, now, preferred);
      return preferred;
    }
  }

  const name = uniqueProviderName(db, `${groupName} Subscription`);
  db.prepare(
      `INSERT INTO providers (id, name, url, interval, filter, health_check_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`
    )
    .run(randomUUID(), name, provider.url, provider.interval, now, now);
  return name;
}

function uniqueProviderName(db: Database.Database, baseName: string): string {
  const base = assertNonEmptyName(baseName, 'Provider name');
  let candidate = base;
  let index = 2;
  while (db.prepare('SELECT 1 FROM providers WHERE name = ?').get(candidate)) {
    candidate = `${base} ${index}`;
    index += 1;
  }
  return candidate;
}

function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index, array) => typeof value === 'string' && value.length > 0 && array.indexOf(value) === index);
}

function assertNoGroupCycle(db: Database.Database, groupId: string, targetNames: string[], memberNames: string[]) {
  const targetNameSet = new Set(targetNames);
  const groups = db.prepare('SELECT id, name, proxies FROM proxy_groups WHERE id != ?').all(groupId) as Array<{
    id: string;
    name: string;
    proxies: string;
  }>;
  const groupMap = new Map(groups.map((group) => [group.name, group]));
  const visited = new Set<string>();

  const visitsTarget = (name: string): boolean => {
    if (targetNameSet.has(name)) return true;
    if (visited.has(name)) return false;
    visited.add(name);

    const group = groupMap.get(name);
    if (!group) return false;

    return parseNameList(group.proxies).some((childName) => visitsTarget(childName));
  };

  const cycleMember = memberNames.find((memberName) => visitsTarget(memberName));
  if (cycleMember) {
    throw new HttpError(400, `Policy group cycle detected through: ${cycleMember}`);
  }
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
