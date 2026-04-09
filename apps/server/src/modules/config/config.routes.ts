import type { FastifyPluginAsync } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import { generateConfig, writeConfigAndReload } from './config.generator';
import { reloadConfig } from '../mihomo/mihomo.service';
import { getSetting } from '../settings/settings.service';

function getConfigPath(): string {
  return process.env.CONFIG_PATH || '/etc/mihomo/config.yaml';
}


export const configRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/config — return current raw YAML on disk (or generated if not exists)
  fastify.get('/config', async (_req, reply) => {
    try {
      const configPath = getConfigPath();
      try {
        const content = await fs.readFile(configPath, 'utf-8');
        return reply.type('text/plain').send(content);
      } catch {
        // File doesn't exist yet, return generated
        const yaml = await generateConfig();
        return reply.type('text/plain').send(yaml);
      }
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Failed to read config' });
    }
  });

  // GET /api/config/generated — always return freshly generated YAML from DB
  fastify.get('/config/generated', async (_req, reply) => {
    try {
      const yaml = await generateConfig();
      return reply.type('text/plain').send(yaml);
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Failed to generate config' });
    }
  });

  // POST /api/config/apply — generate from DB, write, reload mihomo
  fastify.post('/config/apply', async (_req, reply) => {
    try {
      const configPath = getConfigPath();
      // Honour MIHOMO_API_URL env var (Docker / systemd override) first,
      // falling back to the DB-stored external_controller setting.
      let mihomoApiUrl: string;
      let mihomoSecret: string | undefined;
      if (process.env.MIHOMO_API_URL) {
        mihomoApiUrl = process.env.MIHOMO_API_URL;
        mihomoSecret = process.env.MIHOMO_SECRET || undefined;
      } else {
        const apiHost = (getSetting('mihomo.external_controller') as string) || '127.0.0.1:9090';
        mihomoApiUrl = `http://${apiHost}`;
        mihomoSecret = (getSetting('mihomo.secret') as string) || undefined;
      }
      await writeConfigAndReload(configPath, mihomoApiUrl, mihomoSecret);
      return { ok: true, configPath };
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Failed to apply config' });
    }
  });

  // PUT /api/config — save raw YAML and reload mihomo
  fastify.put('/config', async (req, reply) => {
    try {
      const { yaml: body } = req.body as { yaml: string };
      if (typeof body !== 'string' || !body.trim()) {
        return reply.code(400).send({ error: 'Empty config' });
      }
      const configPath = getConfigPath();
      const configDir = path.dirname(configPath);
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(configPath, body, 'utf-8');

      // Reload mihomo (without regenerating the file)
      await reloadConfig(configPath);

      return { ok: true };
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Failed to save config' });
    }
  });
};
