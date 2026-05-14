import type { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../database/db';
import { randomUUID } from 'crypto';
import {
  HttpError,
  assertNonEmptyName,
  assertPolicyExists,
  assertValidProviderType,
  assertValidRuleProviderBehavior,
  getHttpStatus,
} from '../policy/policy.validation';

export const ruleProviderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/rule-providers', async () => {
    return getDb().prepare('SELECT * FROM rule_providers ORDER BY name').all();
  });

  fastify.post('/rule-providers', async (req, reply) => {
    try {
      const body = req.body as {
        name: string;
        type: string;
        behavior: string;
        url?: string;
        path?: string;
        interval?: number;
        policy: string;
      };
      const name = assertNonEmptyName(body.name, 'Rule provider name');
      const policy = assertNonEmptyName(body.policy, 'Policy');
      const type = assertNonEmptyName(body.type, 'Rule provider type');
      const behavior = assertNonEmptyName(body.behavior, 'Rule provider behavior');
      assertValidProviderType(type);
      assertValidRuleProviderBehavior(behavior);
      assertPolicyExists(policy);
      const url = typeof body.url === 'string' ? body.url.trim() : '';
      const providerPath = typeof body.path === 'string' ? body.path.trim() : '';
      if (type === 'http' && !url) throw new HttpError(400, 'HTTP rule provider requires a URL');
      if (type === 'file' && !providerPath) throw new HttpError(400, 'File rule provider requires a path');
      if (type === 'inline') throw new HttpError(400, 'Inline rule providers are not supported yet');

      const db = getDb();
      const duplicate = db.prepare('SELECT 1 FROM rule_providers WHERE name = ?').get(name);
      if (duplicate) throw new HttpError(409, `Rule provider already exists: ${name}`);

      const now = new Date().toISOString();
      const id = randomUUID();
      db.prepare(
          `INSERT INTO rule_providers (id, name, type, behavior, url, path, interval, policy, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          name,
          type,
          behavior,
          url || null,
          providerPath || null,
          body.interval ?? 86400,
          policy,
          now,
          now
        );
      reply.code(201).send({ id });
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.delete('/rule-providers/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const db = getDb();
      const existing = db.prepare('SELECT name FROM rule_providers WHERE id = ?').get(id) as { name: string } | undefined;
      if (!existing) throw new HttpError(404, 'Rule provider not found');

      const refs = db.prepare("SELECT COUNT(*) as count FROM rules WHERE type = 'RULE-SET' AND value = ?").get(existing.name) as { count: number };
      if (refs.count > 0) throw new HttpError(409, `Rule provider is still referenced by ${refs.count} rule(s)`);

      db.prepare('DELETE FROM rule_providers WHERE id = ?').run(id);
      return { ok: true };
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });
};
