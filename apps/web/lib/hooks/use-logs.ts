"use client";
import { useEffect, useState, useRef, useCallback } from "react";

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
  const clearedBeforeIdRef = useRef(0);

  const clear = useCallback(() => {
    setLogs((currentLogs) => {
      const latestId = currentLogs.at(-1)?.id;
      if (latestId) {
        clearedBeforeIdRef.current = latestId;
      }
      return [];
    });
  }, []);
  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused((p) => !p);
  }, []);

  useEffect(() => {
    let active = true;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const res = await fetch(`/api/realtime/logs?limit=${maxLines}`, { cache: 'no-store' });
        if (!active) return;

        if (!res.ok) {
          setConnected(false);
        } else {
          const data = await res.json() as { connected: boolean; logs: LogEntry[] };
          setConnected(data.connected);

          if (!pausedRef.current) {
            setLogs(data.logs.filter((entry) => entry.id > clearedBeforeIdRef.current));
          }
        }
      } catch {
        if (!active) return;
        setConnected(false);
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
  }, [maxLines]);

  return { logs, paused, connected, clear, togglePause };
}
