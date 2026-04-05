"use client";
import { useEffect, useState, useRef } from 'react';

const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8090').replace(/^http/, 'ws') + '/ws';

export interface Connection {
  id: string;
  metadata: {
    network: string;
    type: string;
    host: string;
    sourceIP: string;
    destinationPort: string;
    process?: string;
    processPath?: string;
  };
  upload: number;
  download: number;
  start: string;
  chains: string[];
  rule: string;
  rulePayload: string;
}

export interface ConnectionsState {
  connections: Connection[];
  downloadTotal: number;
  uploadTotal: number;
}

export function useRealtimeConnections() {
  const [state, setState] = useState<ConnectionsState>({ connections: [], downloadTotal: 0, uploadTotal: 0 });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'connections' && msg.data) {
              setState(msg.data);
            }
          } catch {
            // ignore malformed messages
          }
        };

        ws.onclose = () => { reconnectTimer = setTimeout(connect, 3000); };
        ws.onerror = () => { ws.close(); };
      } catch {
        reconnectTimer = setTimeout(connect, 3000);
      }
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  return state;
}
