import type { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../database/db';
import { randomUUID } from 'crypto';

export const ruleProviderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/rule-providers', async () => {
    return getDb().prepare('SELECT * FROM rule_providers ORDER BY name').all();
  });

  fastify.post('/rule-providers', async (req, reply) => {
    const body = req.body as {
      name: string;
      type: string;
      behavior: string;
      url?: string;
      path?: string;
      interval?: number;
      policy: string;
    };
    const now = new Date().toISOString();
    const id = randomUUID();
    getDb()
      .prepare(
        `INSERT INTO rule_providers (id, name, type, behavior, url, path, interval, policy, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        body.name,
        body.type,
        body.behavior,
        body.url ?? null,
        body.path ?? null,
        body.interval ?? 86400,
        body.policy,
        now,
        now
      );
    reply.code(201).send({ id });
  });

  fastify.delete('/rule-providers/:id', async (req) => {
    const { id } = req.params as { id: string };
    getDb().prepare('DELETE FROM rule_providers WHERE id = ?').run(id);
    return { ok: true };
  });
};
