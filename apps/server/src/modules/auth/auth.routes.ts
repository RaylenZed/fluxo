import '@fastify/cookie';
import type { FastifyPluginAsync } from 'fastify';
import {
  isSetupRequired,
  setPassword,
  verifyPassword,
  signToken,
  COOKIE_NAME,
} from './auth.service';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/auth/me — returns auth state (used by frontend to check session)
  fastify.get('/auth/me', async (req, reply) => {
    const token = (req.cookies as Record<string, string>)[COOKIE_NAME];
    const { verifyToken } = await import('./auth.service');
    if (token && verifyToken(token)) {
      return reply.send({ authenticated: true, setupRequired: false });
    }
    return reply.send({ authenticated: false, setupRequired: isSetupRequired() });
  });

  // POST /api/auth/setup — set password on first run (only when no password exists)
  fastify.post('/auth/setup', async (req, reply) => {
    if (!isSetupRequired()) {
      return reply.code(403).send({ error: 'Setup already complete. Use /api/auth/login.' });
    }
    const { password } = req.body as { password?: string };
    if (!password || password.length < 6) {
      return reply.code(400).send({ error: 'Password must be at least 6 characters.' });
    }
    await setPassword(password);
    const token = signToken();
    reply.setCookie(COOKIE_NAME, token, COOKIE_OPTS);
    return reply.send({ ok: true });
  });

  // POST /api/auth/login — verify password and issue session cookie
  fastify.post('/auth/login', async (req, reply) => {
    if (isSetupRequired()) {
      return reply.code(403).send({ error: 'Setup required. Use /api/auth/setup.' });
    }
    const { password } = req.body as { password?: string };
    if (!password) {
      return reply.code(400).send({ error: 'Password required.' });
    }
    const ok = await verifyPassword(password);
    if (!ok) {
      return reply.code(401).send({ error: 'Invalid password.' });
    }
    const token = signToken();
    reply.setCookie(COOKIE_NAME, token, COOKIE_OPTS);
    return reply.send({ ok: true });
  });

  // POST /api/auth/logout — clear session cookie
  fastify.post('/auth/logout', async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return reply.send({ ok: true });
  });
};
