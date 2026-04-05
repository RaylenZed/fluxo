"use client";
import { useEffect, useState, useRef, useCallback } from "react";

const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8090").replace(/^http/, "ws") + "/ws";

export interface LogEntry {
  id: number;
  level: "info" | "warning" | "error" | "debug";
  message: string;
  timestamp: string;
}

export function useLogs(maxLines = 500) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const pausedRef = useRef(false);
  const idRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);

  const clear = useCallback(() => setLogs([]), []);
  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused((p) => !p);
  }, []);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => setConnected(true);

        ws.onmessage = (e) => {
          if (pausedRef.current) return;
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === "log" && msg.data) {
              const entry: LogEntry = {
                id: idRef.current++,
                level: msg.data.type ?? "info",
                message: msg.data.payload ?? "",
                timestamp: new Date().toLocaleTimeString(),
              };
              setLogs((prev) => {
                const next = [...prev, entry];
                return next.length > maxLines ? next.slice(-maxLines) : next;
              });
            }
          } catch {
            // ignore malformed messages
          }
        };

        ws.onclose = () => {
          setConnected(false);
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
  }, [maxLines]);

  return { logs, paused, connected, clear, togglePause };
}
