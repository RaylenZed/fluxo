import type { FastifyPluginAsync } from 'fastify';
import { getAllGroups, getGroupById, createGroup, updateGroup, deleteGroup } from './group.service';
import { getHttpStatus } from '../policy/policy.validation';

export const groupRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/groups', async (_req, reply) => {
    try {
      return getAllGroups();
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.get('/groups/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const group = getGroupById(id);
      if (!group) return reply.code(404).send({ error: 'Group not found' });
      return group;
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.post('/groups', async (req, reply) => {
    try {
      const body = req.body as {
        name: string;
        type: string;
        proxies: string[];
        providers?: string[];
        externalProvider?: { url?: string; interval?: number } | null;
        url?: string;
        interval?: number;
        tolerance?: number;
        filter?: string;
        use_all_proxies?: boolean;
        strategy?: string;
      };
      const result = createGroup(body);
      reply.code(201).send(result);
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.put('/groups/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as Partial<{
        name: string;
        type: string;
        proxies: string[];
        providers: string[];
        externalProvider: { url?: string; interval?: number } | null;
        url: string;
        interval: number;
        tolerance: number;
        filter: string;
        use_all_proxies: boolean;
        strategy: string;
      }>;
      updateGroup(id, body);
      reply.code(200).send({ ok: true });
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.delete('/groups/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      deleteGroup(id);
      reply.code(200).send({ ok: true });
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });
};
