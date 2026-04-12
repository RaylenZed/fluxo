import WebSocket from 'ws';
import { getDb } from '../../database/db';
import { normalizeControllerHost } from '../mihomo/mihomo.config';

type WsClient = WebSocket;
type RelayChannel = 'traffic' | 'connections' | 'logs';
type RealtimeLogEntry = {
  id: number;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  timestamp: string;
};

const clients = new Set<WsClient>();
const relayStatus: Record<RelayChannel, boolean> = {
  traffic: false,
  connections: false,
  logs: false,
};
const trafficSnapshot = {
  connected: false,
  up: 0,
  down: 0,
};
const connectionsSnapshot = {
  connected: false,
  connections: [] as unknown[],
  downloadTotal: 0,
  uploadTotal: 0,
};
const logsSnapshot = {
  connected: false,
  logs: [] as RealtimeLogEntry[],
};
let nextLogId = 1;

export function addClient(ws: WsClient) {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
}

function broadcast(data: unknown) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

function getMihomoWsConfig(): { host: string; secret: string } {
  // Env var takes precedence (Docker / systemd overrides)
  if (process.env.MIHOMO_API_URL) {
    try {
      const url = new URL(process.env.MIHOMO_API_URL);
      return { host: url.host, secret: process.env.MIHOMO_SECRET || '' };
    } catch {
      // fall through to DB
    }
  }
  const db = getDb();
  const apiUrlRow = db.prepare("SELECT value FROM settings WHERE key = 'mihomo.external_controller'").get() as
    | { value: string }
    | undefined;
  const secretRow = db.prepare("SELECT value FROM settings WHERE key = 'mihomo.secret'").get() as
    | { value: string }
    | undefined;
  const host = normalizeControllerHost(apiUrlRow ? JSON.parse(apiUrlRow.value) : '127.0.0.1:9090');
  const secret = secretRow ? JSON.parse(secretRow.value) : '';
  return { host, secret };
}

/**
 * Creates a resilient WebSocket relay to a Mihomo endpoint.
 * Uses exponential backoff (5s → 60s cap) and guarantees exactly one
 * reconnect timer at a time, preventing the timer-accumulation OOM bug.
 */
function makeRelay(
  channel: RelayChannel,
  urlFn: () => string,
  onMessage: (parsed: unknown) => void
): void {
  let retryDelay = 5_000;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    let connected = false;
    let closed = false;

    const ws = new WebSocket(urlFn());

    ws.on('open', () => {
      connected = true;
      relayStatus[channel] = true;
    });

    ws.on('message', (data) => {
      retryDelay = 5_000; // reset backoff on successful message
      try { onMessage(JSON.parse(data.toString())); } catch { /* ignore malformed */ }
    });

    // error is always followed by close in Node.js ws — just suppress it
    ws.on('error', () => {});

    ws.on('close', () => {
      if (closed) return; // guard against double-fire
      closed = true;
      relayStatus[channel] = false;
      if (timer) { clearTimeout(timer); timer = null; }
      const delay = connected ? 5_000 : retryDelay; // fast retry after clean close
      retryDelay = Math.min(retryDelay * 2, 60_000);
      timer = setTimeout(() => { timer = null; connect(); }, delay);
    });
  }

  // Stagger initial connections to avoid hammering Mihomo on startup
  setTimeout(connect, 3_000);
}

function normalizeLogLevel(level?: string): RealtimeLogEntry['level'] {
  if (level === 'error') return 'error';
  if (level === 'warning' || level === 'warn') return 'warning';
  if (level === 'debug') return 'debug';
  return 'info';
}

export function getTrafficSnapshot() {
  return {
    connected: relayStatus.traffic,
    up: trafficSnapshot.up,
    down: trafficSnapshot.down,
  };
}

export function getConnectionsSnapshot() {
  return {
    connected: relayStatus.connections,
    connections: connectionsSnapshot.connections,
    downloadTotal: connectionsSnapshot.downloadTotal,
    uploadTotal: connectionsSnapshot.uploadTotal,
  };
}

export function getLogsSnapshot(limit = 500) {
  return {
    connected: relayStatus.logs,
    logs: logsSnapshot.logs.slice(-limit),
  };
}

export function startMihomoRelay() {
  const { host, secret } = getMihomoWsConfig();
  const tokenSuffix = secret ? `?token=${encodeURIComponent(secret)}` : '';

  makeRelay(
    'traffic',
    () => `ws://${host}/traffic${tokenSuffix}`,
    (parsed) => {
      const payload = parsed as { up?: number; down?: number };
      trafficSnapshot.connected = relayStatus.traffic;
      trafficSnapshot.up = payload.up ?? 0;
      trafficSnapshot.down = payload.down ?? 0;
      broadcast({ type: 'traffic', data: payload });
    }
  );

  makeRelay(
    'connections',
    () => `ws://${host}/connections${tokenSuffix}`,
    (parsed) => {
      const p = parsed as { connections?: unknown[]; downloadTotal?: number; uploadTotal?: number };
      connectionsSnapshot.connected = relayStatus.connections;
      connectionsSnapshot.connections = p.connections ?? [];
      connectionsSnapshot.downloadTotal = p.downloadTotal ?? 0;
      connectionsSnapshot.uploadTotal = p.uploadTotal ?? 0;
      broadcast({
        type: 'connections',
        data: {
          connections: p.connections ?? [],
          downloadTotal: p.downloadTotal ?? 0,
          uploadTotal: p.uploadTotal ?? 0,
        },
      });
    }
  );

  makeRelay(
    'logs',
    () => `ws://${host}/logs${tokenSuffix}`,
    (parsed) => {
      const p = parsed as { type?: string; payload?: string };
      const entry: RealtimeLogEntry = {
        id: nextLogId++,
        level: normalizeLogLevel(p.type),
        message: p.payload ?? '',
        timestamp: new Date().toLocaleTimeString(),
      };
      logsSnapshot.connected = relayStatus.logs;
      logsSnapshot.logs = [...logsSnapshot.logs.slice(-499), entry];
      broadcast({ type: 'log', data: { type: entry.level, payload: entry.message } });
    }
  );
}
