"use client";
import { useLocale } from "@/lib/i18n/context";
import { useRealtimeConnections } from "@/lib/hooks/use-connections";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { formatBytes } from "@/lib/utils";
import { Cpu } from "lucide-react";

export default function ProcessesPage() {
  const { t } = useLocale();
  const { connections } = useRealtimeConnections();

  const processMap = new Map<string, { count: number; upload: number; download: number }>();
  for (const conn of connections) {
    const meta = conn.metadata as Record<string, string>;
    const raw: string = meta?.process || meta?.processPath || t.processes.unknown;
    const name = raw.split("/").pop()?.split("\\").pop() || raw;
    const existing = processMap.get(name) ?? { count: 0, upload: 0, download: 0 };
    processMap.set(name, {
      count: existing.count + 1,
      upload: existing.upload + (conn.upload ?? 0),
      download: existing.download + (conn.download ?? 0),
    });
  }
  const processes = Array.from(processMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col h-full">
      <Topbar title={t.processes.title} description={t.processes.subtitle} />
      <div className="flex-1 p-6 overflow-auto">
        {processes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--muted)]">
            <Cpu className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">{t.processes.noProcesses}</p>
            <p className="text-xs mt-1 opacity-70">{t.processes.noProcessesHint}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {processes.map((proc) => (
              <Card key={proc.name} className="p-4 hover:shadow-lg transition-all">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-[10px] bg-[var(--brand-100)] dark:bg-[var(--brand-500)]/20 flex items-center justify-center shrink-0">
                    <Cpu className="h-4 w-4 text-[var(--brand-500)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--foreground)] truncate">{proc.name}</p>
                    <p className="text-xs text-[var(--muted)]">{proc.count} {t.processes.connections}</p>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-[var(--muted)]">
                  <span>↑ {formatBytes(proc.upload)}</span>
                  <span>↓ {formatBytes(proc.download)}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
