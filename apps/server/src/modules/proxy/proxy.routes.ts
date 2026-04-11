import type { FastifyPluginAsync } from 'fastify';
import { getAllProxies, getProxyById, createProxy, updateProxy, deleteProxy } from './proxy.service';

export const proxyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/proxies', async (_req, reply) => {
    try {
      return getAllProxies();
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/proxies/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const proxy = getProxyById(id);
      if (!proxy) return reply.code(404).send({ error: 'Proxy not found' });
      return proxy;
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/proxies', async (req, reply) => {
    try {
      const body = req.body as {
        name: string;
        type: string;
        server: string;
        port: number;
        config: Record<string, unknown>;
      };
      const result = createProxy(body);
      reply.code(201).send(result);
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.put('/proxies/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as Partial<{
        name: string;
        type: string;
        server: string;
        port: number;
        config: Record<string, unknown>;
      }>;
      updateProxy(id, body);
      reply.code(200).send({ ok: true });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.delete('/proxies/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      deleteProxy(id);
      reply.code(200).send({ ok: true });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
