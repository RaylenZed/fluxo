import type { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../database/db';
import { randomUUID } from 'crypto';
import { HttpError, assertNonEmptyName, getHttpStatus } from '../policy/policy.validation';
import axios from 'axios';
import { parseSubscriptionContent } from '../profile/subscription-import.service';

export const providerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/providers', async () => {
    return getDb().prepare('SELECT * FROM providers ORDER BY name').all();
  });

  fastify.post('/providers/preview', async (req, reply) => {
    try {
      const body = req.body as { url?: string };
      const url = assertNonEmptyName(body.url, 'Provider URL');
      if (!/^https?:\/\//i.test(url)) {
        throw new HttpError(400, 'Provider URL must start with http:// or https://');
      }

      const response = await axios.get<string>(url, {
        responseType: 'text',
        timeout: 20_000,
        maxContentLength: 8 * 1024 * 1024,
        transformResponse: (data) => data,
        headers: {
          'User-Agent': 'Fluxo/3.0.3',
          Accept: 'text/plain, application/x-yaml, application/yaml, */*',
        },
      });
      const content = typeof response.data === 'string' ? response.data : String(response.data ?? '');
      const result = parseSubscriptionContent(content);

      return {
        count: result.proxies.length,
        skipped: result.skipped,
        names: result.proxies.slice(0, 50).map((proxy) => proxy.name),
      };
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.post('/providers', async (req, reply) => {
    try {
      const body = req.body as {
        name: string;
        url: string;
        interval?: number;
        filter?: string;
        healthCheckUrl?: string;
      };
      const name = assertNonEmptyName(body.name, 'Provider name');
      const url = assertNonEmptyName(body.url, 'Provider URL');
      const db = getDb();
      const duplicate = db.prepare('SELECT 1 FROM providers WHERE name = ?').get(name);
      if (duplicate) throw new HttpError(409, `Provider already exists: ${name}`);

      const now = new Date().toISOString();
      const id = randomUUID();
      db.prepare(
          `INSERT INTO providers (id, name, url, interval, filter, health_check_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(id, name, url, body.interval ?? 86400, body.filter ?? null, body.healthCheckUrl ?? null, now, now);
      reply.code(201).send({ id });
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.put('/providers/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as Partial<{ name: string; url: string; interval: number; filter: string; healthCheckUrl: string }>;
      const db = getDb();
      const existing = db.prepare('SELECT name FROM providers WHERE id = ?').get(id) as { name: string } | undefined;
      if (!existing) throw new HttpError(404, 'Provider not found');

      const now = new Date().toISOString();
      const sets: string[] = ['updated_at = ?'];
      const vals: unknown[] = [now];
      if (body.name !== undefined) {
        const name = assertNonEmptyName(body.name, 'Provider name');
        const duplicate = db.prepare('SELECT 1 FROM providers WHERE name = ? AND id != ?').get(name, id);
        if (duplicate) throw new HttpError(409, `Provider already exists: ${name}`);
        sets.push('name = ?'); vals.push(name);
      }
      if (body.url !== undefined) { sets.push('url = ?'); vals.push(assertNonEmptyName(body.url, 'Provider URL')); }
      if (body.interval !== undefined) { sets.push('interval = ?'); vals.push(body.interval); }
      if (body.filter !== undefined) { sets.push('filter = ?'); vals.push(body.filter); }
      if (body.healthCheckUrl !== undefined) { sets.push('health_check_url = ?'); vals.push(body.healthCheckUrl || null); }
      vals.push(id);
      const update = db.transaction(() => {
        db.prepare(`UPDATE providers SET ${sets.join(', ')} WHERE id = ?`).run(...(vals as [unknown, ...unknown[]]));
        if (body.name !== undefined && body.name !== existing.name) {
          const nowName = assertNonEmptyName(body.name, 'Provider name');
          const groups = db.prepare('SELECT id, providers FROM proxy_groups').all() as Array<{ id: string; providers: string }>;
          const updateGroup = db.prepare('UPDATE proxy_groups SET providers = ?, updated_at = ? WHERE id = ?');
          for (const group of groups) {
            const providers = JSON.parse(group.providers || '[]') as unknown;
            if (!Array.isArray(providers) || !providers.includes(existing.name)) continue;
            updateGroup.run(JSON.stringify(providers.map((provider) => provider === existing.name ? nowName : provider)), now, group.id);
          }
        }
      });
      update();
      return { ok: true };
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.delete('/providers/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const db = getDb();
      const existing = db.prepare('SELECT name FROM providers WHERE id = ?').get(id) as { name: string } | undefined;
      if (!existing) throw new HttpError(404, 'Provider not found');
      const groupRefs = (db.prepare('SELECT providers FROM proxy_groups').all() as Array<{ providers: string }>)
        .filter((group) => {
          try {
            const providers = JSON.parse(group.providers || '[]');
            return Array.isArray(providers) && providers.includes(existing.name);
          } catch {
            return false;
          }
        }).length;
      if (groupRefs > 0) throw new HttpError(409, `Provider is still referenced by ${groupRefs} policy group(s)`);

      db.prepare('DELETE FROM providers WHERE id = ?').run(id);
      return { ok: true };
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });
};
