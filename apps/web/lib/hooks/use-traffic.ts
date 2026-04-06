"use client";
import { useEffect, useState, useRef } from 'react';

// Dynamically resolve WS URL from the current browser host (Fastify is on port 8090)
const getWsUrl = () => {
  if (typeof window === 'undefined') return 'ws://localhost:8090/ws';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.hostname}:8090/ws`;
};

export interface TrafficPoint {
  t: number;
  up: number;
  down: number;
}

export function useRealtimeTraffic(maxPoints = 60) {
  const [points, setPoints] = useState<TrafficPoint[]>([]);
  const [current, setCurrent] = useState({ up: 0, down: 0 });
  const wsRef = useRef<WebSocket | null>(null);
  const tRef = useRef(0);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      try {
        const ws = new WebSocket(getWsUrl());
        wsRef.current = ws;

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'traffic' && msg.data) {
              const { up = 0, down = 0 } = msg.data;
              setCurrent({ up, down });
              setPoints(prev => {
                const next = [...prev, { t: tRef.current++, up, down }];
                return next.length > maxPoints ? next.slice(-maxPoints) : next;
              });
            }
          } catch {
            // ignore malformed messages
          }
        };

        ws.onclose = () => {
          reconnectTimer = setTimeout(connect, 3000);
        };
        ws.onerror = () => {
          ws.close();
        };
      } catch {
        reconnectTimer = setTimeout(connect, 3000);
      }
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [maxPoints]);

  return { points, current };
}
