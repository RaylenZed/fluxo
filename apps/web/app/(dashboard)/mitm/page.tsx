"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, ExternalLink, Info, Loader2, Network, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Topbar } from "@/components/layout/topbar";
import { useLocale } from "@/lib/i18n/context";
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

export default function ProxyInfoPage() {
  const { t } = useLocale();
  const pT = t.proxyInfo;
  const { data: settings, isLoading } = useSettings();
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const mixedPort = settings?.["general.mixed_port"] ?? 7890;
  const httpAddr = `127.0.0.1:${mixedPort}`;
  const socks5Addr = `127.0.0.1:${mixedPort}`;
  const mixedAddr = `127.0.0.1:${mixedPort}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${pT.copied} ${label}`),
      () => toast.error(pT.copyFailed)
    );
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API}/api/mihomo/test-ip`);
      if (!res.ok) throw new Error("Mihomo not reachable");
      setTestResult({ ok: true, message: pT.reachable });
    } catch {
      setTestResult({ ok: false, message: pT.notReachable });
    } finally {
      setTesting(false);
    }
  };

  const proxyCommands = [
    { label: "curl", value: `curl -x http://${httpAddr} https://httpbin.org/ip` },
    { label: "wget", value: `https_proxy=http://${httpAddr} wget -O- https://httpbin.org/ip` },
    { label: "git", value: `git config --global http.proxy http://${httpAddr}` },
    { label: "npm", value: `npm config set proxy http://${httpAddr}` },
    { label: "pip", value: `pip install --proxy http://${httpAddr} <package>` },
    { label: "macOS env", value: `export http_proxy="http://${httpAddr}"; export https_proxy="http://${httpAddr}"` },
  ];

  return (
    <div className="flex flex-col h-full">
      <Topbar title={pT.title} description={pT.subtitle} />

      <div className="flex-1 p-6 overflow-auto space-y-5">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" />
          </div>
        ) : (
          <>
            {/* Proxy Addresses */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Network className="h-4 w-4 text-[var(--brand-500)]" />
                  {pT.proxyAddresses}
                </CardTitle>
                <p className="text-xs text-[var(--muted)]">{pT.proxyAddressesDesc}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: pT.httpProxy, value: `http://${httpAddr}`, copy: `http://${httpAddr}` },
                  { label: pT.socks5Proxy, value: `socks5://${socks5Addr}`, copy: `socks5://${socks5Addr}` },
                  { label: pT.mixed, value: mixedAddr, copy: mixedAddr },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-40 shrink-0">
                      <p className="text-xs font-medium text-[var(--muted)]">{item.label}</p>
                    </div>
                    <Input value={item.value} readOnly className="flex-1 font-mono text-xs bg-[var(--surface-2)]" />
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5 text-xs"
                      onClick={() => copyToClipboard(item.copy, item.label)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {pT.copy}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Connectivity Test */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">{pT.connectivityTest}</CardTitle>
                <p className="text-xs text-[var(--muted)]">{pT.connectivityTestDesc}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handleTest}
                  disabled={testing}
                  variant="outline"
                  className="gap-2"
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Info className="h-4 w-4" />}
                  {pT.testConnection}
                </Button>
                {testResult && (
                  <div className={`flex items-start gap-3 rounded-[12px] border px-4 py-3 ${testResult.ok ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20" : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"}`}>
                    {testResult.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                    )}
                    <p className={`text-sm ${testResult.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                      {testResult.message}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Export Commands */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">{pT.exportProxy}</CardTitle>
                <p className="text-xs text-[var(--muted)]">{pT.exportProxyDesc}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {proxyCommands.map((cmd) => (
                  <div key={cmd.label} className="flex items-center gap-3">
                    <div className="w-20 shrink-0">
                      <span className="text-xs font-mono font-semibold text-[var(--muted)] uppercase">{cmd.label}</span>
                    </div>
                    <code className="flex-1 min-w-0 text-xs font-mono text-[var(--foreground)] bg-[var(--surface-2)] rounded-[8px] px-3 py-2 truncate border border-[var(--border)]">
                      {cmd.value}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-xs gap-1"
                      onClick={() => copyToClipboard(cmd.value, `${cmd.label} command`)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* External Dashboard */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">{pT.mihomoDashboard}</CardTitle>
                <p className="text-xs text-[var(--muted)]">{pT.mihomoDashboardDesc}</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => window.open(`http://${settings?.["mihomo.external_controller"] ?? "127.0.0.1:9090"}/ui`, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {pT.openDashboard}
                  </Button>
                  <span className="text-xs text-[var(--muted)]">
                    {String(settings?.["mihomo.external_controller"] ?? "127.0.0.1:9090")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
