import axios from 'axios';
import { getMihomoConfig, getMihomoHeaders } from './mihomo.config';

const TIMEOUT = 5_000;

export async function getMihomoVersion() {
  const { apiUrl, secret } = getMihomoConfig();
  const res = await axios.get(`${apiUrl}/version`, { headers: getMihomoHeaders(secret), timeout: TIMEOUT });
  return res.data;
}

export async function getMihomoStatus() {
  const { apiUrl, secret } = getMihomoConfig();
  try {
    const version = await axios.get(`${apiUrl}/version`, { headers: getMihomoHeaders(secret), timeout: TIMEOUT });
    return { running: true, version: version.data.version };
  } catch {
    return { running: false, version: null };
  }
}

export async function reloadConfig(configPath: string) {
  const { apiUrl, secret } = getMihomoConfig();
  await axios.put(`${apiUrl}/configs?force=true`, { path: configPath }, { headers: getMihomoHeaders(secret), timeout: TIMEOUT });
}

export async function getMihomoConnections() {
  const { apiUrl, secret } = getMihomoConfig();
  const res = await axios.get(`${apiUrl}/connections`, { headers: getMihomoHeaders(secret), timeout: TIMEOUT });
  return res.data;
}

export async function closeConnection(id: string) {
  const { apiUrl, secret } = getMihomoConfig();
  await axios.delete(`${apiUrl}/connections/${id}`, { headers: getMihomoHeaders(secret), timeout: TIMEOUT });
}

export async function closeAllConnections() {
  const { apiUrl, secret } = getMihomoConfig();
  await axios.delete(`${apiUrl}/connections`, { headers: getMihomoHeaders(secret), timeout: TIMEOUT });
}

export async function getTrafficStats() {
  const { apiUrl, secret } = getMihomoConfig();
  const res = await axios.get(`${apiUrl}/traffic`, { headers: getMihomoHeaders(secret), timeout: TIMEOUT });
  return res.data;
}
