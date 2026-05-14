import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import yaml from 'js-yaml';
import { CREATE_TABLES_SQL } from './schema';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'fluxo.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.exec(CREATE_TABLES_SQL);
    runMigrations(_db);
    seedDefaults(_db);
  }
  return _db;
}

function readConfigScalar(key: string): string {
  const configPath = process.env.CONFIG_PATH || '/etc/mihomo/config.yaml';
  if (!fs.existsSync(configPath)) return '';

  try {
    const parsed = yaml.load(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown> | null;
    if (!parsed || !Object.prototype.hasOwnProperty.call(parsed, key)) return '';
    const value = parsed[key];
    return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  } catch {
    return '';
  }
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function addColumn(db: Database.Database, table: string, column: string, definition: string) {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function applyMigration(db: Database.Database, id: string, migrate: () => void) {
  const existing = db.prepare('SELECT id FROM schema_migrations WHERE id = ?').get(id);
  if (existing) return;

  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    migrate();
    db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(id, now);
  });
  transaction();
}

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  applyMigration(db, '20260427_add_missing_columns', () => {
    addColumn(db, 'proxies', 'sort_order', 'INTEGER DEFAULT 0');

    addColumn(db, 'providers', 'interval', 'INTEGER DEFAULT 86400');
    addColumn(db, 'providers', 'filter', 'TEXT');
    addColumn(db, 'providers', 'health_check_url', 'TEXT');
    addColumn(db, 'providers', 'last_updated', 'TEXT');
    addColumn(db, 'providers', 'created_at', "TEXT DEFAULT ''");
    addColumn(db, 'providers', 'updated_at', "TEXT DEFAULT ''");

    addColumn(db, 'proxy_groups', 'providers', "TEXT DEFAULT '[]'");
    addColumn(db, 'proxy_groups', 'url', 'TEXT');
    addColumn(db, 'proxy_groups', 'interval', 'INTEGER DEFAULT 300');
    addColumn(db, 'proxy_groups', 'tolerance', 'INTEGER DEFAULT 150');
    addColumn(db, 'proxy_groups', 'filter', 'TEXT');
    addColumn(db, 'proxy_groups', 'use_all_proxies', 'INTEGER DEFAULT 0');
    addColumn(db, 'proxy_groups', 'strategy', 'TEXT');
    addColumn(db, 'proxy_groups', 'sort_order', 'INTEGER DEFAULT 0');
    addColumn(db, 'proxy_groups', 'created_at', "TEXT DEFAULT ''");
    addColumn(db, 'proxy_groups', 'updated_at', "TEXT DEFAULT ''");

    addColumn(db, 'rules', 'notify', 'INTEGER DEFAULT 0');
    addColumn(db, 'rules', 'extended_matching', 'INTEGER DEFAULT 0');
    addColumn(db, 'rules', 'sort_order', 'INTEGER DEFAULT 0');
    addColumn(db, 'rules', 'note', "TEXT DEFAULT ''");
    addColumn(db, 'rules', 'created_at', "TEXT DEFAULT ''");
    addColumn(db, 'rules', 'updated_at', "TEXT DEFAULT ''");

    addColumn(db, 'rule_providers', 'policy', "TEXT DEFAULT 'DIRECT'");
    addColumn(db, 'rule_providers', 'created_at', "TEXT DEFAULT ''");
    addColumn(db, 'rule_providers', 'updated_at', "TEXT DEFAULT ''");

    addColumn(db, 'profiles', 'description', "TEXT DEFAULT ''");
    addColumn(db, 'profiles', 'is_active', 'INTEGER DEFAULT 0');
    addColumn(db, 'profiles', 'sort_order', 'INTEGER DEFAULT 0');
    addColumn(db, 'profiles', 'created_at', "TEXT DEFAULT ''");
    addColumn(db, 'profiles', 'updated_at', "TEXT DEFAULT ''");

    addColumn(db, 'dns_config', 'mode', "TEXT DEFAULT 'fake-ip'");
    addColumn(db, 'dns_config', 'use_hosts', 'INTEGER DEFAULT 1');
    addColumn(db, 'dns_config', 'enhanced_mode', 'INTEGER DEFAULT 1');
  });
}

function seedDefaults(db: Database.Database) {
  const now = new Date().toISOString();

  const configSecret = readConfigScalar('secret');
  const configExternalController = readConfigScalar('external-controller');

  const defaults: Record<string, unknown> = {
    'general.mixed_port': 7890,
    'general.allow_lan': true,
    'general.mode': 'rule',
    'general.log_level': 'info',
    'general.ipv6': false,
    'fluxo.apply_mode': (process.env.FLUXO_DEFAULT_APPLY_MODE || process.env.FLUXO_APPLY_MODE) === 'managed' ? 'managed' : 'manual',
    'tun.enable': false,
    'tun.stack': 'system',
    'tun.auto_route': true,
    'tun.dns_hijack': '["any:53"]',
    'mihomo.external_controller': configExternalController || '0.0.0.0:9090',
    // Auto-generate a random Mihomo API secret on first run (INSERT OR IGNORE keeps existing value)
    'mihomo.secret': process.env.MIHOMO_SECRET?.trim() || configSecret || crypto.randomBytes(16).toString('hex'),
    // Auth: JWT signing secret (generated once, never changes)
    'auth.jwt_secret': crypto.randomBytes(32).toString('hex'),
    // Auth: password hash — empty means setup is required
    'auth.password_hash': '',
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

  // Default rules
  const existingRules = db.prepare('SELECT COUNT(*) as count FROM rules').get() as { count: number };
  if (existingRules.count === 0) {
    const ruleStmt = db.prepare(`
      INSERT INTO rules (id, type, value, policy, notify, extended_matching, sort_order, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
    `);
    const defaultRules = [
      { id: 'default-1', type: 'GEOIP',   value: 'CN',              policy: 'DIRECT', order: 0,  note: 'China mainland IPs go direct' },
      { id: 'default-2', type: 'GEOSITE', value: 'cn',              policy: 'DIRECT', order: 1,  note: 'China mainland domains go direct' },
      { id: 'default-3', type: 'GEOSITE', value: 'private',         policy: 'DIRECT', order: 2,  note: 'Private/LAN addresses go direct' },
      { id: 'default-4', type: 'IP-CIDR', value: '192.168.0.0/16',  policy: 'DIRECT', order: 3,  note: 'LAN' },
      { id: 'default-5', type: 'IP-CIDR', value: '10.0.0.0/8',      policy: 'DIRECT', order: 4,  note: 'LAN' },
      { id: 'default-6', type: 'IP-CIDR', value: '172.16.0.0/12',   policy: 'DIRECT', order: 5,  note: 'LAN' },
      { id: 'default-7', type: 'IP-CIDR', value: '127.0.0.0/8',     policy: 'DIRECT', order: 6,  note: 'Loopback' },
      { id: 'default-8', type: 'FINAL',   value: '',                policy: 'DIRECT', order: 99, note: 'Default: direct until you add a proxy group' },
    ];
    for (const r of defaultRules) {
      ruleStmt.run(r.id, r.type, r.value, r.policy, r.order, r.note, now, now);
    }
  }

  // Default proxy group
  const existingGroups = db.prepare('SELECT COUNT(*) as count FROM proxy_groups').get() as { count: number };
  if (existingGroups.count === 0) {
    db.prepare(`
      INSERT INTO proxy_groups
        (id, name, type, proxies, providers, url, interval, tolerance, filter, use_all_proxies, sort_order, created_at, updated_at)
      VALUES ('default-proxy-group', 'Proxy', 'select', '["DIRECT"]', '[]', NULL, 300, 150, NULL, 1, 0, ?, ?)
    `).run(now, now);
  }

  // Older databases seeded the default group with no members, which Mihomo rejects.
  const defaultGroup = db.prepare(`
    SELECT proxies, providers, use_all_proxies
    FROM proxy_groups
    WHERE id = 'default-proxy-group'
  `).get() as { proxies: string; providers: string; use_all_proxies: number } | undefined;

  if (defaultGroup) {
    const parseList = (raw: string) => {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const proxies = parseList(defaultGroup.proxies);
    const providers = parseList(defaultGroup.providers);
    const hasMembers = defaultGroup.use_all_proxies === 1 || proxies.length > 0 || providers.length > 0;

    if (!hasMembers) {
      db.prepare(`
        UPDATE proxy_groups
        SET proxies = ?, use_all_proxies = 1, updated_at = ?
        WHERE id = 'default-proxy-group'
      `).run(JSON.stringify(['DIRECT']), now);
    }
  }
}
