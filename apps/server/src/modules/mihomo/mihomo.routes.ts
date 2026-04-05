import type { FastifyPluginAsync } from 'fastify';
import path from 'path';
import axios from 'axios';
import { getDb } from '../../database/db';
import {
  getMihomoStatus,
  getMihomoVersion,
  getMihomoConnections,
  closeConnection,
  closeAllConnections,
  reloadConfig,
} from './mihomo.service';

function getMihomoConfig(): { apiUrl: string; secret: string } {
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
      const configPath = body.configPath || process.env.CONFIG_PATH || path.join(process.cwd(), 'data', 'config.yaml');
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

  fastify.post('/config/apply', async (_req, reply) => {
    try {
      const configPath = process.env.CONFIG_PATH || path.join(process.cwd(), 'data', 'config.yaml');
      await reloadConfig(configPath);
      reply.code(200).send({ ok: true });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Failed to apply config' });
    }
  });

  // GET /api/mihomo/proxies — get all proxies from Mihomo (for latency testing)
  fastify.get('/mihomo/proxies', async (_req, reply) => {
    try {
      const { apiUrl, secret } = getMihomoConfig();
      const headers = getHeaders(secret);
      const res = await axios.get(`${apiUrl}/proxies`, { headers, timeout: 5000 });
      return res.data;
    } catch {
      reply.code(503).send({ error: 'Mihomo not reachable' });
    }
  });

  // GET /api/mihomo/memory
  fastify.get('/mihomo/memory', async (_req, reply) => {
    try {
      const { apiUrl, secret } = getMihomoConfig();
      const res = await axios.get(`${apiUrl}/memory`, { headers: getHeaders(secret), timeout: 5000 });
      return res.data;
    } catch {
      reply.code(503).send({ error: 'Mihomo not reachable' });
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
    } catch {
      reply.code(503).send({ error: 'Test failed' });
    }
  });

  // PUT /api/mihomo/mode — switch outbound mode
  fastify.put('/mihomo/mode', async (req, reply) => {
    try {
      const body = req.body as { mode: 'rule' | 'global' | 'direct' };
      const { apiUrl, secret } = getMihomoConfig();
      await axios.patch(`${apiUrl}/configs`, { mode: body.mode }, { headers: getHeaders(secret), timeout: 5000 });
      return { ok: true };
    } catch {
      reply.code(503).send({ error: 'Mihomo not reachable' });
    }
  });

  // PUT /api/mihomo/tun — toggle TUN mode
  fastify.put('/mihomo/tun', async (req, reply) => {
    try {
      const body = req.body as { enable: boolean };
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('tun.enable', ?, ?)").run(JSON.stringify(body.enable), now);
      return { ok: true };
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
