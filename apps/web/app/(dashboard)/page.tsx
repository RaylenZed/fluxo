"use client";
import { ArrowDown, ArrowUp, Activity, Cpu, Globe, Zap, Server, Clock, MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/topbar";
import { formatBytes, formatSpeed, cn } from "@/lib/utils";
import {
  XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { useRealtimeTraffic } from "@/lib/hooks/use-traffic";
import { useRealtimeConnections } from "@/lib/hooks/use-connections";
import { useMihomoStatus } from "@/lib/hooks";

const policyColors: Record<string, string> = {
  DIRECT: "bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--border)]",
  Proxy: "bg-[var(--brand-100)] text-[var(--brand-600)] dark:bg-[var(--brand-500)]/20 dark:text-[var(--brand-300)]",
  OpenAI: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  Telegram: "bg-sky-50 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
};

function getPolicyColor(policy: string) {
  return policyColors[policy] ?? "bg-[var(--brand-100)] text-[var(--brand-600)]";
}

function StatCard({
  label, value, sub, icon: Icon, iconColor,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; iconColor: string;
}) {
  return (
    <Card className="p-4 flex items-start gap-3 hover:shadow-lg transition-shadow duration-200">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]", iconColor)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">{label}</p>
        <p className="mt-0.5 text-2xl font-extrabold text-[var(--foreground)] tracking-tighter">{value}</p>
        {sub && <p className="text-xs text-[var(--muted)] mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

function TrafficChart({ points, hasData }: { points: { t: number; up: number; down: number }[]; hasData: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Real-time Traffic</CardTitle>
          <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--brand-500)]" />Download</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Upload</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={points} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c5cfc" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7c5cfc" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorUp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis tickFormatter={(v) => formatBytes(v)} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <ReTooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                formatter={(v, name) => [formatBytes(Number(v)) + "/s", name === "down" ? "↓" : "↑"] as [string, string]}
                labelFormatter={() => ""}
              />
              <Area type="monotone" dataKey="down" stroke="#7c5cfc" strokeWidth={2} fill="url(#colorDown)" dot={false} />
              <Area type="monotone" dataKey="up" stroke="#10b981" strokeWidth={2} fill="url(#colorUp)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          {!hasData && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface)]/60 rounded-b-[12px]">
              <p className="text-sm text-[var(--muted)] animate-pulse">Waiting for data...</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Skeleton rows for when connections are not yet available
function SkeletonConnectionRows() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-[10px] px-3 py-2.5">
          <span className="h-2 w-2 rounded-full bg-[var(--border)] shrink-0" />
          <span className="flex-1 h-3.5 rounded bg-[var(--surface-2)] animate-pulse" />
          <span className="hidden sm:block h-3.5 w-16 rounded bg-[var(--surface-2)] animate-pulse" />
          <span className="hidden md:block h-3.5 w-16 rounded bg-[var(--surface-2)] animate-pulse" />
        </div>
      ))}
    </>
  );
}

export default function DashboardPage() {
  const { points, current } = useRealtimeTraffic(60);
  const connState = useRealtimeConnections();
  const { data: statusData } = useMihomoStatus();

  const isRunning = statusData?.running ?? false;
  const version = statusData?.version ?? null;

  const recentConns = connState.connections.slice(0, 6).map((conn) => ({
    host: conn.metadata.host,
    method: conn.metadata.type === 'CONNECT' ? 'CONNECT' : conn.metadata.network.toUpperCase(),
    policy: conn.chains?.[0] ?? 'DIRECT',
    chain: conn.chains ?? [],
    sent: conn.upload,
    recv: conn.download,
  }));

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Dashboard" description="Real-time network monitoring" />

      <div className="flex-1 p-6 space-y-5 overflow-auto">
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Download"
            value={formatSpeed(current.down)}
            sub={`Total: ${formatBytes(connState.downloadTotal)}`}
            icon={ArrowDown}
            iconColor="bg-[var(--brand-100)] text-[var(--brand-500)] dark:bg-[var(--brand-500)]/20"
          />
          <StatCard
            label="Upload"
            value={formatSpeed(current.up)}
            sub={`Total: ${formatBytes(connState.uploadTotal)}`}
            icon={ArrowUp}
            iconColor="bg-emerald-50 text-emerald-500 dark:bg-emerald-500/20"
          />
          <StatCard
            label="Connections"
            value={String(connState.connections.length)}
            sub="All active connections"
            icon={Activity}
            iconColor="bg-sky-50 text-sky-500 dark:bg-sky-500/20"
          />
          <StatCard
            label="Latency"
            value="—"
            sub="Proxy test pending"
            icon={Zap}
            iconColor="bg-amber-50 text-amber-500 dark:bg-amber-500/20"
          />
        </div>

        {/* Chart + right panel */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <TrafficChart points={points} hasData={points.length > 0} />
          </div>

          {/* Quick info */}
          <div className="space-y-4">
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">Network Mode</p>
              <div className="space-y-2.5">
                {[
                  { label: "System Proxy", value: "On", active: true },
                  { label: "Enhanced Mode (TUN)", value: "On", active: true },
                  { label: "Gateway Mode", value: "Off", active: false },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--muted)]">{item.label}</span>
                    <Badge variant={item.active ? "success" : "secondary"}>{item.value}</Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">Server Info</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Server className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  <span className="text-xs text-[var(--muted)] flex-1">Mihomo</span>
                  <span className="text-xs font-medium text-[var(--foreground)]">
                    {isRunning ? (version ? `v${version}` : 'Running') : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  <span className="text-xs text-[var(--muted)] flex-1">Exit IP</span>
                  <span className="text-xs font-medium text-[var(--foreground)]">—</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  <span className="text-xs text-[var(--muted)] flex-1">Uptime</span>
                  <span className="text-xs font-medium text-[var(--foreground)]">—</span>
                </div>
                <div className="flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  <span className="text-xs text-[var(--muted)] flex-1">Memory</span>
                  <span className="text-xs font-medium text-[var(--foreground)]">—</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Recent connections */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Recent Connections{' '}
                <span className="ml-1.5 text-xs font-normal text-[var(--muted)]">
                  ({connState.connections.length})
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-[var(--brand-500)] text-xs h-7">View all</Button>
                <Button variant="ghost" size="sm" className="text-[var(--muted)] text-xs h-7">Clear</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-0.5">
              {recentConns.length === 0 ? (
                <SkeletonConnectionRows />
              ) : (
                recentConns.map((conn, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 hover:bg-[var(--surface-2)] transition-colors group cursor-pointer"
                  >
                    {/* Status dot */}
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 animate-pulse-dot" />

                    {/* Host */}
                    <span className="flex-1 min-w-0 text-sm font-medium text-[var(--foreground)] truncate font-mono">
                      {conn.host}
                    </span>

                    {/* Method */}
                    <span className="hidden sm:block text-[10px] font-mono font-bold text-[var(--muted)] bg-[var(--surface-2)] rounded px-1.5 py-0.5 uppercase shrink-0">
                      {conn.method}
                    </span>

                    {/* Policy badge */}
                    <span className={cn(
                      "hidden md:block text-[11px] font-semibold rounded-[6px] px-2 py-0.5 shrink-0",
                      getPolicyColor(conn.policy)
                    )}>
                      {conn.policy}
                    </span>

                    {/* Traffic */}
                    <span className="hidden lg:flex items-center gap-2 text-[11px] text-[var(--muted)] shrink-0 font-mono">
                      <span className="flex items-center gap-0.5">
                        <ArrowUp className="h-3 w-3 text-emerald-500" />
                        {formatBytes(conn.sent)}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <ArrowDown className="h-3 w-3 text-[var(--brand-400)]" />
                        {formatBytes(conn.recv)}
                      </span>
                    </span>

                    <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 text-[var(--muted)] shrink-0">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
