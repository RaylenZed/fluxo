import fs from 'node:fs';
import yaml from 'js-yaml';
import { getDb } from '../../database/db';

export function normalizeControllerHost(host: string): string {
  const trimmed = host.trim();

  if (trimmed.startsWith('0.0.0.0:')) {
    return `127.0.0.1:${trimmed.slice('0.0.0.0:'.length)}`;
  }

  if (trimmed === '0.0.0.0') {
    return '127.0.0.1';
  }

  if (trimmed === '::' || trimmed === '[::]') {
    return '127.0.0.1';
  }

  return trimmed;
}

function readSettingString(key: string, fallback = ''): string {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) return fallback;

  try {
    const parsed = JSON.parse(row.value);
    return typeof parsed === 'string' ? parsed : String(parsed ?? fallback);
  } catch {
    return fallback;
  }
}

function readConfigFileSecret(): string | null {
  const configPath = process.env.CONFIG_PATH || '/etc/mihomo/config.yaml';
  if (!fs.existsSync(configPath)) return null;

  try {
    const parsed = yaml.load(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown> | null;
    if (!parsed || !Object.prototype.hasOwnProperty.call(parsed, 'secret')) return null;
    const secret = parsed.secret;
    return typeof secret === 'string' ? secret.trim() : String(secret ?? '').trim();
  } catch {
    return null;
  }
}

export function getEffectiveMihomoSecret(): string {
  const envSecret = process.env.MIHOMO_SECRET?.trim();
  const dbSecret = readSettingString('mihomo.secret').trim();
  const configSecret = readConfigFileSecret();
  return envSecret || dbSecret || configSecret || '';
}

export function getMihomoConfig(): { apiUrl: string; secret: string } {
  const envApiUrl = process.env.MIHOMO_API_URL?.trim();
  if (envApiUrl) {
    return {
      apiUrl: envApiUrl,
      secret: getEffectiveMihomoSecret(),
    };
  }

  const host = normalizeControllerHost(readSettingString('mihomo.external_controller', '127.0.0.1:9090'));
  return { apiUrl: `http://${host}`, secret: getEffectiveMihomoSecret() };
}

export function getMihomoHeaders(secret: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers.Authorization = `Bearer ${secret}`;
  return headers;
}
