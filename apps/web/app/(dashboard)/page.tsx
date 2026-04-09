"use client";
import { ArrowDown, ArrowUp, Activity, Cpu, Zap, Server, Clock, MoreHorizontal, ArrowRight, RefreshCw, Power } from "lucide-react";
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
import { useLocale } from "@/lib/i18n/context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

async function ft(url: string, ms = 5000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { signal: ctrl.signal }); return r.ok ? r.json() : null; }
  catch { return null; } finally { clearTimeout(id); }
}

function useDashboardInfo() {
  return useQuery({
    queryKey: ["dashboard", "info"],
    queryFn: async () => {
      const [memRes, uptimeRes, settingsRes] = await Promise.all([
        ft(`/api/mihomo/memory`, 4000),
        ft(`/api/mihomo/uptime`, 3000),
        ft(`/api/settings`, 5000),
      ]);
      const settings = settingsRes ?? {};
      const tunEnabled = settings['tun.enable'] === true || settings['tun.enable'] === 'true';
      return {
        memory: (memRes?.inuse as number) ?? null,
        uptime: (uptimeRes?.uptime as number | null) ?? null,
        tunEnabled,
      };
    },
    refetchInterval: 15_000,
    retry: false,
  });
}

function fmtUptime(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return h < 24 ? `${h}h ${m}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

const policyColors: Record<string, string> = {
  DIRECT: "bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--border)]",
  Proxy: "bg-[var(--brand-100)] text-[var(--brand-600)] dark:bg-[var(--brand-500)]/20 dark:text-[var(--brand-300)]",
  OpenAI: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  Telegram: "bg-sky-50 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
};

function getPolicyColor(policy: string) {
  return policyColors[policy] ?? "bg-[var(--brand-100)] text-[var(--brand-600)]";
}

// ── Hero Banner ──────────────────────────────────────────────────────────────
function HeroBanner() {
  const { t } = useLocale();
  const heroLines = t.dashboardExtra.heroTitle.split('\n');
  return (
    <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[var(--brand-500)] via-[#6b4ef8] to-[var(--brand-700)] p-7 text-white">
      {/* Decorative sparkle shapes */}
      <div className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 opacity-20">
        <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
          <path d="M70 0 L76 64 L140 70 L76 76 L70 140 L64 76 L0 70 L64 64 Z" fill="white"/>
        </svg>
      </div>
      <div className="pointer-events-none absolute right-36 top-8 opacity-10">
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
          <path d="M30 0 L33 27 L60 30 L33 33 L30 60 L27 33 L0 30 L27 27 Z" fill="white"/>
        </svg>
      </div>
      <div className="pointer-events-none absolute right-20 bottom-4 opacity-10">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path d="M20 0 L22 18 L40 20 L22 22 L20 40 L18 22 L0 20 L18 18 Z" fill="white"/>
        </svg>
      </div>

      {/* Content */}
      <div className="relative max-w-[60%]">
        <p className="mb-3 text-[11px] font-semibold tracking-[0.14em] uppercase text-white/70">
          {t.dashboardExtra.heroTag}
        </p>
        <h2 className="mb-2 text-2xl font-bold leading-tight">
          {heroLines.map((line, i) => (
            <span key={i}>{line}{i < heroLines.length - 1 && <br />}</span>
          ))}
        </h2>
        <p className="mb-5 text-sm text-white/70">{t.dashboardExtra.heroSub}</p>
        <Link
          href="/overview"
          className="inline-flex items-center gap-2 rounded-full bg-black/85 hover:bg-black px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150"
        >
          {t.dashboardExtra.heroCta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, iconColor,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; iconColor: string;
}) {
  return (
    <Card className="group p-5 flex items-start gap-4 hover:shadow-lg transition-shadow duration-200">
      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", iconColor)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">{label}</p>
        <p className="mt-0.5 text-3xl font-bold text-[var(--foreground)] tracking-tight leading-none">{value}</p>
        {sub && <p className="text-xs text-[var(--muted)] mt-1">{sub}</p>}
      </div>
      <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 text-[var(--muted)] shrink-0 -mr-1 -mt-1">
        <MoreHorizontal className="h-3.5 w-3.5" />
      </Button>
    </Card>
  );
}

// ── Traffic Chart ────────────────────────────────────────────────────────────
function TrafficChart({ points, hasData }: { points: { t: number; up: number; down: number }[]; hasData: boolean }) {
  const { t } = useLocale();
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">{t.dashboard.realTimeTraffic}</CardTitle>
          <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--brand-500)]" />{t.dashboard.download}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />{t.dashboard.upload}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={130}>
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
              <p className="text-sm text-[var(--muted)] animate-pulse">{t.dashboard.waitingForData}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Right panel: Statistics ─────────────────────────────────────────────────
function StatisticsPanel({
  dashInfo,
  isRunning,
  version,
}: {
  dashInfo: { memory: number | null; uptime: number | null; tunEnabled: boolean } | undefined;
  isRunning: boolean;
  version: string | null;
}) {
  const { t } = useLocale();
  const qc = useQueryClient();

  const restartMihomo = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/mihomo/reload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (!res.ok) throw new Error('Failed to reload Mihomo');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard', 'info'] });
    },
  });

  const updateGeo = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/mihomo/geo/update', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to update GEO databases');
    },
  });

  return (
    <div className="space-y-4">
      {/* Statistic card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold">{t.dashboardExtra.heroStatLabel}</CardTitle>
            <Button variant="ghost" size="icon-sm" className="text-[var(--muted)]">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {/* Status row */}
          <div className="flex items-center justify-between rounded-[12px] bg-[var(--surface-2)] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className={cn(
                "h-2 w-2 rounded-full shrink-0",
                isRunning ? "bg-emerald-500 animate-pulse-dot" : "bg-[var(--muted-foreground)]"
              )} />
              <span className="text-sm font-medium text-[var(--foreground)]">Mihomo</span>
            </div>
            <Badge variant={isRunning ? "success" : "secondary"}>
              {isRunning ? (version ? `v${version}` : t.status.running) : t.status.offline}
            </Badge>
          </div>

          {/* Info rows */}
          <div className="space-y-2.5 px-1">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-[var(--muted-foreground)] shrink-0" />
              <span className="text-xs text-[var(--muted)] flex-1">{t.dashboard.uptime}</span>
              <span className="text-xs font-semibold text-[var(--foreground)]">
                {dashInfo?.uptime != null ? fmtUptime(dashInfo.uptime) : '—'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 text-[var(--muted-foreground)] shrink-0" />
              <span className="text-xs text-[var(--muted)] flex-1">{t.dashboard.memory}</span>
              <span className="text-xs font-semibold text-[var(--foreground)]">
                {dashInfo?.memory != null ? formatBytes(dashInfo.memory) : '—'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Server className="h-3.5 w-3.5 text-[var(--muted-foreground)] shrink-0" />
              <span className="text-xs text-[var(--muted)] flex-1">{t.dashboard.enhancedMode}</span>
              <Badge variant={dashInfo?.tunEnabled ? "success" : "secondary"} className="text-[10px]">
                {dashInfo?.tunEnabled ? t.status.on : t.status.off}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-[var(--muted-foreground)] shrink-0" />
              <span className="text-xs text-[var(--muted)] flex-1">{t.dashboard.systemProxy}</span>
              <Badge variant="secondary" className="text-[10px]">{t.status.off}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold">{t.dashboardExtra.heroQuickActions}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <button
            onClick={() => restartMihomo.mutate()}
            disabled={restartMihomo.isPending}
            className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-50 transition-colors text-left"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--brand-100)] dark:bg-[var(--brand-500)]/20">
              <Power className="h-3.5 w-3.5 text-[var(--brand-500)]" />
            </div>
            <span>{t.dashboardExtra.heroRestart}</span>
          </button>
          <button
            onClick={() => updateGeo.mutate()}
            disabled={updateGeo.isPending}
            className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-50 transition-colors text-left"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-emerald-50 dark:bg-emerald-500/20">
              <RefreshCw className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <span>{t.dashboardExtra.heroUpdateRules}</span>
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Skeleton rows ────────────────────────────────────────────────────────────
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

// ── Dashboard Page ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { points, current } = useRealtimeTraffic(60);
  const connState = useRealtimeConnections();
  const { data: statusData } = useMihomoStatus();
  const { data: dashInfo } = useDashboardInfo();
  const { t } = useLocale();

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
      <Topbar title={t.dashboard.title} description={t.dashboardExtra.subtitle} />

      <div className="flex-1 p-5 space-y-5 overflow-auto">
        {/* Hero Banner */}
        <HeroBanner />

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={t.dashboard.download}
            value={formatSpeed(current.down)}
            sub={`${t.dashboard.total} ${formatBytes(connState.downloadTotal)}`}
            icon={ArrowDown}
            iconColor="bg-[var(--brand-100)] text-[var(--brand-500)] dark:bg-[var(--brand-500)]/20"
          />
          <StatCard
            label={t.dashboard.upload}
            value={formatSpeed(current.up)}
            sub={`${t.dashboard.total} ${formatBytes(connState.uploadTotal)}`}
            icon={ArrowUp}
            iconColor="bg-emerald-50 text-emerald-500 dark:bg-emerald-500/20"
          />
          <StatCard
            label={t.dashboard.connections}
            value={String(connState.connections.length)}
            sub={t.dashboard.allActiveConnections}
            icon={Activity}
            iconColor="bg-sky-50 text-sky-500 dark:bg-sky-500/20"
          />
          <StatCard
            label={t.dashboard.latency}
            value="—"
            sub={t.dashboard.proxyTestPending}
            icon={Zap}
            iconColor="bg-amber-50 text-amber-500 dark:bg-amber-500/20"
          />
        </div>

        {/* Chart + right statistics panel */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <TrafficChart points={points} hasData={points.length > 0} />
          </div>
          <StatisticsPanel dashInfo={dashInfo} isRunning={isRunning} version={version} />
        </div>

        {/* Recent connections */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold">
                {t.dashboard.recentConnections}{' '}
                <span className="ml-1.5 text-sm font-normal text-[var(--muted)]">
                  ({connState.connections.length})
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-[var(--brand-500)] text-xs h-7">{t.dashboard.viewAll}</Button>
                <Button variant="ghost" size="sm" className="text-[var(--muted)] text-xs h-7">{t.dashboard.clear}</Button>
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
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 animate-pulse-dot" />
                    <span className="flex-1 min-w-0 text-sm font-medium text-[var(--foreground)] truncate font-mono">
                      {conn.host}
                    </span>
                    <span className="hidden sm:block text-[10px] font-mono font-bold text-[var(--muted)] bg-[var(--surface-2)] rounded px-1.5 py-0.5 uppercase shrink-0">
                      {conn.method}
                    </span>
                    <span className={cn(
                      "hidden md:block text-[11px] font-semibold rounded-[6px] px-2 py-0.5 shrink-0",
                      getPolicyColor(conn.policy)
                    )}>
                      {conn.policy}
                    </span>
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
