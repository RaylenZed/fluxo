import type { FastifyPluginAsync } from 'fastify';
import { execSync } from 'child_process';
import net from 'net';
import axios from 'axios';
import { getDb } from '../../database/db';
import { writeConfigAndReload } from '../config/config.generator';
import { getMihomoConfig, getMihomoHeaders } from './mihomo.config';
import {
  getMihomoStatus,
  getMihomoVersion,
  getMihomoConnections,
  closeConnection,
  closeAllConnections,
  getTrafficStats,
  reloadConfig,
} from './mihomo.service';

function getConfigPath(): string {
  return process.env.CONFIG_PATH || '/etc/mihomo/config.yaml';
}

function getAxiosErrorDetails(
  err: unknown,
  fallbackMessage: string,
): { statusCode: number; error: string; errorType: string } {
  let statusCode = 503;
  let error = fallbackMessage;
  let errorType = 'error';

  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    statusCode = err.response?.status ?? 503;
    error = data?.message || data?.error || err.message || fallbackMessage;

    if (statusCode === 404) {
      errorType = 'not_loaded';
      error = 'Proxy node is not loaded in Mihomo. Apply config first.';
      statusCode = 409;
    } else if (err.code === 'ECONNABORTED') {
      errorType = 'timeout';
      statusCode = 504;
    } else if (statusCode >= 500) {
      errorType = 'unreachable';
    }
  } else if (err instanceof Error) {
    error = err.message || fallbackMessage;
  }

  return { statusCode, error, errorType };
}

function parseMemoryPayload(rawLine: string): { inuse?: number; oslimit?: number } | null {
  const normalized = rawLine.startsWith('data:') ? rawLine.slice(5).trim() : rawLine.trim();
  if (!normalized) return null;

  try {
    const parsed = JSON.parse(normalized);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as { inuse?: number; oslimit?: number }
      : null;
  } catch {
    return null;
  }
}

function readMihomoUptimeSeconds(): number | null {
  const activeUsecRaw = execSync(
    "systemctl show mihomo --property=ActiveEnterTimestampMonotonic --value 2>/dev/null",
    { timeout: 2000 },
  ).toString().trim();
  const activeUsec = Number(activeUsecRaw);

  if (Number.isFinite(activeUsec) && activeUsec > 0) {
    const bootUptimeRaw = execSync("awk '{print $1}' /proc/uptime", { timeout: 2000 }).toString().trim();
    const bootUptimeSeconds = Number(bootUptimeRaw);
    if (Number.isFinite(bootUptimeSeconds) && bootUptimeSeconds > 0) {
      const uptime = Math.floor(bootUptimeSeconds - activeUsec / 1_000_000);
      return uptime >= 0 ? uptime : null;
    }
  }

  const timestamp = execSync(
    "systemctl show mihomo --property=ActiveEnterTimestamp --value 2>/dev/null",
    { timeout: 2000 },
  ).toString().trim();
  if (!timestamp || timestamp === 'n/a') return null;

  // systemd appends localized timezone abbreviations such as CST, which JS may
  // parse as a different region. Treat the timestamp as local wall time instead.
  const localTimestamp = timestamp.replace(/\s+[A-Z]{2,5}$/, '');
  const since = new Date(localTimestamp).getTime();
  if (!Number.isFinite(since)) return null;

  const uptime = Math.floor((Date.now() - since) / 1000);
  return uptime >= 0 ? uptime : null;
}

function readSettingBoolean(key: string, fallback = false): boolean {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) return fallback;

  try {
    const parsed = JSON.parse(row.value);
    return parsed === true || parsed === 'true';
  } catch {
    return fallback;
  }
}

function readCommandOutput(command: string): string | null {
  try {
    return execSync(command, { timeout: 2000, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function readTunRuntimeStatus() {
  const desired = readSettingBoolean('tun.enable', false);
  const metaLink = readCommandOutput('ip link show Meta 2>/dev/null');
  const routeToInternet = readCommandOutput('ip route get 8.8.8.8 2>/dev/null');
  const resolvConf = readCommandOutput("awk '/^nameserver /{print $2}' /etc/resolv.conf 2>/dev/null");
  const active = Boolean(metaLink);
  const routeUsesTun = routeToInternet ? /\bdev\s+Meta\b/.test(routeToInternet) : null;
  const dnsNameservers = resolvConf ? resolvConf.split('\n').map((line) => line.trim()).filter(Boolean) : [];

  return {
    desired,
    active,
    interface: active ? 'Meta' : null,
    routeToInternet,
    routeUsesTun,
    dnsNameservers,
    status: desired ? (active ? 'active' : 'mismatch') : 'disabled',
  };
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

  fastify.get('/mihomo/tun/status', async (_req, reply) => {
    try {
      return readTunRuntimeStatus();
    } catch (err) {
      fastify.log.debug({ err }, 'Failed to read TUN runtime status');
      return {
        desired: readSettingBoolean('tun.enable', false),
        active: false,
        interface: null,
        routeToInternet: null,
        routeUsesTun: null,
        dnsNameservers: [],
        status: 'unknown',
      };
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

  fastify.get('/mihomo/traffic', async (_req, reply) => {
    try {
      return await getTrafficStats();
    } catch (err) {
      fastify.log.error(err);
      reply.code(503).send({ up: 0, down: 0, connected: false });
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
      const headers = getMihomoHeaders(secret);
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
      const headers = getMihomoHeaders(secret);
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
      const res = await axios.get(`${apiUrl}/memory`, {
        headers: getMihomoHeaders(secret),
        responseType: 'stream',
        timeout: 4000,
        signal: controller.signal,
      });

      return new Promise<void>((resolve) => {
        let buf = '';
        let latest: { inuse?: number; oslimit?: number } | null = null;
        let settled = false;

        const hardTimeout = setTimeout(() => finish(latest), 3000);

        function cleanup() {
          clearTimeout(hardTimeout);
          controller.abort();
        }

        function finish(payload: { inuse?: number; oslimit?: number } | null) {
          if (settled) return;
          settled = true;
          cleanup();

          if (payload) {
            reply.send({ ...payload, connected: true });
          } else {
            reply.send({ inuse: null, connected: false });
          }

          resolve();
        }

        function handlePayload(payload: { inuse?: number; oslimit?: number }) {
          latest = payload;

          if (typeof payload.inuse === 'number' && payload.inuse > 0) {
            finish(payload);
          }
        }

        function flushLines() {
          const lines = buf.split(/\r?\n/);
          buf = lines.pop() ?? '';

          for (const line of lines) {
            const payload = parseMemoryPayload(line);
            if (payload) handlePayload(payload);
            if (settled) return;
          }
        }

        res.data.on('data', (chunk: Buffer) => {
          buf += chunk.toString();
          flushLines();
        });

        res.data.on('error', () => finish(latest));
        res.data.on('end', () => {
          const payload = parseMemoryPayload(buf);
          if (payload) latest = payload;
          finish(latest);
        });
      });
    } catch (err) {
      fastify.log.debug({ err }, 'Failed to stream memory from Mihomo');
      reply.send({ inuse: null, connected: false });
    }
  });

  // GET /api/mihomo/uptime — get mihomo service uptime via systemd
  fastify.get('/mihomo/uptime', async (_req, reply) => {
    try {
      return { uptime: readMihomoUptimeSeconds() };
    } catch (err) {
      fastify.log.debug({ err }, 'Failed to read mihomo uptime via systemctl');
      return { uptime: null };
    }
  });

  // POST /api/mihomo/tcpping — TCP connectivity check to a host:port
  fastify.post('/mihomo/tcpping', async (req) => {
    const { server, port, timeout = 5000 } = req.body as { server: string; port: number; timeout?: number };
    try {
      const latencyMs = await new Promise<number>((resolve, reject) => {
        const start = Date.now();
        // Use a real wall-clock timer so DNS resolution time is also bounded
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          socket.destroy();
          reject(Object.assign(new Error('Connection timed out'), { code: 'ETIMEDOUT' }));
        }, timeout);
        const socket = net.createConnection({ host: server, port });
        socket.on('connect', () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          socket.destroy();
          resolve(Date.now() - start);
        });
        socket.on('error', (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          socket.destroy();
          reject(err);
        });
      });
      return { ok: true, latencyMs };
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      const code = e.code ?? 'UNKNOWN';
      let errorType = 'error';
      if (code === 'ENOTFOUND') errorType = 'dns_failed';
      else if (code === 'ECONNREFUSED') errorType = 'refused';
      else if (code === 'ECONNRESET') errorType = 'reset';
      else if (code === 'ETIMEDOUT') errorType = 'timeout';
      return { ok: false, error: e.message, errorType };
    }
  });

  // POST /api/mihomo/test — test a proxy node latency
  fastify.post('/mihomo/test', async (req, reply) => {
    try {
      const body = req.body as { name: string; url?: string; timeout?: number; kind?: 'proxy' | 'group' };
      const { apiUrl, secret } = getMihomoConfig();
      const testUrl = body.url ?? 'https://www.google.com/generate_204';
      const timeout = body.timeout ?? 5000;
      const endpointBase = body.kind === 'group' ? 'group' : 'proxies';
      const res = await axios.get(
        `${apiUrl}/${endpointBase}/${encodeURIComponent(body.name)}/delay?url=${encodeURIComponent(testUrl)}&timeout=${timeout}`,
        { headers: getMihomoHeaders(secret), timeout: timeout + 1000 }
      );
      return res.data; // { delay: number }
    } catch (err) {
      fastify.log.error({ err }, 'Proxy delay test failed');
      const details = getAxiosErrorDetails(err, 'Latency test failed');
      reply.code(details.statusCode).send({ error: details.error, errorType: details.errorType });
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
        { headers: getMihomoHeaders(secret), timeout: 5000 }
      );
      return { ok: true };
    } catch (err) {
      fastify.log.error({ err }, 'Failed to switch proxy in group');
      const details = getAxiosErrorDetails(err, 'Failed to switch proxy in group');
      reply.code(details.statusCode).send(details);
    }
  });

  // PUT /api/mihomo/mode — switch outbound mode
  fastify.put('/mihomo/mode', async (req, reply) => {
    try {
      const body = req.body as { mode: 'rule' | 'global' | 'direct' };
      const { apiUrl, secret } = getMihomoConfig();
      await axios.patch(`${apiUrl}/configs`, { mode: body.mode }, { headers: getMihomoHeaders(secret), timeout: 5000 });
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

  async function updateProviderByName(name: string) {
    const { apiUrl, secret } = getMihomoConfig();
    await axios.put(
      `${apiUrl}/providers/proxies/${encodeURIComponent(name)}`,
      {},
      { headers: getMihomoHeaders(secret), timeout: 10000 }
    );
  }

  // POST|PUT /api/mihomo/providers/:name/update — trigger one provider update in Mihomo
  async function updateProvider(req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) {
    try {
      const { name } = req.params as { name: string };
      await updateProviderByName(name);
      return { ok: true };
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update provider');
      reply.code(503).send({ error: 'Mihomo not reachable or provider not found' });
    }
  }
  fastify.post('/mihomo/providers/:name/update', updateProvider);
  fastify.put('/mihomo/providers/:name/update', updateProvider);

  // POST|PUT /api/mihomo/providers/update — update all configured providers.
  async function updateAllProviders(_req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) {
    try {
      const providers = getDb().prepare('SELECT name FROM providers ORDER BY name').all() as Array<{ name: string }>;
      const results = await Promise.allSettled(providers.map((provider) => updateProviderByName(provider.name)));
      const failed = results.filter((result) => result.status === 'rejected').length;

      if (failed > 0) {
        return reply.code(207).send({ ok: false, updated: providers.length - failed, failed });
      }

      return { ok: true, updated: providers.length, failed: 0 };
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update all providers');
      reply.code(503).send({ error: 'Mihomo not reachable or providers not found' });
    }
  }
  fastify.post('/mihomo/providers/update', updateAllProviders);
  fastify.put('/mihomo/providers/update', updateAllProviders);

  // POST /api/mihomo/geo/update — update GEO databases
  fastify.post('/mihomo/geo/update', async (_req, reply) => {
    try {
      const { apiUrl, secret } = getMihomoConfig();
      await axios.post(`${apiUrl}/configs/geo`, {}, { headers: getMihomoHeaders(secret), timeout: 30000 });
      return { ok: true };
    } catch (err) {
      fastify.log.error({ err }, 'Failed to trigger geo update');
      reply.code(503).send({ error: 'Mihomo not reachable' });
    }
  });
};
