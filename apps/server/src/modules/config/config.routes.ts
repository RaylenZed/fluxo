import type { FastifyPluginAsync } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { generateConfig, writeConfigAndReload } from './config.generator';
import { reloadConfig } from '../mihomo/mihomo.service';
import { getMihomoConfig } from '../mihomo/mihomo.config';
import { getSetting } from '../settings/settings.service';

function getConfigPath(): string {
  if (process.env.CONFIG_PATH) return process.env.CONFIG_PATH;
  if (getApplyMode() === 'managed') return '/etc/mihomo/config.yaml';
  return path.join(path.dirname(process.env.DB_PATH || path.join(process.cwd(), 'data', 'fluxo.db')), 'generated.yaml');
}

function getApplyMode(): 'manual' | 'managed' {
  const stored = getSetting('fluxo.apply_mode');
  if (stored === 'managed') return 'managed';
  if (stored === 'manual') return 'manual';

  const envMode = (process.env.FLUXO_DEFAULT_APPLY_MODE || process.env.FLUXO_APPLY_MODE)?.trim().toLowerCase();
  return envMode === 'managed' ? 'managed' : 'manual';
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
  fastify.get('/config/mode', async () => ({ mode: getApplyMode(), configPath: getConfigPath() }));

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

  fastify.get('/config/download', async (_req, reply) => {
    try {
      const yaml = await generateConfig();
      return reply
        .header('Content-Disposition', 'attachment; filename="mihomo-config.yaml"')
        .type('application/x-yaml')
        .send(yaml);
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

  // POST /api/config/apply — in managed mode write and reload Mihomo; in manual mode export to Fluxo data path only.
  fastify.post('/config/apply', async (_req, reply) => {
    try {
      const configPath = getConfigPath();
      if (getApplyMode() === 'manual') {
        const configDir = path.dirname(configPath);
        await fs.mkdir(configDir, { recursive: true });
        await fs.writeFile(configPath, await generateConfig(), 'utf-8');
        return { ok: true, applied: false, mode: 'manual', configPath };
      }

      const { apiUrl, secret } = getMihomoConfig();
      await writeConfigAndReload(configPath, apiUrl, secret);
      return { ok: true, applied: true, mode: 'managed', configPath };
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: getErrorMessage(err, 'Failed to apply config') });
    }
  });

  // PUT /api/config — save raw YAML; managed mode also reloads Mihomo.
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

      if (getApplyMode() === 'manual') {
        return { ok: true, reloaded: false, mode: 'manual' };
      }

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

      return { ok: true, reloaded: true, mode: 'managed' };
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Failed to save config' });
    }
  });
};
