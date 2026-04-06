"use client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCw, Server, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/topbar";
import { formatBytes, cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/context";


function useSystemStatus() {
  return useQuery({
    queryKey: ["system", "status"],
    queryFn: async () => {
      const [statusRes, memRes, connRes] = await Promise.all([
        fetch(`/api/mihomo/status`).then(r => r.ok ? r.json() : { running: false, version: null }),
        fetch(`/api/mihomo/memory`).then(r => r.ok ? r.json() : {}) as Promise<Record<string, number>>,
        fetch(`/api/mihomo/connections`).then(r => r.ok ? r.json() : { connections: [] }),
      ]);
      return {
        running: Boolean(statusRes.running),
        version: statusRes.version as string | null,
        memory: (memRes.inuse as number) ?? null,
        connections: ((connRes.connections as unknown[]) ?? []).length,
      };
    },
    refetchInterval: 5_000,
    retry: false,
  });
}

function ServiceCard({
  label, running, version, memory, connections, onRestart, restarting, t,
}: {
  label: string;
  running: boolean;
  version?: string | null;
  memory?: number | null;
  connections?: number;
  onRestart?: () => void;
  restarting?: boolean;
  t: { version: string; memory: string; connections: string; openConnections: string; restart: string; running: string; stopped: string };
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
        {memory != null && (
          <div className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2">
            <p className="text-[10px] text-[var(--muted)] font-medium">{t.memory}</p>
            <p className="text-sm font-semibold text-[var(--foreground)] mt-0.5">{formatBytes(memory)}</p>
          </div>
        )}
        {connections != null && (
          <div className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2 col-span-2">
            <p className="text-[10px] text-[var(--muted)] font-medium">{t.connections}</p>
            <p className="text-sm font-semibold text-[var(--foreground)] mt-0.5">{connections} {t.openConnections}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function SystemPage() {
  const { t } = useLocale();
  const { data, isLoading } = useSystemStatus();

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

  return (
    <div className="flex flex-col h-full">
      <Topbar title={sysT.title} description={sysT.subtitle} />
      <div className="flex-1 p-6 overflow-auto space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ServiceCard
              label={sysT.mihomoService}
              running={data?.running ?? false}
              version={data?.version}
              memory={data?.memory}
              connections={data?.connections}
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
        )}
      </div>
    </div>
  );
}
