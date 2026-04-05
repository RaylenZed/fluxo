"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Topbar } from "@/components/layout/topbar";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8090";

function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/settings`);
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json() as Promise<Record<string, unknown>>;
    },
    staleTime: 60_000,
  });
}

function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`${API}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: () => toast.error("Failed to save settings"),
  });
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[var(--border)] last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
        {description && <p className="text-xs text-[var(--muted)] mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const saveSettings = useSaveSettings();

  // General
  const [mixedPort, setMixedPort] = useState(7890);
  const [allowLAN, setAllowLAN] = useState(false);
  const [logLevel, setLogLevel] = useState("info");
  const [ipv6, setIpv6] = useState(false);

  // TUN
  const [tunEnable, setTunEnable] = useState(false);
  const [tunStack, setTunStack] = useState("system");
  const [tunAutoRoute, setTunAutoRoute] = useState(true);
  const [tunDnsHijack, setTunDnsHijack] = useState("any:53");

  // Remote
  const [externalController, setExternalController] = useState("127.0.0.1:9090");
  const [secret, setSecret] = useState("");

  // Sync form state when settings load
  useEffect(() => {
    if (!settings) return;
    if (settings["general.mixed_port"] !== undefined) setMixedPort(Number(settings["general.mixed_port"]));
    if (settings["general.allow_lan"] !== undefined) setAllowLAN(Boolean(settings["general.allow_lan"]));
    if (settings["general.log_level"] !== undefined) setLogLevel(String(settings["general.log_level"]));
    if (settings["general.ipv6"] !== undefined) setIpv6(Boolean(settings["general.ipv6"]));
    if (settings["tun.enable"] !== undefined) setTunEnable(Boolean(settings["tun.enable"]));
    if (settings["tun.stack"] !== undefined) setTunStack(String(settings["tun.stack"]));
    if (settings["tun.auto_route"] !== undefined) setTunAutoRoute(Boolean(settings["tun.auto_route"]));
    if (settings["tun.dns_hijack"] !== undefined) setTunDnsHijack(String(settings["tun.dns_hijack"]));
    if (settings["mihomo.external_controller"] !== undefined) setExternalController(String(settings["mihomo.external_controller"]));
    if (settings["mihomo.secret"] !== undefined) setSecret(String(settings["mihomo.secret"]));
  }, [settings]);

  const handleSave = () => {
    saveSettings.mutate({
      "general.mixed_port": mixedPort,
      "general.allow_lan": allowLAN,
      "general.log_level": logLevel,
      "general.ipv6": ipv6,
      "tun.enable": tunEnable,
      "tun.stack": tunStack,
      "tun.auto_route": tunAutoRoute,
      "tun.dns_hijack": tunDnsHijack,
      "mihomo.external_controller": externalController,
      "mihomo.secret": secret,
    });
  };

  const handleApplyConfig = async () => {
    try {
      const res = await fetch(`${API}/api/config/apply`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to apply");
      toast.success("Config applied to Mihomo");
    } catch {
      toast.error("Failed to apply config");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Settings" description="Configure Mihomo behavior" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Settings" description="Configure Mihomo behavior">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={handleApplyConfig}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Apply Config
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saveSettings.isPending}
          className="gap-1.5 text-xs bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-white"
        >
          {saveSettings.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Settings
        </Button>
      </Topbar>
      <div className="flex-1 p-6 overflow-auto space-y-5">
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="tun">TUN</TabsTrigger>
            <TabsTrigger value="remote">Remote</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="mt-5 space-y-4">
            <SectionCard title="Network">
              <SettingRow label="Mixed Port" description="HTTP/SOCKS5 mixed proxy port">
                <Input
                  value={mixedPort}
                  onChange={(e) => setMixedPort(Number(e.target.value))}
                  type="number"
                  className="w-24 text-right"
                />
              </SettingRow>
              <SettingRow label="Allow LAN" description="Accept connections from other devices on the network">
                <Switch checked={allowLAN} onCheckedChange={setAllowLAN} />
              </SettingRow>
              <SettingRow label="IPv6" description="Enable IPv6 support">
                <Switch checked={ipv6} onCheckedChange={setIpv6} />
              </SettingRow>
            </SectionCard>

            <SectionCard title="Logs">
              <SettingRow label="Log Level" description="Verbosity of Mihomo core logs">
                <Select value={logLevel} onValueChange={setLogLevel}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debug">Debug</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="silent">Silent</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            </SectionCard>
          </TabsContent>

          {/* TUN Tab */}
          <TabsContent value="tun" className="mt-5 space-y-4">
            <SectionCard title="TUN Mode">
              <SettingRow label="Enable TUN" description="Enable TUN virtual network interface for transparent proxying">
                <Switch checked={tunEnable} onCheckedChange={setTunEnable} />
              </SettingRow>
              <SettingRow label="Stack" description="TUN stack implementation">
                <Select value={tunStack} onValueChange={setTunStack}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="gvisor">gVisor</SelectItem>
                    <SelectItem value="lwip">LWIP</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow label="Auto Route" description="Auto-configure routing table for TUN">
                <Switch checked={tunAutoRoute} onCheckedChange={setTunAutoRoute} />
              </SettingRow>
            </SectionCard>

            <SectionCard title="DNS Hijack">
              <div className="py-3 space-y-2">
                <p className="text-sm font-medium text-[var(--foreground)]">DNS Hijack Address</p>
                <p className="text-xs text-[var(--muted)]">Intercept DNS queries at this address (e.g. any:53)</p>
                <Input
                  value={tunDnsHijack}
                  onChange={(e) => setTunDnsHijack(e.target.value)}
                  placeholder="any:53"
                  className="font-mono"
                />
              </div>
            </SectionCard>
          </TabsContent>

          {/* Remote Tab */}
          <TabsContent value="remote" className="mt-5 space-y-4">
            <SectionCard title="Controller">
              <div className="py-3 border-b border-[var(--border)] space-y-2">
                <p className="text-sm font-medium text-[var(--foreground)]">External Controller</p>
                <p className="text-xs text-[var(--muted)]">Address for the Mihomo REST API (host:port)</p>
                <Input
                  value={externalController}
                  onChange={(e) => setExternalController(e.target.value)}
                  placeholder="127.0.0.1:9090"
                  className="font-mono"
                />
              </div>
              <div className="py-3 space-y-2">
                <p className="text-sm font-medium text-[var(--foreground)]">API Secret</p>
                <p className="text-xs text-[var(--muted)]">Bearer token for external controller authentication</p>
                <Input
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  type="password"
                  placeholder="Leave blank for no authentication"
                />
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
