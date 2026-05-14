import { getDb } from '../../database/db';

const PUBLIC_SETTING_KEYS = new Set([
  'general.mixed_port',
  'general.allow_lan',
  'general.mode',
  'general.log_level',
  'general.ipv6',
  'fluxo.apply_mode',
  'tun.enable',
  'tun.stack',
  'tun.auto_route',
  'tun.dns_hijack',
  'mihomo.external_controller',
  'mihomo.secret',
]);

function readSettings(keys?: Set<string>): Record<string, unknown> {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    if (keys && !keys.has(row.key)) continue;
    result[row.key] = JSON.parse(row.value);
  }
  return result;
}

export function getAllSettings(): Record<string, unknown> {
  return readSettings();
}

export function getPublicSettings(): Record<string, unknown> {
  return readSettings(PUBLIC_SETTING_KEYS);
}

export function updateSettings(data: Record<string, unknown>, options: { internal?: boolean } = {}) {
  const now = new Date().toISOString();
  const db = getDb();
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
  const update = db.transaction(() => {
    for (const [key, value] of Object.entries(data)) {
      if (!options.internal && !PUBLIC_SETTING_KEYS.has(key)) {
        throw Object.assign(new Error(`Setting is not writable: ${key}`), { statusCode: 400 });
      }
      stmt.run(key, JSON.stringify(value), now);
    }
  });
  update();
}

export function getSetting(key: string): unknown {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? JSON.parse(row.value) : undefined;
}
