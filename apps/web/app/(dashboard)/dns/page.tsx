"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Topbar } from "@/components/layout/topbar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8090";

interface DnsConfig {
  enable: boolean;
  mode: string;
  nameservers: string[];
  fallback_dns: string[];
  fake_ip_filter: string[];
  use_hosts: boolean;
  enhanced_mode: boolean;
}

function useDnsConfig() {
  return useQuery({
    queryKey: ["dns"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/dns`);
      if (!res.ok) throw new Error("Failed to load DNS config");
      return res.json() as Promise<DnsConfig>;
    },
    staleTime: 30_000,
  });
}

function useSaveDns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: DnsConfig) => {
      const res = await fetch(`${API}/api/dns`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dns"] });
      toast.success("DNS settings saved");
    },
    onError: () => toast.error("Failed to save DNS settings"),
  });
}

export default function DNSPage() {
  const { data, isLoading } = useDnsConfig();
  const saveDns = useSaveDns();

  const [enable, setEnable] = useState(true);
  const [mode, setMode] = useState("fake-ip");
  const [nameservers, setNameservers] = useState("223.5.5.5\n119.29.29.29");
  const [fallbackDns, setFallbackDns] = useState("8.8.8.8\n1.1.1.1");
  const [fakeIpFilter, setFakeIpFilter] = useState("*.local\n+.lan");
  const [useHosts, setUseHosts] = useState(true);
  const [enhancedMode, setEnhancedMode] = useState(true);

  useEffect(() => {
    if (!data) return;
    setEnable(data.enable);
    setMode(data.mode);
    setNameservers(data.nameservers.join("\n"));
    setFallbackDns(data.fallback_dns.join("\n"));
    setFakeIpFilter(data.fake_ip_filter.join("\n"));
    setUseHosts(data.use_hosts);
    setEnhancedMode(data.enhanced_mode);
  }, [data]);

  const handleSave = () => {
    saveDns.mutate({
      enable,
      mode,
      nameservers: nameservers.split("\n").map((s) => s.trim()).filter(Boolean),
      fallback_dns: fallbackDns.split("\n").map((s) => s.trim()).filter(Boolean),
      fake_ip_filter: fakeIpFilter.split("\n").map((s) => s.trim()).filter(Boolean),
      use_hosts: useHosts,
      enhanced_mode: enhancedMode,
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="DNS" description="DNS configuration" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" />
        </div>
      </div>
    );
  }

  const modeOptions = [
    { value: "fake-ip", label: "Fake IP", desc: "Use fake IPs to improve performance" },
    { value: "redir-host", label: "Redir Host", desc: "Redirect-based DNS resolution" },
    { value: "normal", label: "Normal", desc: "Standard DNS resolution" },
  ];

  return (
    <div className="flex flex-col h-full">
      <Topbar title="DNS" description="DNS configuration">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saveDns.isPending}
          className="gap-2 bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-white text-xs"
        >
          {saveDns.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
      </Topbar>

      <div className="flex-1 p-6 overflow-auto space-y-5">
        {/* Enable DNS */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Enable DNS</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">Enable Mihomo built-in DNS resolver</p>
              </div>
              <Switch checked={enable} onCheckedChange={setEnable} />
            </div>
          </CardContent>
        </Card>

        {/* DNS Mode */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Enhanced Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {modeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-[12px] border-2 px-4 py-3 text-left transition-all",
                    mode === opt.value
                      ? "border-[var(--brand-500)] bg-[var(--brand-100)]/40 dark:bg-[var(--brand-500)]/10"
                      : "border-[var(--border)] hover:border-[var(--brand-300)]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center", mode === opt.value ? "border-[var(--brand-500)]" : "border-[var(--border)]")}>
                      {mode === opt.value && <div className="h-2 w-2 rounded-full bg-[var(--brand-500)]" />}
                    </div>
                    <span className="text-sm font-semibold text-[var(--foreground)]">{opt.label}</span>
                  </div>
                  <p className="text-xs text-[var(--muted)] pl-6">{opt.desc}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Nameservers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Nameservers</CardTitle>
            <p className="text-xs text-[var(--muted)]">Primary DNS servers (one per line, supports tls:// and https://)</p>
          </CardHeader>
          <CardContent>
            <textarea
              value={nameservers}
              onChange={(e) => setNameservers(e.target.value)}
              rows={4}
              className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm font-mono text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] resize-none"
              placeholder="223.5.5.5&#10;119.29.29.29"
            />
          </CardContent>
        </Card>

        {/* Fallback DNS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Fallback DNS</CardTitle>
            <p className="text-xs text-[var(--muted)]">Fallback servers used when primary DNS is unavailable</p>
          </CardHeader>
          <CardContent>
            <textarea
              value={fallbackDns}
              onChange={(e) => setFallbackDns(e.target.value)}
              rows={3}
              className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm font-mono text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] resize-none"
              placeholder="8.8.8.8&#10;1.1.1.1"
            />
          </CardContent>
        </Card>

        {/* Options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">DNS Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <div className="flex items-center justify-between py-3 border-b border-[var(--border)]">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Read /etc/hosts</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">Use local hosts file for name resolution</p>
              </div>
              <Switch checked={useHosts} onCheckedChange={setUseHosts} />
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Enhanced Mode</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">Enable DNS enhanced mode for better performance</p>
              </div>
              <Switch checked={enhancedMode} onCheckedChange={setEnhancedMode} />
            </div>
          </CardContent>
        </Card>

        {/* Fake IP Filter */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Fake IP Filter</CardTitle>
            <p className="text-xs text-[var(--muted)]">Domains excluded from fake-ip (one per line)</p>
          </CardHeader>
          <CardContent>
            <textarea
              value={fakeIpFilter}
              onChange={(e) => setFakeIpFilter(e.target.value)}
              rows={5}
              className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm font-mono text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] resize-none"
              placeholder="*.local&#10;+.lan"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
