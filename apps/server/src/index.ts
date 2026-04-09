import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import websocketPlugin from '@fastify/websocket';
import fs from 'fs';
import path from 'path';
import { addClient, startMihomoRelay } from './modules/realtime/realtime.service';
import { generateConfig } from './modules/config/config.generator';
import { getDb } from './database/db';
import { verifyToken, COOKIE_NAME } from './modules/auth/auth.service';

const app = Fastify({ logger: true });

// Routes that don't require authentication
const PUBLIC_ROUTES = new Set([
  '/api/auth/me',
  '/api/auth/login',
  '/api/auth/setup',
  '/api/auth/logout',
  '/health',
]);

async function main() {
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(websocketPlugin);

  // Global authentication preHandler — runs before every route handler
  app.addHook('preHandler', async (req, reply) => {
    if (PUBLIC_ROUTES.has(req.url.split('?')[0])) return;
    // WebSocket endpoint also skips auth (frontend connects after page load)
    if (req.url === '/ws') return;

    const token = (req.cookies as Record<string, string>)[COOKIE_NAME]
      ?? (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);

    if (!token || !verifyToken(token)) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Register all routes
  const { authRoutes } = await import('./modules/auth/auth.routes');
  const { proxyRoutes } = await import('./modules/proxy/proxy.routes');
  const { groupRoutes } = await import('./modules/group/group.routes');
  const { ruleRoutes } = await import('./modules/rule/rule.routes');
  const { settingsRoutes } = await import('./modules/settings/settings.routes');
  const { mihomoRoutes } = await import('./modules/mihomo/mihomo.routes');
  const { profileRoutes } = await import('./modules/profile/profile.routes');
  const { dnsRoutes } = await import('./modules/dns/dns.routes');
  const { providerRoutes } = await import('./modules/provider/provider.routes');
  const { ruleProviderRoutes } = await import('./modules/rule-provider/rule-provider.routes');
  const { configRoutes } = await import('./modules/config/config.routes');

  await app.register(authRoutes, { prefix: '/api' });
  await app.register(proxyRoutes, { prefix: '/api' });
  await app.register(groupRoutes, { prefix: '/api' });
  await app.register(ruleRoutes, { prefix: '/api' });
  await app.register(settingsRoutes, { prefix: '/api' });
  await app.register(mihomoRoutes, { prefix: '/api' });
  await app.register(profileRoutes, { prefix: '/api' });
  await app.register(dnsRoutes, { prefix: '/api' });
  await app.register(providerRoutes, { prefix: '/api' });
  await app.register(ruleProviderRoutes, { prefix: '/api' });
  await app.register(configRoutes, { prefix: '/api' });

  // WebSocket endpoint for real-time data
  app.get('/ws', { websocket: true }, (socket) => {
    addClient(socket as unknown as import('ws'));
  });

  // Health check (public)
  app.get('/health', async () => ({ ok: true, timestamp: new Date().toISOString() }));

  const PORT = Number(process.env.PORT ?? 8090);
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Server running on port ${PORT}`);

  getDb();

  const configPath = process.env.CONFIG_PATH || '/etc/mihomo/config.yaml';
  const configDir = path.dirname(configPath);
  try {
    if (!fs.existsSync(configPath)) {
      app.log.info(`No config found at ${configPath}, generating default config...`);
      fs.mkdirSync(configDir, { recursive: true });
      const yaml = await generateConfig();
      fs.writeFileSync(configPath, yaml, 'utf-8');
      app.log.info(`Default config written to ${configPath}`);
    }
  } catch (err) {
    app.log.warn(`Could not write default config to ${configPath}: ${(err as Error).message}`);
    app.log.warn('You can manually generate it via POST /api/config/apply');
  }

  startMihomoRelay();
}

main().catch(console.error);
