import type { FastifyPluginAsync } from 'fastify';
import { execSync } from 'child_process';
import net from 'net';
import axios from 'axios';
import { getDb } from '../../database/db';
import { writeConfigAndReload } from '../config/config.generator';
import { getSetting } from '../settings/settings.service';
import {
  getMihomoStatus,
  getMihomoVersion,
  getMihomoConnections,
  closeConnection,
  closeAllConnections,
  reloadConfig,
} from './mihomo.service';

function getConfigPath(): string {
  return process.env.CONFIG_PATH || '/etc/mihomo/config.yaml';
}

function getMihomoConfig(): { apiUrl: string; secret: string } {
  // Env vars take precedence (Docker / systemd overrides)
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
  const host = apiUrlRow ? JSON.parse(apiUrlRow.value) : '127.0.0.1:9090';
  const secret = secretRow ? JSON.parse(secretRow.value) : '';
  return { apiUrl: `http://${host}`, secret };
}

function getHeaders(secret: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) h['Authorization'] = `Bearer ${secret}`;
  return h;
}

export const mihomoRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/mihomo/status', async (_req, reply) => {
    try {
      return await getMihomoStatus();
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/mihomo/version', async (_req, reply) => {
    try {
      return await getMihomoVersion();
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Failed to get version' });
    }
  });

  fastify.get('/mihomo/connections', async (_req, reply) => {
    try {
      return await getMihomoConnections();
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Failed to get connections' });
    }
  });

  fastify.delete('/mihomo/connections', async (_req, reply) => {
    try {
      await closeAllConnections();
      reply.code(200).send({ ok: true });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Failed to close connections' });
    }
  });

  fastify.delete('/mihomo/connections/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await closeConnection(id);
      reply.code(200).send({ ok: true });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Failed to close connection' });
    }
  });

  fastify.post('/mihomo/reload', async (req, reply) => {
    try {
      const body = (req.body as { configPath?: string }) ?? {};
      const configPath = body.configPath || getConfigPath();
      await reloadConfig(configPath);
      reply.code(200).send({ ok: true });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Failed to reload config' });
    }
  });

  fastify.get('/mihomo/test-ip', async (_req, reply) => {
    try {
      const { apiUrl, secret } = getMihomoConfig();
      const headers = getHeaders(secret);
      const res = await axios.get(`${apiUrl}/proxies`, { headers });
      return { ok: true, data: res.data };
    } catch (err) {
      fastify.log.error(err);
      reply.code(503).send({ error: 'Mihomo not reachable' });
    }
  });

  // GET /api/mihomo/proxies — get all proxies from Mihomo (for latency testing)
  fastify.get('/mihomo/proxies', async (_req, reply) => {
    try {
      const { apiUrl, secret } = getMihomoConfig();
      const headers = getHeaders(secret);
      const res = await axios.get(`${apiUrl}/proxies`, { headers, timeout: 5000 });
      return res.data;
    } catch (err) {
      fastify.log.error({ err }, 'Failed to fetch proxies from Mihomo');
      reply.code(503).send({ error: 'Mihomo not reachable' });
    }
  });

  // GET /api/mihomo/memory — Mihomo /memory is SSE; we read first chunk only
  fastify.get('/mihomo/memory', async (_req, reply) => {
    try {
      const { apiUrl, secret } = getMihomoConfig();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await axios.get(`${apiUrl}/memory`, {
        headers: getHeaders(secret),
        responseType: 'stream',
        timeout: 4000,
        signal: controller.signal,
      });
      return new Promise<void>((resolve) => {
        let buf = '';
        res.data.on('data', (chunk: Buffer) => {
          buf += chunk.toString();
          // SSE lines look like: data: {"inuse":12345}
          const match = buf.match(/data:\s*(\{.*?\})/);
          if (match) {
            clearTimeout(timer);
            controller.abort();
            try { reply.send(JSON.parse(match[1])); } catch (err) { fastify.log.warn({ err }, 'Failed to parse memory payload'); reply.send({ inuse: 0 }); }
            resolve();
          }
        });
        res.data.on('error', () => { clearTimeout(timer); reply.code(503).send({ error: 'stream error' }); resolve(); });
        res.data.on('end', () => { clearTimeout(timer); if (!reply.sent) reply.send({ inuse: 0 }); resolve(); });
      });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to stream memory from Mihomo');
      reply.code(503).send({ error: 'Mihomo not reachable' });
    }
  });

  // GET /api/mihomo/uptime — get mihomo service uptime via systemd
  fastify.get('/mihomo/uptime', async (_req, reply) => {
    try {
      const out = execSync("systemctl show mihomo --property=ActiveEnterTimestamp --value 2>/dev/null", { timeout: 2000 }).toString().trim();
      if (!out || out === 'n/a') return { uptime: null };
      const since = new Date(out).getTime();
      const seconds = Math.floor((Date.now() - since) / 1000);
      return { uptime: seconds };
    } catch (err) {
      fastify.log.warn({ err }, 'Failed to read mihomo uptime via systemctl');
      return { uptime: null };
    }
  });

  // POST /api/mihomo/tcpping — TCP connectivity check to a host:port
  fastify.post('/mihomo/tcpping', async (req) => {
    const { server, port, timeout = 5000 } = req.body as { server: string; port: number; timeout?: number };
    try {
      const latencyMs = await new Promise<number>((resolve, reject) => {
        const start = Date.now();
        const socket = net.createConnection({ host: server, port });
        socket.setTimeout(timeout);
        socket.on('connect', () => { socket.destroy(); resolve(Date.now() - start); });
        socket.on('timeout', () => { socket.destroy(); reject(new Error('Connection timed out')); });
        socket.on('error', (err) => { socket.destroy(); reject(err); });
      });
      return { ok: true, latencyMs };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // POST /api/mihomo/test — test a proxy node latency
  fastify.post('/mihomo/test', async (req, reply) => {
    try {
      const body = req.body as { name: string; url?: string; timeout?: number };
      const { apiUrl, secret } = getMihomoConfig();
      const testUrl = body.url ?? 'https://www.google.com/generate_204';
      const timeout = body.timeout ?? 5000;
      const res = await axios.get(
        `${apiUrl}/proxies/${encodeURIComponent(body.name)}/delay?url=${encodeURIComponent(testUrl)}&timeout=${timeout}`,
        { headers: getHeaders(secret), timeout: timeout + 1000 }
      );
      return res.data; // { delay: number }
    } catch (err) {
      fastify.log.error({ err }, 'Proxy delay test failed');
      reply.code(503).send({ error: 'Test failed' });
    }
  });

  // PUT /api/mihomo/proxies/:name — switch selected proxy in a group
  fastify.put('/mihomo/proxies/:name', async (req, reply) => {
    try {
      const { name } = req.params as { name: string };
      const body = req.body as { name: string };
      const { apiUrl, secret } = getMihomoConfig();
      await axios.put(
        `${apiUrl}/proxies/${encodeURIComponent(name)}`,
        { name: body.name },
        { headers: getHeaders(secret), timeout: 5000 }
      );
      return { ok: true };
    } catch (err) {
      fastify.log.error({ err }, 'Failed to switch proxy in group');
      reply.code(503).send({ error: 'Mihomo not reachable' });
    }
  });

  // PUT /api/mihomo/mode — switch outbound mode
  fastify.put('/mihomo/mode', async (req, reply) => {
    try {
      const body = req.body as { mode: 'rule' | 'global' | 'direct' };
      const { apiUrl, secret } = getMihomoConfig();
      await axios.patch(`${apiUrl}/configs`, { mode: body.mode }, { headers: getHeaders(secret), timeout: 5000 });
      return { ok: true };
    } catch (err) {
      fastify.log.error({ err }, 'Failed to set mihomo mode');
      reply.code(503).send({ error: 'Mihomo not reachable' });
    }
  });

  // PUT /api/mihomo/tun — toggle TUN mode and apply config
  fastify.put('/mihomo/tun', async (req, reply) => {
    try {
      const body = req.body as { enable: boolean };
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('tun.enable', ?, ?)").run(JSON.stringify(body.enable), now);
      // Apply config immediately so the running Mihomo reflects the change
      const { apiUrl, secret } = getMihomoConfig();
      await writeConfigAndReload(getConfigPath(), apiUrl, secret || undefined).catch(() => { /* ignore if mihomo unreachable */ });
      return { ok: true };
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST|PUT /api/mihomo/providers/:name/update — trigger provider update in Mihomo
  // (frontend uses PUT; both methods registered for compatibility)
  async function updateProvider(req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) {
    try {
      const { name } = req.params as { name: string };
      const { apiUrl, secret } = getMihomoConfig();
      await axios.put(
        `${apiUrl}/providers/proxies/${encodeURIComponent(name)}`,
        {},
        { headers: getHeaders(secret), timeout: 10000 }
      );
      return { ok: true };
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update provider');
      reply.code(503).send({ error: 'Mihomo not reachable or provider not found' });
    }
  }
  fastify.post('/mihomo/providers/:name/update', updateProvider);
  fastify.put('/mihomo/providers/:name/update', updateProvider);

  // POST /api/mihomo/geo/update — update GEO databases
  fastify.post('/mihomo/geo/update', async (_req, reply) => {
    try {
      const { apiUrl, secret } = getMihomoConfig();
      await axios.post(`${apiUrl}/configs/geo`, {}, { headers: getHeaders(secret), timeout: 30000 });
      return { ok: true };
    } catch (err) {
      fastify.log.error({ err }, 'Failed to trigger geo update');
      reply.code(503).send({ error: 'Mihomo not reachable' });
    }
  });
};
