import type { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../database/db';
import { randomUUID } from 'crypto';

export const providerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/providers', async () => {
    return getDb().prepare('SELECT * FROM providers ORDER BY name').all();
  });

  fastify.post('/providers', async (req, reply) => {
    const body = req.body as {
      name: string;
      url: string;
      interval?: number;
      filter?: string;
      healthCheckUrl?: string;
    };
    const now = new Date().toISOString();
    const id = randomUUID();
    getDb()
      .prepare(
        `INSERT INTO providers (id, name, url, interval, filter, health_check_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, body.name, body.url, body.interval ?? 86400, body.filter ?? null, body.healthCheckUrl ?? null, now, now);
    reply.code(201).send({ id });
  });

  fastify.put('/providers/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<{ name: string; url: string; interval: number; filter: string }>;
    const now = new Date().toISOString();
    const sets: string[] = ['updated_at = ?'];
    const vals: unknown[] = [now];
    if (body.name !== undefined) { sets.push('name = ?'); vals.push(body.name); }
    if (body.url !== undefined) { sets.push('url = ?'); vals.push(body.url); }
    if (body.interval !== undefined) { sets.push('interval = ?'); vals.push(body.interval); }
    if (body.filter !== undefined) { sets.push('filter = ?'); vals.push(body.filter); }
    vals.push(id);
    getDb().prepare(`UPDATE providers SET ${sets.join(', ')} WHERE id = ?`).run(...(vals as [unknown, ...unknown[]]));
    return { ok: true };
  });

  fastify.delete('/providers/:id', async (req) => {
    const { id } = req.params as { id: string };
    getDb().prepare('DELETE FROM providers WHERE id = ?').run(id);
    return { ok: true };
  });
};
