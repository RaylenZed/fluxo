"use client";
import { useEffect, useState, useRef } from 'react';

export interface TrafficPoint {
  t: number;
  up: number;
  down: number;
}

export function useRealtimeTraffic(maxPoints = 60) {
  const [points, setPoints] = useState<TrafficPoint[]>([]);
  const [current, setCurrent] = useState({ up: 0, down: 0 });
  const tRef = useRef(0);

  useEffect(() => {
    let active = true;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const res = await fetch('/api/realtime/traffic', { cache: 'no-store' });
        const data = res.ok ? await res.json() as { up?: number; down?: number } : { up: 0, down: 0 };
        if (!active) return;

        const up = data.up ?? 0;
        const down = data.down ?? 0;
        setCurrent({ up, down });
        setPoints((prev) => {
          const next = [...prev, { t: tRef.current++, up, down }];
          return next.length > maxPoints ? next.slice(-maxPoints) : next;
        });
      } catch {
        if (!active) return;
        setCurrent({ up: 0, down: 0 });
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
  }, [maxPoints]);

  return { points, current };
}
