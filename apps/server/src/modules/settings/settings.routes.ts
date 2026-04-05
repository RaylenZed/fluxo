import type { FastifyPluginAsync } from 'fastify';
import path from 'path';
import { getAllSettings, updateSettings, getSetting } from './settings.service';
import { generateConfig, writeConfigAndReload } from '../config/config.generator';

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

  fastify.post('/config/generate', async (_req, reply) => {
    try {
      const yaml = await generateConfig();
      reply.header('Content-Type', 'text/yaml').send(yaml);
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Failed to generate config' });
    }
  });

  // GET /api/config/preview — preview YAML without writing
  fastify.get('/config/preview', async (_req, reply) => {
    try {
      const yaml = await generateConfig();
      reply.header('Content-Type', 'text/plain').send(yaml);
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Failed to generate config' });
    }
  });

  fastify.post('/config/apply', async (_req, reply) => {
    try {
      const configPath = process.env.CONFIG_PATH || path.join(process.cwd(), 'data', 'config.yaml');
      const apiHost = (getSetting('mihomo.external_controller') as string) || '127.0.0.1:9090';
      const mihomoApiUrl = `http://${apiHost}`;
      const mihomoSecret = (getSetting('mihomo.secret') as string) || undefined;
      await writeConfigAndReload(configPath, mihomoApiUrl, mihomoSecret);
      reply.code(200).send({ ok: true, configPath });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Failed to apply config' });
    }
  });
};
