import type { FastifyPluginAsync } from 'fastify';
import { getAllSettings, updateSettings } from './settings.service';

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/settings', async (_req, reply) => {
    try {
      return getAllSettings();
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.put('/settings', async (req, reply) => {
    try {
      const body = req.body as Record<string, unknown>;
      updateSettings(body);
      reply.code(200).send({ ok: true });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
