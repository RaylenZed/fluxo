"use client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCw, Server, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/topbar";
import { formatBytes, cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/context";


async function ft(url: string, ms = 5000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { signal: ctrl.signal }); return r.ok ? r.json() : null; }
  catch { return null; } finally { clearTimeout(id); }
}

function useMihomoStatus() {
  return useQuery({
    queryKey: ["system", "mihomo", "status"],
    queryFn: async () => ft(`/api/mihomo/status`, 5000),
    refetchInterval: 10_000,
    retry: false,
  });
}

function useMihomoMemory() {
  return useQuery({
    queryKey: ["system", "mihomo", "memory"],
    queryFn: async () => ft(`/api/mihomo/memory`, 4000),
    refetchInterval: 10_000,
    retry: false,
  });
}

function useMihomoConnections() {
  return useQuery({
    queryKey: ["system", "mihomo", "connections"],
    queryFn: async () => ft(`/api/mihomo/connections`, 5000),
    refetchInterval: 10_000,
    retry: false,
  });
}

function useMihomoUptime() {
  return useQuery({
    queryKey: ["system", "mihomo", "uptime"],
    queryFn: async () => ft(`/api/mihomo/uptime`, 3000),
    refetchInterval: 10_000,
    retry: false,
  });
}

function fmtUptime(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return h < 24 ? `${h}h ${m}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

function ServiceCard({
  label, running, version, memory, connections, uptime, showMemory, showConnections, showUptime, onRestart, restarting, t,
}: {
  label: string;
  running: boolean;
  version?: string | null;
  memory?: number | null;
  connections?: number | null;
  uptime?: number | null;
  showMemory?: boolean;
  showConnections?: boolean;
  showUptime?: boolean;
  onRestart?: () => void;
  restarting?: boolean;
  t: { version: string; memory: string; connections: string; openConnections: string; restart: string; running: string; stopped: string; uptime?: string };
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-10 w-10 rounded-[12px] flex items-center justify-center",
            running ? "bg-emerald-50 dark:bg-emerald-500/20" : "bg-[var(--surface-2)]"
          )}>
            <Server className={cn("h-5 w-5", running ? "text-emerald-500" : "text-[var(--muted)]")} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{label}</p>
            <Badge variant={running ? "success" : "secondary"} className="mt-1 text-[10px]">
              {running ? t.running : t.stopped}
            </Badge>
          </div>
        </div>
        {onRestart && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs shrink-0"
            onClick={onRestart}
            disabled={restarting}
          >
            {restarting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RotateCw className="h-3.5 w-3.5" />}
            {t.restart}
          </Button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {version && (
          <div className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2">
            <p className="text-[10px] text-[var(--muted)] font-medium">{t.version}</p>
            <p className="text-sm font-mono font-semibold text-[var(--foreground)] mt-0.5">{version}</p>
          </div>
        )}
        {showMemory && (
          <div className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2">
            <p className="text-[10px] text-[var(--muted)] font-medium">{t.memory}</p>
            <p className="text-sm font-semibold text-[var(--foreground)] mt-0.5">{memory != null ? formatBytes(memory) : "N/A"}</p>
          </div>
        )}
        {showConnections && (
          <div className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2">
            <p className="text-[10px] text-[var(--muted)] font-medium">{t.connections}</p>
            <p className="text-sm font-semibold text-[var(--foreground)] mt-0.5">{connections != null ? `${connections} ${t.openConnections}` : "N/A"}</p>
          </div>
        )}
        {showUptime && t.uptime && (
          <div className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2">
            <p className="text-[10px] text-[var(--muted)] font-medium">{t.uptime}</p>
            <p className="text-sm font-semibold text-[var(--foreground)] mt-0.5">{uptime != null ? fmtUptime(uptime) : "N/A"}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function SystemPage() {
  const { t } = useLocale();
  const { data: statusData } = useMihomoStatus();
  const { data: memoryData } = useMihomoMemory();
  const { data: connectionsData } = useMihomoConnections();
  const { data: uptimeData } = useMihomoUptime();

  const restartMihomo = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/mihomo/reload`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => toast.success("Mihomo reloaded"),
    onError: () => toast.error("Failed to reload Mihomo"),
  });

  const sysT = t.system;
  const running = Boolean(statusData?.running);
  const version = (statusData?.version as string | null) ?? null;
  const memory = (memoryData?.inuse as number | null) ?? null;
  const connections = Array.isArray(connectionsData?.connections)
    ? connectionsData.connections.length
    : null;
  const uptime = (uptimeData?.uptime as number | null) ?? null;

  return (
    <div className="flex flex-col h-full">
      <Topbar title={sysT.title} description={sysT.subtitle} />
      <div className="flex-1 p-6 overflow-auto space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ServiceCard
            label={sysT.mihomoService}
            running={running}
            version={version}
            memory={memory}
            connections={connections}
            uptime={uptime}
            showMemory
            showConnections
            showUptime
            onRestart={() => restartMihomo.mutate()}
            restarting={restartMihomo.isPending}
            t={sysT}
          />
          <ServiceCard
            label={sysT.fluxoService}
            running={true}
            version={undefined}
            t={sysT}
          />
        </div>
      </div>
    </div>
  );
}
