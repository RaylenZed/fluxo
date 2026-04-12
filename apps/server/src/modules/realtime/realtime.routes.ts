import type { FastifyPluginAsync } from 'fastify';
import {
  getConnectionsSnapshot,
  getLogsSnapshot,
  getTrafficSnapshot,
} from './realtime.service';

export const realtimeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/realtime/traffic', async () => {
    return getTrafficSnapshot();
  });

  fastify.get('/realtime/connections', async () => {
    return getConnectionsSnapshot();
  });

  fastify.get('/realtime/logs', async (req) => {
    const { limit = '500' } = (req.query as { limit?: string }) ?? {};
    const parsedLimit = Number.parseInt(limit, 10);
    return getLogsSnapshot(Number.isFinite(parsedLimit) ? parsedLimit : 500);
  });
};
