import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../../database/db';

const BCRYPT_ROUNDS = 10;
const JWT_EXPIRY = '30d';
const COOKIE_NAME = 'fluxo_session';

function getSetting(key: string): string {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? JSON.parse(row.value) : '';
}

function setSetting(key: string, value: string) {
  const now = new Date().toISOString();
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(key, JSON.stringify(value), now);
}

export function getJwtSecret(): string {
  return getSetting('auth.jwt_secret');
}

export function isSetupRequired(): boolean {
  return !getSetting('auth.password_hash');
}

export function isAuthDisabled(): boolean {
  return process.env.FLUXO_AUTH_DISABLED === '1';
}

export async function setPassword(plaintext: string): Promise<void> {
  const hash = await bcrypt.hash(plaintext, BCRYPT_ROUNDS);
  setSetting('auth.password_hash', hash);
}

export async function verifyPassword(plaintext: string): Promise<boolean> {
  const hash = getSetting('auth.password_hash');
  if (!hash) return false;
  return bcrypt.compare(plaintext, hash);
}

export function signToken(): string {
  return jwt.sign({}, getJwtSecret(), { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): boolean {
  try {
    jwt.verify(token, getJwtSecret());
    return true;
  } catch {
    return false;
  }
}

export { COOKIE_NAME };
