import { getDb } from '../../database/db';
import { randomUUID } from 'crypto';
import {
  HttpError,
  assertNonEmptyName,
  assertPolicyExists,
  assertRuleProviderExists,
} from '../policy/policy.validation';

export function getAllRules() {
  return getDb().prepare('SELECT * FROM rules ORDER BY sort_order').all();
}

export function getRuleById(id: string) {
  return getDb().prepare('SELECT * FROM rules WHERE id = ?').get(id);
}

export function createRule(data: {
  type: string;
  value?: string;
  policy: string;
  notify?: boolean;
  extended_matching?: boolean;
  note?: string;
}) {
  const type = assertNonEmptyName(data.type, 'Rule type').toUpperCase();
  const policy = assertNonEmptyName(data.policy, 'Policy');
  const value = normalizeRuleValue(type, data.value);
  assertPolicyExists(policy);
  if (type === 'RULE-SET') assertRuleProviderExists(value);

  const now = new Date().toISOString();
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO rules (id, type, value, policy, notify, extended_matching, sort_order, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM rules), ?, ?, ?)`
    )
    .run(
      id,
      type,
      value || null,
      policy,
      data.notify ? 1 : 0,
      data.extended_matching ? 1 : 0,
      data.note ?? '',
      now,
      now
    );
  return { id };
}

export function updateRule(
  id: string,
  data: Partial<{
    type: string;
    value: string;
    policy: string;
    notify: boolean;
    extended_matching: boolean;
    note: string;
  }>
) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM rules WHERE id = ?').get(id) as
    | { type: string; value: string | null; policy: string }
    | undefined;
  if (!existing) throw new HttpError(404, 'Rule not found');

  const nextType = data.type !== undefined ? assertNonEmptyName(data.type, 'Rule type').toUpperCase() : existing.type;
  const nextValue = data.value !== undefined ? normalizeRuleValue(nextType, data.value) : normalizeRuleValue(nextType, existing.value ?? undefined);
  const nextPolicy = data.policy !== undefined ? assertNonEmptyName(data.policy, 'Policy') : existing.policy;
  assertPolicyExists(nextPolicy);
  if (nextType === 'RULE-SET') assertRuleProviderExists(nextValue);

  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now];
  if (data.type !== undefined) { sets.push('type = ?'); vals.push(nextType); }
  if (data.value !== undefined || data.type !== undefined) { sets.push('value = ?'); vals.push(nextValue || null); }
  if (data.policy !== undefined) { sets.push('policy = ?'); vals.push(nextPolicy); }
  if (data.notify !== undefined) { sets.push('notify = ?'); vals.push(data.notify ? 1 : 0); }
  if (data.extended_matching !== undefined) { sets.push('extended_matching = ?'); vals.push(data.extended_matching ? 1 : 0); }
  if (data.note !== undefined) { sets.push('note = ?'); vals.push(data.note); }
  vals.push(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db.prepare(`UPDATE rules SET ${sets.join(', ')} WHERE id = ?`).run(...(vals as any[]));
}

export function deleteRule(id: string) {
  const result = getDb().prepare('DELETE FROM rules WHERE id = ?').run(id);
  if (result.changes === 0) throw new HttpError(404, 'Rule not found');
}

export function reorderRules(ids: string[]) {
  if (!Array.isArray(ids)) throw new HttpError(400, 'ids must be an array');
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'ids contains duplicates');

  const db = getDb();
  const existingIds = (db.prepare('SELECT id FROM rules ORDER BY sort_order').all() as Array<{ id: string }>).map((row) => row.id);
  const existingSet = new Set(existingIds);
  if (ids.length !== existingIds.length || ids.some((id) => !existingSet.has(id))) {
    throw new HttpError(400, 'reorder must include every rule exactly once');
  }

  const stmt = db.prepare('UPDATE rules SET sort_order = ? WHERE id = ?');
  const update = db.transaction(() => {
    ids.forEach((id, index) => {
      stmt.run(index, id);
    });
  });
  update();
}

function normalizeRuleValue(type: string, value?: string | null): string {
  if (type === 'MATCH' || type === 'FINAL') return '';
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new HttpError(400, `${type} rule requires a value`);
  return normalized;
}
