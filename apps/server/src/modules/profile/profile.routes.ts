import type { FastifyPluginAsync } from 'fastify';
import {
  getAllProfiles,
  getProfileById,
  createProfile,
  updateProfile,
  deleteProfile,
  activateProfile,
} from './profile.service';
import { getHttpStatus } from '../policy/policy.validation';

export const profileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/profiles', async (_req, reply) => {
    try {
      return getAllProfiles();
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.get('/profiles/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const profile = getProfileById(id);
      if (!profile) return reply.code(404).send({ error: 'Profile not found' });
      return profile;
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.post('/profiles', async (req, reply) => {
    try {
      const body = req.body as { name: string; description?: string };
      const result = createProfile(body);
      reply.code(201).send(result);
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.put('/profiles/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as Partial<{ name: string; description: string; is_active: boolean }>;
      updateProfile(id, body);
      reply.code(200).send({ ok: true });
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.post('/profiles/:id/activate', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      activateProfile(id);
      reply.code(200).send({ ok: true });
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });

  fastify.delete('/profiles/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      deleteProfile(id);
      reply.code(200).send({ ok: true });
    } catch (err) {
      fastify.log.error(err);
      reply.code(getHttpStatus(err)).send({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  });
};
