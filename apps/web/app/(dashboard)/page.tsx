"use client";
import { ArrowDown, ArrowUp, Activity, Cpu, Globe, Zap, Server, Clock, MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/topbar";
import { formatBytes, formatSpeed, cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";

// Mock traffic data
const trafficData = Array.from({ length: 30 }, (_, i) => ({
  t: i,
  up: Math.floor(Math.random() * 500 + 100) * 1024,
  down: Math.floor(Math.random() * 2000 + 200) * 1024,
}));

const recentConnections = [
  { host: "api.openai.com", method: "CONNECT", status: 200, policy: "OpenAI", chain: ["OpenAI", "US OwO"], sent: 1.2 * 1024 * 1024, recv: 14.8 * 1024 },
  { host: "www.google.com", method: "GET", status: 200, policy: "Proxy", chain: ["Proxy", "US OwO"], sent: 3 * 1024, recv: 98 * 1024 },
  { host: "api.github.com", method: "GET", status: 200, policy: "Proxy", chain: ["Proxy", "JP RFC"], sent: 420, recv: 8 * 1024 },
  { host: "www.baidu.com", method: "GET", status: 200, policy: "DIRECT", chain: ["DIRECT"], sent: 1 * 1024, recv: 45 * 1024 },
  { host: "telegram.org", method: "CONNECT", status: 200, policy: "Telegram", chain: ["Telegram", "US OwO"], sent: 88 * 1024, recv: 220 * 1024 },
  { host: "detectportal.firefox.com", method: "GET", status: 204, policy: "DIRECT", chain: ["DIRECT"], sent: 200, recv: 0 },
];

function StatCard({
  label, value, sub, icon: Icon, iconColor, trend,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; iconColor: string; trend?: "up" | "down";
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

function TrafficChart() {
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
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={trafficData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
      </CardContent>
    </Card>
  );
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

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Dashboard" description="Real-time network monitoring" />

      <div className="flex-1 p-6 space-y-5 overflow-auto">
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Download"
            value={formatSpeed(2.3 * 1024 * 1024)}
            sub="Total: 4.67 GB"
            icon={ArrowDown}
            iconColor="bg-[var(--brand-100)] text-[var(--brand-500)] dark:bg-[var(--brand-500)]/20"
          />
          <StatCard
            label="Upload"
            value={formatSpeed(0.4 * 1024 * 1024)}
            sub="Total: 1.59 GB"
            icon={ArrowUp}
            iconColor="bg-emerald-50 text-emerald-500 dark:bg-emerald-500/20"
          />
          <StatCard
            label="Connections"
            value="104"
            sub="15 active processes"
            icon={Activity}
            iconColor="bg-sky-50 text-sky-500 dark:bg-sky-500/20"
          />
          <StatCard
            label="Latency"
            value="156ms"
            sub="DNS: 24ms"
            icon={Zap}
            iconColor="bg-amber-50 text-amber-500 dark:bg-amber-500/20"
          />
        </div>

        {/* Chart + right panel */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <TrafficChart />
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
                {[
                  { icon: Server, label: "Mihomo", value: "v1.19.0" },
                  { icon: Globe, label: "Exit IP", value: "104.21.xx.xx" },
                  { icon: Clock, label: "Uptime", value: "3h 24m" },
                  { icon: Cpu, label: "Memory", value: "128 MB" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <item.icon className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    <span className="text-xs text-[var(--muted)] flex-1">{item.label}</span>
                    <span className="text-xs font-medium text-[var(--foreground)]">{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Recent connections */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Recent Connections <span className="ml-1.5 text-xs font-normal text-[var(--muted)]">({recentConnections.length})</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-[var(--brand-500)] text-xs h-7">View all</Button>
                <Button variant="ghost" size="sm" className="text-[var(--muted)] text-xs h-7">Clear</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-0.5">
              {recentConnections.map((conn, i) => (
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
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
