import axios from 'axios';
import { getDb } from '../../database/db';
import { normalizeControllerHost } from './mihomo.config';

const TIMEOUT = 5_000;

function getMihomoConfig(): { apiUrl: string; secret: string } {
  if (process.env.MIHOMO_API_URL) {
    return {
      apiUrl: process.env.MIHOMO_API_URL,
      secret: process.env.MIHOMO_SECRET || '',
    };
  }
  const db = getDb();
  const apiUrlRow = db.prepare("SELECT value FROM settings WHERE key = 'mihomo.external_controller'").get() as
    | { value: string }
    | undefined;
  const secretRow = db.prepare("SELECT value FROM settings WHERE key = 'mihomo.secret'").get() as
    | { value: string }
    | undefined;
  const host = normalizeControllerHost(apiUrlRow ? JSON.parse(apiUrlRow.value) : '127.0.0.1:9090');
  const secret = secretRow ? JSON.parse(secretRow.value) : '';
  return { apiUrl: `http://${host}`, secret };
}

function getHeaders(secret: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) h['Authorization'] = `Bearer ${secret}`;
  return h;
}

export async function getMihomoVersion() {
  const { apiUrl, secret } = getMihomoConfig();
  const res = await axios.get(`${apiUrl}/version`, { headers: getHeaders(secret), timeout: TIMEOUT });
  return res.data;
}

export async function getMihomoStatus() {
  const { apiUrl, secret } = getMihomoConfig();
  try {
    const version = await axios.get(`${apiUrl}/version`, { headers: getHeaders(secret), timeout: TIMEOUT });
    return { running: true, version: version.data.version };
  } catch {
    return { running: false, version: null };
  }
}

export async function reloadConfig(configPath: string) {
  const { apiUrl, secret } = getMihomoConfig();
  await axios.put(`${apiUrl}/configs`, { path: configPath }, { headers: getHeaders(secret), timeout: TIMEOUT });
}

export async function getMihomoConnections() {
  const { apiUrl, secret } = getMihomoConfig();
  const res = await axios.get(`${apiUrl}/connections`, { headers: getHeaders(secret), timeout: TIMEOUT });
  return res.data;
}

export async function closeConnection(id: string) {
  const { apiUrl, secret } = getMihomoConfig();
  await axios.delete(`${apiUrl}/connections/${id}`, { headers: getHeaders(secret), timeout: TIMEOUT });
}

export async function closeAllConnections() {
  const { apiUrl, secret } = getMihomoConfig();
  await axios.delete(`${apiUrl}/connections`, { headers: getHeaders(secret), timeout: TIMEOUT });
}

export async function getTrafficStats() {
  const { apiUrl, secret } = getMihomoConfig();
  const res = await axios.get(`${apiUrl}/traffic`, { headers: getHeaders(secret), timeout: TIMEOUT });
  return res.data;
}
