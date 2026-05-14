import type { FastifyPluginAsync } from 'fastify';
import { getAllRules, getRuleById, createRule, updateRule, deleteRule, reorderRules } from './rule.service';
import { getHttpStatus } from '../policy/policy.validation';

export const ruleRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/rules', async (_req, reply) => {
    try {
      return getAllRules();
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.get('/rules/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const rule = getRuleById(id);
      if (!rule) return reply.code(404).send({ error: 'Rule not found' });
      return rule;
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.post('/rules', async (req, reply) => {
    try {
      const body = req.body as {
        type: string;
        value?: string;
        policy: string;
        notify?: boolean;
        extended_matching?: boolean;
        note?: string;
      };
      const result = createRule(body);
      reply.code(201).send(result);
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.put('/rules/reorder', async (req, reply) => {
    try {
      const { ids } = req.body as { ids: string[] };
      reorderRules(ids);
      reply.code(200).send({ ok: true });
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.put('/rules/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as Partial<{
        type: string;
        value: string;
        policy: string;
        notify: boolean;
        extended_matching: boolean;
        note: string;
      }>;
      updateRule(id, body);
      reply.code(200).send({ ok: true });
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.delete('/rules/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      deleteRule(id);
      reply.code(200).send({ ok: true });
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });
};
