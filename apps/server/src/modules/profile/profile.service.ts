import { getDb } from '../../database/db';
import { randomUUID } from 'crypto';
import { HttpError, assertNonEmptyName } from '../policy/policy.validation';

export function getAllProfiles() {
  return getDb().prepare('SELECT * FROM profiles ORDER BY sort_order').all();
}

export function getProfileById(id: string) {
  return getDb().prepare('SELECT * FROM profiles WHERE id = ?').get(id);
}

export function createProfile(data: { name: string; description?: string }) {
  const name = assertNonEmptyName(data.name, 'Profile name');
  const duplicate = getDb().prepare('SELECT 1 FROM profiles WHERE name = ?').get(name);
  if (duplicate) throw new HttpError(409, `Profile already exists: ${name}`);

  const now = new Date().toISOString();
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO profiles (id, name, description, is_active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, 0, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM profiles), ?, ?)`
    )
    .run(id, name, data.description ?? '', now, now);
  return { id };
}

export function updateProfile(id: string, data: Partial<{ name: string; description: string; is_active: boolean }>) {
  const exists = getDb().prepare('SELECT 1 FROM profiles WHERE id = ?').get(id);
  if (!exists) throw new HttpError(404, 'Profile not found');

  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now];
  if (data.name !== undefined) {
    const name = assertNonEmptyName(data.name, 'Profile name');
    const duplicate = getDb().prepare('SELECT 1 FROM profiles WHERE name = ? AND id != ?').get(name, id);
    if (duplicate) throw new HttpError(409, `Profile already exists: ${name}`);
    sets.push('name = ?'); vals.push(name);
  }
  if (data.description !== undefined) { sets.push('description = ?'); vals.push(data.description); }
  if (data.is_active !== undefined) { sets.push('is_active = ?'); vals.push(data.is_active ? 1 : 0); }
  vals.push(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDb().prepare(`UPDATE profiles SET ${sets.join(', ')} WHERE id = ?`).run(...(vals as any[]));
}

export function deleteProfile(id: string) {
  const result = getDb().prepare('DELETE FROM profiles WHERE id = ?').run(id);
  if (result.changes === 0) throw new HttpError(404, 'Profile not found');
}

export function activateProfile(id: string) {
  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM profiles WHERE id = ?').get(id);
  if (!exists) throw new HttpError(404, 'Profile not found');

  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare('UPDATE profiles SET is_active = 0, updated_at = ?').run(now);
    db.prepare('UPDATE profiles SET is_active = 1, updated_at = ? WHERE id = ?').run(now, id);
  })();
}
