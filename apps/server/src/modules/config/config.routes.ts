import type { FastifyPluginAsync } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { generateConfig, writeConfigAndReload } from './config.generator';
import { reloadConfig } from '../mihomo/mihomo.service';
import { getMihomoConfig } from '../mihomo/mihomo.config';

function getConfigPath(): string {
  return process.env.CONFIG_PATH || '/etc/mihomo/config.yaml';
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const response = (err as { response?: { data?: unknown } }).response;
    const data = response?.data as { error?: string; message?: string } | undefined;
    if (typeof data?.message === 'string' && data.message.trim()) return data.message;
    if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
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

  // Backward-compatible alias used by older frontend code.
  fastify.get('/config/generate', async (_req, reply) => {
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
      const { apiUrl, secret } = getMihomoConfig();
      await writeConfigAndReload(configPath, apiUrl, secret);
      return { ok: true, configPath };
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: getErrorMessage(err, 'Failed to apply config') });
    }
  });

  // PUT /api/config — save raw YAML and reload mihomo
  fastify.put('/config', async (req, reply) => {
    try {
      const { yaml: body } = req.body as { yaml: string };
      if (typeof body !== 'string' || !body.trim()) {
        return reply.code(400).send({ error: 'Empty config' });
      }
      try {
        yaml.load(body);
      } catch (parseErr) {
        return reply.code(400).send({ error: `Invalid YAML: ${(parseErr as Error).message}` });
      }
      const configPath = getConfigPath();
      const configDir = path.dirname(configPath);
      const previousConfig = await fs.readFile(configPath, 'utf-8').catch(() => null);
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(configPath, body, 'utf-8');

      // Reload mihomo (without regenerating the file)
      try {
        await reloadConfig(configPath);
      } catch (reloadErr) {
        if (previousConfig !== null) {
          await fs.writeFile(configPath, previousConfig, 'utf-8');
          await reloadConfig(configPath).catch(() => undefined);
        }
        throw reloadErr;
      }

      return { ok: true };
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Failed to save config' });
    }
  });
};
