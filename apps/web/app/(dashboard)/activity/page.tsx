"use client";
import { useState, useRef } from "react";
import { Search, X, Pause, Play, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Topbar } from "@/components/layout/topbar";
import { formatBytes, cn } from "@/lib/utils";
import { useRealtimeConnections } from "@/lib/hooks/use-connections";
import type { Connection } from "@/lib/hooks/use-connections";
import { mihomoApi } from "@/lib/api";

interface DisplayConnection {
  id: string;
  host: string;
  method: string;
  policy: string;
  chain: string[];
  sent: number;
  recv: number;
  process: string;
  rule: string;
  startTime: string;
}

const policyColors: Record<string, string> = {
  DIRECT: "bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--border)]",
  Proxy: "bg-[var(--brand-100)] text-[var(--brand-600)] dark:bg-[var(--brand-500)]/20 dark:text-[var(--brand-300)]",
  OpenAI: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  Telegram: "bg-sky-50 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  Discord: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  Streaming: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
};
function getPolicyColor(policy: string) {
  return policyColors[policy] ?? "bg-[var(--brand-100)] text-[var(--brand-600)]";
}

const methodColors: Record<string, string> = {
  GET: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  POST: "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  CONNECT: "bg-[var(--brand-100)] text-[var(--brand-600)] dark:bg-[var(--brand-500)]/20 dark:text-[var(--brand-300)]",
  PUT: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  DELETE: "bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  TCP: "bg-[var(--brand-100)] text-[var(--brand-600)] dark:bg-[var(--brand-500)]/20 dark:text-[var(--brand-300)]",
  UDP: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
};

function ConnectionRow({ conn, onClose }: { conn: DisplayConnection; onClose: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div
        className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 hover:bg-[var(--surface-2)] transition-colors cursor-pointer group"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span className="flex-1 min-w-0 text-sm font-mono text-[var(--foreground)] truncate">{conn.host}</span>
        <span className={cn("hidden sm:block text-[10px] font-mono font-bold rounded px-1.5 py-0.5 shrink-0", methodColors[conn.method] ?? "bg-[var(--surface-2)] text-[var(--muted)]")}>{conn.method}</span>
        <span className={cn("hidden md:block text-[11px] font-semibold rounded-[6px] px-2 py-0.5 shrink-0", getPolicyColor(conn.policy))}>{conn.policy}</span>
        <span className="hidden lg:flex items-center gap-1 text-[11px] text-[var(--muted)] shrink-0 font-mono">
          {conn.chain.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 opacity-40" />}
              {c}
            </span>
          ))}
        </span>
        <span className="hidden xl:flex items-center gap-2 text-[11px] text-[var(--muted)] shrink-0 font-mono">
          <span className="flex items-center gap-0.5"><ArrowUp className="h-3 w-3 text-emerald-500" />{formatBytes(conn.sent)}</span>
          <span className="flex items-center gap-0.5"><ArrowDown className="h-3 w-3 text-[var(--brand-400)]" />{formatBytes(conn.recv)}</span>
        </span>
        <span className="hidden xl:block text-xs text-[var(--muted)] shrink-0">{conn.startTime}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-[var(--muted)] shrink-0 transition-transform duration-150", expanded && "rotate-180")} />
      </div>
      {expanded && (
        <div className="mx-2 mb-1 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-4 py-3 text-xs space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            {conn.process && (
              <div><span className="text-[var(--muted)]">Process: </span><span className="text-[var(--foreground)] font-mono">{conn.process}</span></div>
            )}
            <div><span className="text-[var(--muted)]">Start: </span><span className="text-[var(--foreground)] font-mono">{conn.startTime}</span></div>
            <div><span className="text-[var(--muted)]">Status: </span><span className="text-emerald-600">Active</span></div>
          </div>
          {conn.rule && (
            <div><span className="text-[var(--muted)]">Rule: </span><span className="text-[var(--foreground)] font-mono">{conn.rule}</span></div>
          )}
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3 text-emerald-500" />{formatBytes(conn.sent)}</span>
            <span className="flex items-center gap-1"><ArrowDown className="h-3 w-3 text-[var(--brand-400)]" />{formatBytes(conn.recv)}</span>
          </div>
          <div className="pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:text-red-600 text-xs h-7 px-2"
              onClick={(e) => { e.stopPropagation(); onClose(conn.id); }}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Close Connection
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function mapConnection(conn: Connection): DisplayConnection {
  const method = conn.metadata.type === 'CONNECT'
    ? 'CONNECT'
    : conn.metadata.network.toUpperCase();
  const startTime = conn.start
    ? new Date(conn.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';
  return {
    id: conn.id,
    host: conn.metadata.host,
    method,
    policy: conn.chains?.[0] ?? 'DIRECT',
    chain: conn.chains ?? [],
    sent: conn.upload,
    recv: conn.download,
    process: conn.metadata.process ?? conn.metadata.processPath ?? '',
    rule: conn.rule ? `${conn.rule}${conn.rulePayload ? `,${conn.rulePayload}` : ''}` : '',
    startTime,
  };
}

export default function ActivityPage() {
  const liveState = useRealtimeConnections();
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const [policyFilter, setPolicyFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");

  // When paused, keep a snapshot
  const snapshotRef = useRef(liveState);
  if (!paused) {
    snapshotRef.current = liveState;
  }
  const state = snapshotRef.current;

  const allConnections = state.connections.map(mapConnection);

  const filtered = allConnections.filter((c) => {
    if (policyFilter !== "all" && c.policy !== policyFilter) return false;
    if (methodFilter !== "all" && c.method !== methodFilter) return false;
    if (search && !c.host.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalSent = filtered.reduce((s, c) => s + c.sent, 0);
  const totalRecv = filtered.reduce((s, c) => s + c.recv, 0);

  async function handleCloseConnection(id: string) {
    try {
      await mihomoApi.closeConnection(id);
    } catch {
      // ignore – backend may already have removed it
    }
  }

  async function handleCloseAll() {
    try {
      await mihomoApi.closeAllConnections();
    } catch {
      // ignore
    }
  }

  // Build unique policy list from real data for filter dropdown
  const uniquePolicies = Array.from(new Set(allConnections.map((c) => c.policy)));

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Activity" description="Real-time connection log">
        <Button size="sm" variant="ghost" className="text-[var(--muted)] text-xs gap-1.5" onClick={handleCloseAll}>
          <X className="h-3.5 w-3.5" />
          Close All
        </Button>
        <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => setPaused((v) => !v)}>
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          {paused ? "Resume" : "Pause"}
        </Button>
      </Topbar>

      <div className="flex-1 p-6 overflow-auto space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted)]" />
            <Input
              placeholder="Search host..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={policyFilter} onValueChange={setPolicyFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Policy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Policies</SelectItem>
              {uniquePolicies.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="CONNECT">CONNECT</SelectItem>
              <SelectItem value="TCP">TCP</SelectItem>
              <SelectItem value="UDP">UDP</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table header */}
        <Card>
          <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-3">
            <span className="w-2 shrink-0" />
            <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Host</span>
            <span className="hidden sm:block w-16 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] shrink-0">Method</span>
            <span className="hidden md:block w-20 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] shrink-0">Policy</span>
            <span className="hidden lg:block w-40 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] shrink-0">Chain</span>
            <span className="hidden xl:block w-32 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] shrink-0">Traffic</span>
            <span className="hidden xl:block w-16 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] shrink-0">Start</span>
            <span className="w-4 shrink-0" />
          </div>
          <CardContent className="pt-2 pb-2 px-2 space-y-0.5">
            {filtered.length === 0 ? (
              <p className="text-center text-[var(--muted)] text-sm py-8">
                {allConnections.length === 0 ? "Waiting for connections..." : "No connections match the filter"}
              </p>
            ) : (
              filtered.map((conn) => (
                <ConnectionRow key={conn.id} conn={conn} onClose={handleCloseConnection} />
              ))
            )}
          </CardContent>
        </Card>

        {/* Stats bar */}
        <div className="flex items-center gap-6 px-1 text-xs text-[var(--muted)]">
          <span>Total: <strong className="text-[var(--foreground)]">{filtered.length}</strong></span>
          <span>Active: <strong className="text-emerald-600">{filtered.length}</strong></span>
          <span>Sent: <strong className="text-[var(--foreground)] font-mono">{formatBytes(totalSent)}</strong></span>
          <span>Received: <strong className="text-[var(--foreground)] font-mono">{formatBytes(totalRecv)}</strong></span>
          <span>↓ Total: <strong className="text-[var(--foreground)] font-mono">{formatBytes(state.downloadTotal)}</strong></span>
          <span>↑ Total: <strong className="text-[var(--foreground)] font-mono">{formatBytes(state.uploadTotal)}</strong></span>
          {paused && <Badge variant="warning">Paused</Badge>}
        </div>
      </div>
    </div>
  );
}
