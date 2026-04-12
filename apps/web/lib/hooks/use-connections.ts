"use client";
import { useEffect, useState } from 'react';

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
  connected?: boolean;
  connections: Connection[];
  downloadTotal: number;
  uploadTotal: number;
}

export function useRealtimeConnections() {
  const [state, setState] = useState<ConnectionsState>({ connected: false, connections: [], downloadTotal: 0, uploadTotal: 0 });

  useEffect(() => {
    let active = true;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const res = await fetch('/api/realtime/connections', { cache: 'no-store' });
        if (!active) return;
        if (!res.ok) {
          setState({ connected: false, connections: [], downloadTotal: 0, uploadTotal: 0 });
        } else {
          const data = await res.json() as ConnectionsState;
          setState(data);
        }
      } catch {
        if (!active) return;
        setState({ connected: false, connections: [], downloadTotal: 0, uploadTotal: 0 });
      } finally {
        if (active) {
          pollTimer = setTimeout(poll, 3000);
        }
      }
    }

    poll();
    return () => {
      active = false;
      clearTimeout(pollTimer);
    };
  }, []);

  return state;
}
