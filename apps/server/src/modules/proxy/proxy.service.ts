import { getDb } from '../../database/db';
import { randomUUID } from 'crypto';

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
  const now = new Date().toISOString();
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO proxies (id, name, type, server, port, config, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM proxies), ?, ?)`
    )
    .run(id, data.name, data.type, data.server, data.port, JSON.stringify(data.config), now, now);
  return { id };
}

export function updateProxy(
  id: string,
  data: Partial<{ name: string; type: string; server: string; port: number; config: Record<string, unknown> }>
) {
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now];
  if (data.name !== undefined) { sets.push('name = ?'); vals.push(data.name); }
  if (data.type !== undefined) { sets.push('type = ?'); vals.push(data.type); }
  if (data.server !== undefined) { sets.push('server = ?'); vals.push(data.server); }
  if (data.port !== undefined) { sets.push('port = ?'); vals.push(data.port); }
  if (data.config !== undefined) { sets.push('config = ?'); vals.push(JSON.stringify(data.config)); }
  vals.push(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDb().prepare(`UPDATE proxies SET ${sets.join(', ')} WHERE id = ?`).run(...(vals as any[]));
}

export function deleteProxy(id: string) {
  getDb().prepare('DELETE FROM proxies WHERE id = ?').run(id);
}
