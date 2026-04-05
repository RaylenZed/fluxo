import WebSocket from 'ws';
import { getDb } from '../../database/db';

type WsClient = WebSocket;

const clients = new Set<WsClient>();

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

function getMihomoConfig() {
  const db = getDb();
  const apiUrlRow = db.prepare("SELECT value FROM settings WHERE key = 'mihomo.external_controller'").get() as
    | { value: string }
    | undefined;
  const secretRow = db.prepare("SELECT value FROM settings WHERE key = 'mihomo.secret'").get() as
    | { value: string }
    | undefined;
  const host = apiUrlRow ? JSON.parse(apiUrlRow.value) : '127.0.0.1:9090';
  const secret = secretRow ? JSON.parse(secretRow.value) : '';
  return { host, secret };
}

export function startMihomoRelay() {
  const { host, secret } = getMihomoConfig();
  const tokenSuffix = secret ? `?token=${secret}` : '';

  // Relay traffic stream
  const trafficWsUrl = `ws://${host}/traffic${tokenSuffix}`;
  function connectTraffic() {
    const ws = new WebSocket(trafficWsUrl);
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        broadcast({ type: 'traffic', data: parsed });
      } catch {
        // ignore malformed messages
      }
    });
    ws.on('error', () => setTimeout(connectTraffic, 5000));
    ws.on('close', () => setTimeout(connectTraffic, 5000));
  }

  // Relay connections stream
  const connectionsWsUrl = `ws://${host}/connections${tokenSuffix}`;
  function connectConnections() {
    const ws = new WebSocket(connectionsWsUrl);
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString()) as {
          connections?: unknown[];
          downloadTotal?: number;
          uploadTotal?: number;
        };
        broadcast({
          type: 'connections',
          data: {
            connections: parsed.connections ?? [],
            downloadTotal: parsed.downloadTotal ?? 0,
            uploadTotal: parsed.uploadTotal ?? 0,
          },
        });
      } catch {
        // ignore malformed messages
      }
    });
    ws.on('error', () => setTimeout(connectConnections, 5000));
    ws.on('close', () => setTimeout(connectConnections, 5000));
  }

  // Relay log stream
  const logsWsUrl = `ws://${host}/logs${tokenSuffix}`;
  function connectLogs() {
    const ws = new WebSocket(logsWsUrl);
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString()) as { type?: string; payload?: string };
        broadcast({ type: 'log', data: { type: parsed.type ?? 'info', payload: parsed.payload ?? '' } });
      } catch {
        // ignore malformed messages
      }
    });
    ws.on('error', () => setTimeout(connectLogs, 5000));
    ws.on('close', () => setTimeout(connectLogs, 5000));
  }

  // Start connections with a delay to allow Mihomo to start
  setTimeout(connectTraffic, 3000);
  setTimeout(connectConnections, 3000);
  setTimeout(connectLogs, 3000);
}
