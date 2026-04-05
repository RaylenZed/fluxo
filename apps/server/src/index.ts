import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocketPlugin from '@fastify/websocket';
import { addClient, startMihomoRelay } from './modules/realtime/realtime.service';

const app = Fastify({ logger: true });

async function main() {
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  });
  await app.register(websocketPlugin);

  // Register all routes
  const { proxyRoutes } = await import('./modules/proxy/proxy.routes');
  const { groupRoutes } = await import('./modules/group/group.routes');
  const { ruleRoutes } = await import('./modules/rule/rule.routes');
  const { settingsRoutes } = await import('./modules/settings/settings.routes');
  const { mihomoRoutes } = await import('./modules/mihomo/mihomo.routes');
  const { profileRoutes } = await import('./modules/profile/profile.routes');
  const { dnsRoutes } = await import('./modules/dns/dns.routes');
  const { providerRoutes } = await import('./modules/provider/provider.routes');
  const { ruleProviderRoutes } = await import('./modules/rule-provider/rule-provider.routes');

  await app.register(proxyRoutes, { prefix: '/api' });
  await app.register(groupRoutes, { prefix: '/api' });
  await app.register(ruleRoutes, { prefix: '/api' });
  await app.register(settingsRoutes, { prefix: '/api' });
  await app.register(mihomoRoutes, { prefix: '/api' });
  await app.register(profileRoutes, { prefix: '/api' });
  await app.register(dnsRoutes, { prefix: '/api' });
  await app.register(providerRoutes, { prefix: '/api' });
  await app.register(ruleProviderRoutes, { prefix: '/api' });

  // WebSocket endpoint for real-time data
  app.get('/ws', { websocket: true }, (socket) => {
    addClient(socket as unknown as import('ws'));
  });

  // Health check
  app.get('/health', async () => ({ ok: true, timestamp: new Date().toISOString() }));

  const PORT = Number(process.env.PORT ?? 8090);
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Server running on port ${PORT}`);

  startMihomoRelay();
}

main().catch(console.error);
