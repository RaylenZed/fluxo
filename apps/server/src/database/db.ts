import Database from 'better-sqlite3';
import path from 'path';
import { CREATE_TABLES_SQL } from './schema';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'fluxo.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const fs = require('fs');
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    // Execute all CREATE TABLE statements
    _db.exec(CREATE_TABLES_SQL);
    // Seed default settings
    seedDefaults(_db);
  }
  return _db;
}

function seedDefaults(db: Database.Database) {
  const now = new Date().toISOString();

  // Default settings
  const defaults: Record<string, unknown> = {
    'general.mixed_port': 7890,
    'general.allow_lan': true,
    'general.mode': 'rule',
    'general.log_level': 'info',
    'general.ipv6': false,
    'tun.enable': false,
    'tun.stack': 'system',
    'tun.auto_route': true,
    'tun.dns_hijack': '["any:53"]',
    'mihomo.external_controller': '0.0.0.0:9090',
    'mihomo.secret': '',
  };
  const settingsStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
  for (const [key, value] of Object.entries(defaults)) {
    settingsStmt.run(key, JSON.stringify(value), now);
  }

  // Default DNS config
  db.prepare(`
    INSERT OR IGNORE INTO dns_config
      (id, enable, mode, nameservers, fallback_dns, fake_ip_filter, use_hosts, enhanced_mode, updated_at)
    VALUES (1, 1, 'fake-ip',
      '["223.5.5.5","119.29.29.29","114.114.114.114"]',
      '["8.8.8.8","1.1.1.1","tls://dns.google"]',
      '["*.local","+.lan","+.local","time.*.com","ntp.*.com","+.ntp.org"]',
      1, 1, ?)
  `).run(now);

  // Default rules: CN direct, GFW through proxy, final direct
  const existingRules = db.prepare('SELECT COUNT(*) as count FROM rules').get() as { count: number };
  if (existingRules.count === 0) {
    const ruleStmt = db.prepare(`
      INSERT INTO rules (id, type, value, policy, notify, extended_matching, sort_order, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
    `);
    const defaultRules = [
      { id: 'default-1', type: 'GEOIP',          value: 'CN',         policy: 'DIRECT', order: 0,  note: 'China mainland IPs go direct' },
      { id: 'default-2', type: 'GEOSITE',         value: 'cn',         policy: 'DIRECT', order: 1,  note: 'China mainland domains go direct' },
      { id: 'default-3', type: 'GEOSITE',         value: 'private',    policy: 'DIRECT', order: 2,  note: 'Private/LAN addresses go direct' },
      { id: 'default-4', type: 'IP-CIDR',         value: '192.168.0.0/16', policy: 'DIRECT', order: 3,  note: 'LAN' },
      { id: 'default-5', type: 'IP-CIDR',         value: '10.0.0.0/8',     policy: 'DIRECT', order: 4,  note: 'LAN' },
      { id: 'default-6', type: 'IP-CIDR',         value: '172.16.0.0/12',  policy: 'DIRECT', order: 5,  note: 'LAN' },
      { id: 'default-7', type: 'IP-CIDR',         value: '127.0.0.0/8',    policy: 'DIRECT', order: 6,  note: 'Loopback' },
      { id: 'default-8', type: 'FINAL',           value: '',           policy: 'DIRECT', order: 99, note: 'Default: direct until you add a proxy group' },
    ];
    for (const r of defaultRules) {
      ruleStmt.run(r.id, r.type, r.value, r.policy, r.order, r.note, now, now);
    }
  }

  // Default "Proxy" group placeholder (empty, user fills it in)
  const existingGroups = db.prepare('SELECT COUNT(*) as count FROM proxy_groups').get() as { count: number };
  if (existingGroups.count === 0) {
    db.prepare(`
      INSERT INTO proxy_groups
        (id, name, type, proxies, providers, url, interval, tolerance, filter, use_all_proxies, sort_order, created_at, updated_at)
      VALUES ('default-proxy-group', 'Proxy', 'select', '[]', '[]', NULL, 300, 150, NULL, 0, 0, ?, ?)
    `).run(now, now);
  }
}
