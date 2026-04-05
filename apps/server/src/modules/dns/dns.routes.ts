import type { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../database/db';

function getDnsConfig() {
  const db = getDb();
  const row = db.prepare('SELECT * FROM dns_config WHERE id = 1').get() as Record<string, unknown> | undefined;
  if (!row) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT OR IGNORE INTO dns_config (id, enable, mode, nameservers, fallback_dns, fake_ip_filter, use_hosts, enhanced_mode, updated_at) VALUES (1, 1, 'fake-ip', '["223.5.5.5","119.29.29.29"]', '["8.8.8.8","1.1.1.1"]', '["*.local","+.lan"]', 1, 1, ?)`
    ).run(now);
    return getDnsConfig();
  }
  return {
    enable: Boolean(row.enable),
    mode: row.mode,
    nameservers: JSON.parse((row.nameservers as string) || '[]'),
    fallback_dns: JSON.parse((row.fallback_dns as string) || '[]'),
    fake_ip_filter: JSON.parse((row.fake_ip_filter as string) || '[]'),
    use_hosts: Boolean(row.use_hosts),
    enhanced_mode: Boolean(row.enhanced_mode),
  };
}

export const dnsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/dns', async (_req, reply) => {
    try {
      return getDnsConfig();
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.put('/dns', async (req, reply) => {
    try {
      const body = req.body as Partial<{
        enable: boolean;
        mode: string;
        nameservers: string[];
        fallback_dns: string[];
        fake_ip_filter: string[];
        use_hosts: boolean;
        enhanced_mode: boolean;
      }>;
      const now = new Date().toISOString();
      const db = getDb();
      db.prepare(
        `INSERT OR REPLACE INTO dns_config (id, enable, mode, nameservers, fallback_dns, fake_ip_filter, use_hosts, enhanced_mode, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        body.enable ? 1 : 0,
        body.mode ?? 'fake-ip',
        JSON.stringify(body.nameservers ?? ['223.5.5.5']),
        JSON.stringify(body.fallback_dns ?? ['8.8.8.8']),
        JSON.stringify(body.fake_ip_filter ?? ['*.local']),
        body.use_hosts ? 1 : 0,
        body.enhanced_mode ? 1 : 0,
        now
      );
      return { ok: true };
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
