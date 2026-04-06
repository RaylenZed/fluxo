"use client";
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Copy, Check, RefreshCw, Globe, Lock, LayoutDashboard,
  ArrowDown, ArrowUp, Activity, Cpu, Clock, Wifi,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Topbar } from '@/components/layout/topbar';
import { formatBytes, cn } from '@/lib/utils';
import { useLocale } from '@/lib/i18n/context';


function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded-[6px] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-all shrink-0"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function OverviewPage() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  // Load settings
  const { data: settings } = useQuery<Record<string, unknown>>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch(`/api/settings`);
      if (!res.ok) return {};
      return res.json();
    },
    refetchInterval: 30_000,
  });

  // Load Mihomo status
  const { data: mihomoStatus } = useQuery<{ running: boolean; version: string | null }>({
    queryKey: ['mihomo', 'status'],
    queryFn: async () => {
      const res = await fetch(`/api/mihomo/status`);
      if (!res.ok) return { running: false, version: null };
      return res.json();
    },
    refetchInterval: 10_000,
    retry: false,
  });

  // Load connections count
  const { data: connectionsData } = useQuery<{ connections?: unknown[] }>({
    queryKey: ['mihomo', 'connections'],
    queryFn: async () => {
      const res = await fetch(`/api/mihomo/connections`);
      if (!res.ok) return { connections: [] };
      return res.json();
    },
    refetchInterval: 5_000,
    retry: false,
  });

  // Load memory
  const { data: memoryData } = useQuery<{ inuse?: number }>({
    queryKey: ['mihomo', 'memory'],
    queryFn: async () => {
      const res = await fetch(`/api/mihomo/memory`);
      if (!res.ok) return {};
      return res.json();
    },
    refetchInterval: 5_000,
    retry: false,
  });

  // TUN toggle mutation
  const tunMutation = useMutation({
    mutationFn: async (enable: boolean) => {
      const res = await fetch(`/api/mihomo/tun`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable }),
      });
      if (!res.ok) throw new Error('Failed');
      // Also persist to settings
      await fetch(`/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'tun.enable': enable }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast.success(t.settings.configApplied);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: () => toast.error(t.settings.configFailed),
  });

  // Apply config mutation
  const applyConfig = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/config/apply`, { method: 'POST' });
      if (!res.ok) throw new Error('Apply failed');
      return res.json();
    },
    onSuccess: () => toast.success(t.settings.configApplied),
    onError: () => toast.error(t.settings.configFailed),
  });

  // Derive values from settings
  const mixedPort = (settings?.['general.mixed_port'] as number) ?? 7890;
  const externalController = (settings?.['mihomo.external_controller'] as string) ?? '127.0.0.1:9090';
  const tunEnabled = Boolean(settings?.['tun.enable'] ?? false);
  const currentMode = (settings?.['general.mode'] as string) ?? 'rule';
  const connectionCount = connectionsData?.connections?.length ?? 0;
  const memoryInuse = memoryData?.inuse;

  const proxyAddresses = [
    { label: t.overview.httpProxy, value: `127.0.0.1:${mixedPort}` },
    { label: t.overview.socks5, value: `127.0.0.1:${mixedPort}` },
    { label: t.overview.mixedPort, value: `127.0.0.1:${mixedPort}` },
  ];

  const statusItems = [
    {
      label: t.overview.mode,
      value: currentMode.charAt(0).toUpperCase() + currentMode.slice(1),
      icon: Activity,
      iconColor: 'bg-[var(--brand-100)] text-[var(--brand-500)] dark:bg-[var(--brand-500)]/20',
    },
    {
      label: t.system.connections,
      value: String(connectionCount),
      icon: Wifi,
      iconColor: 'bg-sky-50 text-sky-500 dark:bg-sky-500/20',
    },
    {
      label: t.overview.memoryUsage,
      value: memoryInuse != null ? formatBytes(memoryInuse) : 'N/A',
      icon: Cpu,
      iconColor: 'bg-amber-50 text-amber-500 dark:bg-amber-500/20',
    },
    {
      label: t.dashboard.uptime,
      value: 'N/A',
      icon: Clock,
      iconColor: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/20',
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Topbar title={t.overview.title} description={t.overview.subtitle}>
        <Button
          size="sm"
          variant="outline"
          className="gap-2 text-xs"
          onClick={() => applyConfig.mutate()}
          disabled={applyConfig.isPending}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', applyConfig.isPending && 'animate-spin')} />
          {applyConfig.isPending ? t.common.loading : t.overview.reloadConfig}
        </Button>
      </Topbar>

      <div className="flex-1 p-6 overflow-auto space-y-5">
        {/* Status grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statusItems.map((item) => (
            <Card key={item.label} className="p-4 flex items-start gap-3">
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]', item.iconColor)}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">{item.label}</p>
                <p className="mt-0.5 text-2xl font-extrabold text-[var(--foreground)] tracking-tighter">{item.value}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Network Mode */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t.overview.networkMode}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* System Proxy — OS-level, not directly controllable on Linux VPS */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)]">System Proxy</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">System proxy is managed at OS level on Linux</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary">{t.overview.osManaged}</Badge>
                </div>
              </div>

              {/* Enhanced Mode (TUN) */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)]">Enhanced Mode (TUN)</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">Capture all traffic via virtual NIC</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={tunEnabled ? 'success' : 'secondary'}>{tunEnabled ? t.status.active : t.status.inactive}</Badge>
                  <Switch
                    checked={tunEnabled}
                    onCheckedChange={(v) => tunMutation.mutate(v)}
                    disabled={tunMutation.isPending}
                  />
                </div>
              </div>

              {/* Gateway Mode — label only */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)]">Gateway Mode</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">Act as gateway for LAN devices</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary">{t.status.inactive}</Badge>
                  <Switch checked={false} disabled />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Proxy Addresses */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t.overview.proxyAddresses}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {proxyAddresses.map((addr) => (
                <div
                  key={addr.label}
                  className="flex items-center justify-between rounded-[10px] bg-[var(--surface-2)] px-3 py-2.5 border border-[var(--border)]"
                >
                  <div>
                    <p className="text-xs text-[var(--muted)] font-medium">{addr.label}</p>
                    <p className="text-sm font-mono font-semibold text-[var(--foreground)] mt-0.5">{addr.value}</p>
                  </div>
                  <CopyButton text={addr.value} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Connection Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t.overview.connectionInfo}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: t.overview.externalController, value: externalController, icon: Globe },
                { label: t.overview.apiSecret, value: '••••••••••••••••', icon: Lock },
                { label: 'Web Dashboard', value: `http://${externalController}/ui`, icon: LayoutDashboard },
              ].map((info) => (
                <div key={info.label} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)]">
                    <info.icon className="h-4 w-4 text-[var(--muted)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--muted)]">{info.label}</p>
                    <p className="text-sm font-mono text-[var(--foreground)] truncate">{info.value}</p>
                  </div>
                  <CopyButton text={info.value} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Mihomo Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t.overview.mihomoCore}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant={mihomoStatus?.running ? 'success' : 'destructive'}>
                  {mihomoStatus?.running ? t.status.running : t.status.stopped}
                </Badge>
                {mihomoStatus?.version && (
                  <span className="text-xs text-[var(--muted)] font-mono">{mihomoStatus.version}</span>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--brand-100)] text-[var(--brand-500)] dark:bg-[var(--brand-500)]/20">
                  <ArrowDown className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)] font-medium">{t.overview.downloaded}</p>
                  <p className="text-2xl font-extrabold text-[var(--foreground)] tracking-tighter">—</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-emerald-50 text-emerald-500 dark:bg-emerald-500/20">
                  <ArrowUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)] font-medium">{t.overview.uploaded}</p>
                  <p className="text-2xl font-extrabold text-[var(--foreground)] tracking-tighter">—</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
