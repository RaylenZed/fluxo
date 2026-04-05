"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Play, Square, RotateCw, RefreshCw, Download, UploadCloud,
  Tag, Terminal, Trash2, Network, Shield, Bug, Globe,
  CheckCircle2, XCircle, AlertCircle, Loader2, Server,
  Package, Layers, Wifi, WifiOff, Container, Cpu,
  ChevronRight, TriangleAlert, ScrollText, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Topbar } from "@/components/layout/topbar";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8090";

// ─── Types ────────────────────────────────────────────────────────────────────

type DiagTarget = {
  name: string;
  latency: number | null;
  via: "proxy" | "direct" | "timeout";
};

type LogEntry = {
  level: "INFO" | "DEBUG" | "WARNING" | "ERROR";
  timestamp: string;
  message: string;
};

type TailscaleStatus = "connected" | "disconnected";
type CoreStatus = "running" | "stopped";

// ─── Constants ────────────────────────────────────────────────────────────────

const FAKE_SYSTEMCTL_OUTPUT = `● mihomo.service - Mihomo - A Rule Based Proxy
     Loaded: loaded (/etc/systemd/system/mihomo.service; enabled; preset: enabled)
     Active: active (running) since Mon 2024-01-15 10:20:21 UTC; 3h 4min ago
   Main PID: 12847 (mihomo)
      Tasks: 14 (limit: 9480)
     Memory: 128.3M
        CPU: 2.156s
     CGroup: /system.slice/mihomo.service
             └─12847 /usr/local/bin/mihomo -d /etc/mihomo

Jan 15 10:20:21 server mihomo[12847]: time="2024-01-15T10:20:21Z" level=info msg="Start initial compatible provider default"
Jan 15 10:20:21 server mihomo[12847]: time="2024-01-15T10:20:21Z" level=info msg="Mihomo v1.19.10 linux amd64"
Jan 15 10:20:22 server mihomo[12847]: time="2024-01-15T10:20:22Z" level=info msg="RESTful API listening at: 0.0.0.0:9090"`;

const FAKE_LOGS: LogEntry[] = [
  { level: "INFO",    timestamp: "2024-01-15 10:23:45", message: "[DNS] api.openai.com resolved to 104.21.32.1 (fake-ip: 198.18.0.1)" },
  { level: "INFO",    timestamp: "2024-01-15 10:23:46", message: "[Proxy] api.openai.com:443 → OpenAI → US OwO (Hysteria2)" },
  { level: "DEBUG",   timestamp: "2024-01-15 10:23:47", message: "[TUN] intercepted connection from PID 12456 (Cursor)" },
  { level: "INFO",    timestamp: "2024-01-15 10:23:48", message: "[DNS] www.github.com resolved to 140.82.114.4 (fake-ip: 198.18.0.2)" },
  { level: "INFO",    timestamp: "2024-01-15 10:23:49", message: "[Proxy] github.com:443 → GitHub → US LAX (VLESS)" },
  { level: "DEBUG",   timestamp: "2024-01-15 10:23:50", message: "[Rule] DOMAIN-SUFFIX,youtube.com matched → Proxy group: Streaming" },
  { level: "INFO",    timestamp: "2024-01-15 10:23:51", message: "[Proxy] youtube.com:443 → Streaming → JP TYO (Hysteria2)" },
  { level: "WARNING", timestamp: "2024-01-15 10:23:52", message: "[DNS] cloudflare.com query timeout, retrying via DoH" },
  { level: "INFO",    timestamp: "2024-01-15 10:23:53", message: "[Proxy] 1.1.1.1:53 → DIRECT → 12ms" },
  { level: "DEBUG",   timestamp: "2024-01-15 10:23:54", message: "[TUN] TCP 192.168.1.50:58302 → 8.8.8.8:53 intercepted" },
  { level: "INFO",    timestamp: "2024-01-15 10:23:55", message: "[Proxy] anthropic.com:443 → Claude → US SFO (Hysteria2)" },
  { level: "ERROR",   timestamp: "2024-01-15 10:23:56", message: "[Proxy] twitter.com:443 → connection timeout after 5000ms, retrying" },
  { level: "INFO",    timestamp: "2024-01-15 10:23:57", message: "[Proxy] twitter.com:443 → Twitter → SG SIN (VLESS) 201ms" },
  { level: "DEBUG",   timestamp: "2024-01-15 10:23:58", message: "[DNS] chatgpt.com resolved via fake-ip pool → 198.18.0.14" },
  { level: "INFO",    timestamp: "2024-01-15 10:23:59", message: "[Proxy] chatgpt.com:443 → OpenAI → US OwO (Hysteria2) 248ms" },
];

const DIAG_TARGETS_INITIAL: DiagTarget[] = [
  { name: "Google",      latency: null, via: "proxy" },
  { name: "GitHub",      latency: null, via: "proxy" },
  { name: "OpenAI",      latency: null, via: "proxy" },
  { name: "Cloudflare",  latency: null, via: "direct" },
  { name: "YouTube",     latency: null, via: "proxy" },
  { name: "Twitter",     latency: null, via: "proxy" },
  { name: "ChatGPT",     latency: null, via: "proxy" },
  { name: "Anthropic",   latency: null, via: "proxy" },
];

const DIAG_RESULTS: DiagTarget[] = [
  { name: "Google",      latency: 145,  via: "proxy" },
  { name: "GitHub",      latency: 188,  via: "proxy" },
  { name: "OpenAI",      latency: 234,  via: "proxy" },
  { name: "Cloudflare",  latency: 12,   via: "direct" },
  { name: "YouTube",     latency: 156,  via: "proxy" },
  { name: "Twitter",     latency: 201,  via: "proxy" },
  { name: "ChatGPT",     latency: 248,  via: "proxy" },
  { name: "Anthropic",   latency: 219,  via: "proxy" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function latencyColor(ms: number | null): string {
  if (ms === null) return "text-[var(--muted)]";
  if (ms < 100)  return "text-emerald-500";
  if (ms < 300)  return "text-amber-500";
  return "text-red-500";
}

function latencyLabel(ms: number | null): string {
  if (ms === null) return "—";
  return `${ms}ms`;
}

function logLevelColor(level: LogEntry["level"]): string {
  switch (level) {
    case "INFO":    return "text-sky-400";
    case "DEBUG":   return "text-[var(--muted)]";
    case "WARNING": return "text-amber-400";
    case "ERROR":   return "text-red-400";
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-widest mb-3">{children}</p>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <span className={cn("text-xs font-medium text-[var(--foreground)]", mono && "font-mono")}>{value}</span>
    </div>
  );
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────

function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = "Confirm", destructive = false, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => { onConfirm(); onOpenChange(false); }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InstallVersionDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [version, setVersion] = useState("v1.19.5");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Install Specific Version</DialogTitle>
          <DialogDescription>Enter the Mihomo version tag to install (e.g. v1.19.5).</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-2">
          <Input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="v1.19.5"
            className="font-mono"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onOpenChange(false)}>Install {version}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FixRoutesDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const output = `# Running TUN route fix...
$ ip rule del priority 9000 2>/dev/null || true
$ ip rule add priority 9000 not fwmark 0x162 table 0x162
$ ip route add table 0x162 local default dev mihomo
$ ip rule add priority 9001 lookup main suppress_prefixlength 0
✓ TUN routes restored successfully`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Fix TUN Routes</DialogTitle>
          <DialogDescription>Route rule repair output</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-2">
          <pre className="rounded-[12px] bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-xs p-4 overflow-x-auto whitespace-pre-wrap leading-5">
            {output}
          </pre>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Section 1: Mihomo Core Status ───────────────────────────────────────────

function CoreStatusCard() {
  const [status, setStatus] = useState<CoreStatus>("running");
  const [startOnBoot, setStartOnBoot] = useState(true);
  const [showStop, setShowStop] = useState(false);
  const [showRestart, setShowRestart] = useState(false);
  const [showInstallVersion, setShowInstallVersion] = useState(false);

  const { data: mihomoStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["mihomo", "status"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/mihomo/status`);
      if (!res.ok) return { running: false, version: null };
      return res.json() as Promise<{ running: boolean; version: string | null }>;
    },
    refetchInterval: 10_000,
    retry: false,
  });

  const applyConfig = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/api/config/apply`, { method: "POST" });
      if (!res.ok) throw new Error("Apply failed");
      return res.json();
    },
    onSuccess: () => toast.success("Config reloaded"),
    onError: () => toast.error("Failed to reload config"),
  });

  const isRunning = mihomoStatus?.running ?? status === "running";
  const version = mihomoStatus?.version ?? "Unknown";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]",
              isRunning
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-red-500/10 text-red-500"
            )}>
              <Server className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold">Mihomo Core</CardTitle>
                <Badge variant={isRunning ? "success" : "destructive"}>
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isRunning ? "bg-emerald-500" : "bg-red-500"
                  )} />
                  {isRunning ? "Running" : "Stopped"}
                </Badge>
              </div>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {statusLoading ? "Loading…" : `${version} · linux/amd64`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-[var(--muted)]">Start on Boot</span>
            <Switch checked={startOnBoot} onCheckedChange={setStartOnBoot} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Info rows */}
        <div className="rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] px-4 py-1">
          <InfoRow label="Config file"  value="/etc/mihomo/config.yaml" mono />
          <InfoRow label="Binary"       value="/usr/local/bin/mihomo"   mono />
          <InfoRow label="Architecture" value="linux/amd64" />
          <InfoRow label="PID"          value="12847" />
          <InfoRow label="Uptime"       value="3h 24m" />
        </div>

        {/* Action row */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={isRunning ? "outline" : "default"}
            className="gap-1.5"
            onClick={() => setStatus("running")}
            disabled={isRunning}
          >
            <Play className="h-3.5 w-3.5" /> Start
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setShowStop(true)}
            disabled={!isRunning}
          >
            <Square className="h-3.5 w-3.5" /> Stop
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setShowRestart(true)}
            disabled={!isRunning}
          >
            <RotateCw className="h-3.5 w-3.5" /> Restart
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => applyConfig.mutate()}
            disabled={applyConfig.isPending}
          >
            <RefreshCw className={`h-3.5 w-3.5${applyConfig.isPending ? " animate-spin" : ""}`} />
            {applyConfig.isPending ? "Reloading…" : "Reload Config"}
          </Button>
        </div>

        {/* Version row */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-[var(--border)]">
          <Button size="sm" variant="outline" className="gap-1.5">
            <Cpu className="h-3.5 w-3.5" /> Check for Update
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5">
            <UploadCloud className="h-3.5 w-3.5" /> Update to Latest
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowInstallVersion(true)}>
            <Tag className="h-3.5 w-3.5" /> Install Specific Version
          </Button>
        </div>
      </CardContent>

      <ConfirmDialog
        open={showStop}
        onOpenChange={setShowStop}
        title="Stop Mihomo?"
        description="Stopping Mihomo will terminate all proxy connections and network traffic will flow directly."
        confirmLabel="Stop"
        destructive
        onConfirm={() => setStatus("stopped")}
      />
      <ConfirmDialog
        open={showRestart}
        onOpenChange={setShowRestart}
        title="Restart Mihomo?"
        description="Active connections will be briefly interrupted while the core restarts."
        confirmLabel="Restart"
        onConfirm={() => {}}
      />
      <InstallVersionDialog open={showInstallVersion} onOpenChange={setShowInstallVersion} />
    </Card>
  );
}

// ─── Section 2: Service Management ───────────────────────────────────────────

function ServiceManagementCard() {
  const [serviceEnabled, setServiceEnabled] = useState(true);
  const [showUninstall, setShowUninstall] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[var(--muted)]" />
          <CardTitle className="text-sm font-semibold">Service Management</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="status">
          <TabsList>
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="controls">Controls</TabsTrigger>
            <TabsTrigger value="installation">Installation</TabsTrigger>
          </TabsList>

          {/* Status panel */}
          <TabsContent value="status" className="mt-4">
            <pre className="rounded-[12px] bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-xs p-4 overflow-x-auto whitespace-pre-wrap leading-5 max-h-52 overflow-y-auto">
              {FAKE_SYSTEMCTL_OUTPUT}
            </pre>
          </TabsContent>

          {/* Controls */}
          <TabsContent value="controls" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Systemd Service</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">Auto-start on system boot</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={serviceEnabled ? "success" : "secondary"}>
                  {serviceEnabled ? "Enabled" : "Disabled"}
                </Badge>
                <Switch checked={serviceEnabled} onCheckedChange={setServiceEnabled} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
              <Button size="sm" variant="outline" className="gap-1.5">
                <ScrollText className="h-3.5 w-3.5" /> View Logs
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Terminal className="h-3.5 w-3.5" /> Journal (live)
              </Button>
            </div>
          </TabsContent>

          {/* Installation */}
          <TabsContent value="installation" className="mt-4 space-y-3">
            <div className="rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] px-4 py-1">
              <InfoRow label="Installation path" value="/usr/local/bin/mihomo" mono />
              <InfoRow label="Config directory"  value="/etc/mihomo"           mono />
              <InfoRow label="Service file"      value="/etc/systemd/system/mihomo.service" mono />
              <InfoRow label="Status"            value="Installed" />
            </div>
            <div className="flex items-center gap-2 rounded-[12px] bg-red-500/5 border border-red-500/20 p-3">
              <TriangleAlert className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400 flex-1">
                Uninstalling Mihomo will remove the binary, service file, and all configuration.
              </p>
              <Button
                size="sm"
                variant="destructive"
                className="shrink-0 gap-1.5"
                onClick={() => setShowUninstall(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Uninstall
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      <ConfirmDialog
        open={showUninstall}
        onOpenChange={setShowUninstall}
        title="Uninstall Mihomo?"
        description="This will permanently remove the Mihomo binary (/usr/local/bin/mihomo), the systemd service, and all configuration in /etc/mihomo. This action cannot be undone."
        confirmLabel="Uninstall"
        destructive
        onConfirm={() => {}}
      />
    </Card>
  );
}

// ─── Section 3: Network Mode (TUN) ───────────────────────────────────────────

function TunConfigCard() {
  const [tunEnabled, setTunEnabled]             = useState(true);
  const [tunStack, setTunStack]                 = useState("system");
  const [autoRoute, setAutoRoute]               = useState(true);
  const [autoRedirect, setAutoRedirect]         = useState(false);
  const [dnsHijack, setDnsHijack]               = useState("any:53");
  const [showFixRoutes, setShowFixRoutes]        = useState(false);

  const setTun = useMutation({
    mutationFn: async (enable: boolean) => {
      const res = await fetch(`${API}/api/mihomo/tun`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (_data, enable) => {
      setTunEnabled(enable);
      toast.success("TUN setting saved (apply config to activate)");
    },
    onError: () => toast.error("Failed to update TUN"),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-[var(--muted)]" />
            <CardTitle className="text-sm font-semibold">Network Mode — TUN</CardTitle>
          </div>
          <Badge variant={tunEnabled ? "success" : "secondary"}>
            <span className={cn("h-1.5 w-1.5 rounded-full", tunEnabled ? "bg-emerald-500" : "bg-zinc-400")} />
            {tunEnabled ? "mihomo: UP, 198.18.0.1/15" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* TUN toggle - large */}
        <div className="flex items-center justify-between rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] px-4 py-3">
          <div>
            <p className="text-sm font-semibold">TUN Mode</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">Capture all TCP/UDP via virtual NIC</p>
          </div>
          <Switch
            checked={tunEnabled}
            onCheckedChange={(v) => setTun.mutate(v)}
            disabled={setTun.isPending}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* TUN Stack */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted)]">TUN Stack</label>
            <Select value={tunStack} onValueChange={setTunStack} disabled={!tunEnabled}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">system</SelectItem>
                <SelectItem value="gvisor">gvisor</SelectItem>
                <SelectItem value="lwip">lwip</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* DNS Hijack */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted)]">DNS Hijack</label>
            <Input
              value={dnsHijack}
              onChange={(e) => setDnsHijack(e.target.value)}
              placeholder="any:53"
              disabled={!tunEnabled}
              className="font-mono"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-1">
          {[
            { label: "Auto Route",    desc: "Automatically manage route tables",         checked: autoRoute,    set: setAutoRoute },
            { label: "Auto Redirect", desc: "Redirect TCP/UDP traffic automatically",    checked: autoRedirect, set: setAutoRedirect },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-[var(--muted)]">{item.desc}</p>
              </div>
              <Switch checked={item.checked} onCheckedChange={item.set} disabled={!tunEnabled} />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowFixRoutes(true)}>
            <RefreshCw className="h-3.5 w-3.5" /> Fix TUN Routes
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Container className="h-3.5 w-3.5" /> Docker Compatibility
          </Button>
        </div>
      </CardContent>

      <FixRoutesDialog open={showFixRoutes} onOpenChange={setShowFixRoutes} />
    </Card>
  );
}

// ─── Section 4: Network Diagnostics ──────────────────────────────────────────

function DiagnosticsCard() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<DiagTarget[]>(DIAG_TARGETS_INITIAL);
  const [exitIp, setExitIp] = useState<string | null>(null);

  function runDiagnostics() {
    setRunning(true);
    setExitIp(null);
    setResults(DIAG_TARGETS_INITIAL);

    DIAG_RESULTS.forEach((target, i) => {
      setTimeout(() => {
        setResults((prev) =>
          prev.map((t, j) => (j === i ? target : t))
        );
      }, (i + 1) * 300);
    });

    setTimeout(() => {
      setExitIp("104.21.xx.xx (United States)");
      setRunning(false);
    }, DIAG_RESULTS.length * 300 + 400);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[var(--muted)]" />
            <CardTitle className="text-sm font-semibold">Network Diagnostics</CardTitle>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={runDiagnostics} disabled={running}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bug className="h-3.5 w-3.5" />}
            {running ? "Running…" : "Run Diagnostics"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {results.map((target) => (
            <div
              key={target.name}
              className="flex flex-col items-center gap-1.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] py-3 px-2"
            >
              <p className="text-xs font-medium text-[var(--foreground)]">{target.name}</p>
              {target.latency === null ? (
                <p className="text-xs text-[var(--muted)]">—</p>
              ) : (
                <p className={cn("text-sm font-bold tabular-nums", latencyColor(target.latency))}>
                  {latencyLabel(target.latency)}
                </p>
              )}
              <Badge variant="secondary" className="text-[10px] py-0">
                {target.via}
              </Badge>
            </div>
          ))}
        </div>

        {/* Exit IP */}
        <div className="flex items-center justify-between rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[var(--muted)]" />
            <div>
              <p className="text-xs text-[var(--muted)]">Exit IP</p>
              <p className="text-sm font-mono font-semibold text-[var(--foreground)] mt-0.5">
                {exitIp ?? "—"}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={runDiagnostics} disabled={running}>
            <Wifi className="h-3.5 w-3.5" /> Test Proxy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section 5: Tailscale Integration ────────────────────────────────────────

function TailscaleCard() {
  const [tsStatus, setTsStatus] = useState<TailscaleStatus>("connected");
  const [compatible, setCompatible] = useState(true);

  const isConnected = tsStatus === "connected";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[var(--muted)]" />
            <CardTitle className="text-sm font-semibold">Tailscale Integration</CardTitle>
          </div>
          <Badge variant={isConnected ? "success" : "secondary"}>
            <span className={cn("h-1.5 w-1.5 rounded-full", isConnected ? "bg-emerald-500" : "bg-zinc-400")} />
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] px-4 py-1">
          <InfoRow label="Tailscale IP"  value="100.64.0.5" mono />
          <InfoRow label="Hostname"      value="homelab-server" />
          <InfoRow label="Network"       value="my-tailnet" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Install Tailscale
          </Button>
          {isConnected ? (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTsStatus("disconnected")}>
              <WifiOff className="h-3.5 w-3.5" /> Disconnect
            </Button>
          ) : (
            <Button size="sm" className="gap-1.5" onClick={() => setTsStatus("connected")}>
              <Wifi className="h-3.5 w-3.5" /> Connect
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5">
            <Terminal className="h-3.5 w-3.5" /> Show Status
          </Button>
        </div>

        <div className={cn(
          "flex items-start gap-2 rounded-[12px] border px-3 py-2.5 text-xs",
          compatible
            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
            : "bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400"
        )}>
          {compatible ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
          <div className="flex-1">
            {compatible
              ? "Tailscale is configured for Mihomo compatibility — exclude-interface, fake-ip-filter, and DIRECT rules are active."
              : "Tailscale not yet configured for Mihomo. Apply compatibility settings below."}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-6 px-2 text-[10px]"
            onClick={() => setCompatible(true)}
          >
            Auto-configure
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section 6: Docker Proxy ──────────────────────────────────────────────────

function DockerProxyCard() {
  const [dockerProxy, setDockerProxy] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Container className="h-4 w-4 text-[var(--muted)]" />
          <CardTitle className="text-sm font-semibold">Docker Proxy Configuration</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] px-4 py-3">
          <div>
            <p className="text-sm font-medium">Configure Docker to use Mihomo proxy</p>
            <p className="text-xs text-[var(--muted)] font-mono mt-0.5">http://127.0.0.1:7890</p>
          </div>
          <Switch checked={dockerProxy} onCheckedChange={setDockerProxy} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5">
            <ChevronRight className="h-3.5 w-3.5" /> Apply to systemd drop-in
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5">
            <ChevronRight className="h-3.5 w-3.5" /> Apply to daemon.json
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Package className="h-3.5 w-3.5" /> Test Docker Pull
          </Button>
        </div>

        <div className="flex items-center gap-2 rounded-[12px] bg-amber-500/5 border border-amber-500/20 px-3 py-2.5">
          <TriangleAlert className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Restart Docker daemon required after changes (<code className="font-mono">systemctl restart docker</code>).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section 7: IPv6 Management ──────────────────────────────────────────────

function IPv6Card() {
  const [ipv6, setIpv6]             = useState(true);
  const [persistent, setPersistent] = useState(true);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-[var(--muted)]" />
          <CardTitle className="text-sm font-semibold">IPv6 Management</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {[
          {
            label: "IPv6",
            desc: `Current status: ${ipv6 ? "Enabled" : "Disabled"} (via sysctl)`,
            checked: ipv6,
            set: setIpv6,
          },
          {
            label: "Persist across reboots",
            desc: "Write to /etc/sysctl.conf",
            checked: persistent,
            set: setPersistent,
          },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-[var(--muted)]">{item.desc}</p>
            </div>
            <Switch checked={item.checked} onCheckedChange={item.set} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Section 8: Log Viewer ────────────────────────────────────────────────────

const LOG_LEVELS = ["DEBUG", "INFO", "WARNING", "ERROR"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

function LogViewerCard() {
  const [logTab, setLogTab]           = useState<"mihomo" | "system">("mihomo");
  const [levelFilter, setLevelFilter] = useState<LogLevel>("DEBUG");
  const [autoScroll, setAutoScroll]   = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const filtered = FAKE_LOGS.filter(
    (l) => LOG_LEVELS.indexOf(l.level) >= LOG_LEVELS.indexOf(levelFilter)
  );

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [filtered, autoScroll]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-[var(--muted)]" />
            <CardTitle className="text-sm font-semibold">Log Viewer</CardTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-0.5 rounded-[12px] bg-[var(--surface-2)] p-1 border border-[var(--border)]">
              {(["mihomo", "system"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setLogTab(tab)}
                  className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-[9px]",
                    "px-3 py-1.5 text-xs font-medium transition-all duration-150",
                    logTab === tab
                      ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                      : "text-[var(--muted)]"
                  )}
                >
                  {tab === "mihomo" ? "Mihomo Log" : "System Log"}
                </button>
              ))}
            </div>

            <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as LogLevel)}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOG_LEVELS.map((l) => (
                  <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--muted)]">Auto-scroll</span>
              <Switch checked={autoScroll} onCheckedChange={setAutoScroll} />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="rounded-[12px] bg-zinc-950 border border-zinc-800 h-64 overflow-y-auto p-3 font-mono text-xs leading-5">
          {filtered.map((entry, i) => (
            <div key={i} className="flex gap-2">
              <span className={cn("shrink-0 font-semibold w-16", logLevelColor(entry.level))}>
                [{entry.level}]
              </span>
              <span className="text-zinc-500 shrink-0">{entry.timestamp}</span>
              <span className="text-zinc-300 break-all">{entry.message}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
          <div className="flex items-center gap-1.5 ml-auto text-[var(--muted)]">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs">{filtered.length} entries</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SystemPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="System" description="Mihomo core & network management" />

      <div className="flex-1 p-6 overflow-auto space-y-6">
        {/* Section 1 */}
        <div>
          <SectionLabel>Core Status</SectionLabel>
          <CoreStatusCard />
        </div>

        {/* Section 2 */}
        <div>
          <SectionLabel>Service Management</SectionLabel>
          <ServiceManagementCard />
        </div>

        {/* Section 3 */}
        <div>
          <SectionLabel>Network Mode</SectionLabel>
          <TunConfigCard />
        </div>

        {/* Section 4 */}
        <div>
          <SectionLabel>Network Diagnostics</SectionLabel>
          <DiagnosticsCard />
        </div>

        {/* Section 5 + 6 */}
        <div>
          <SectionLabel>Integrations</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <TailscaleCard />
            <DockerProxyCard />
          </div>
        </div>

        {/* Section 7 */}
        <div>
          <SectionLabel>IPv6</SectionLabel>
          <IPv6Card />
        </div>

        {/* Section 8 */}
        <div>
          <SectionLabel>Logs</SectionLabel>
          <LogViewerCard />
        </div>
      </div>
    </div>
  );
}
