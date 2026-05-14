"use client";
import { useCallback, useEffect, useState } from "react";
import { Save, RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeSegment, Topbar } from "@/components/layout/topbar";
import { useLocale } from "@/lib/i18n/context";
import { toast } from "sonner";

// Ports required by Fluxo — warn if user modifies them
const PROTECTED_PORTS: { port: number; service: string }[] = [
  { port: 8080, service: "Fluxo Web UI" },
  { port: 8090, service: "Fluxo API" },
  { port: 9090, service: "Mihomo REST API" },
];

const PROTECTED_PORT_KEYS = ["port", "socks-port", "mixed-port", "redir-port", "tproxy-port"];

type ConfigSource = "generated" | "raw";


export default function ConfigEditorPage() {
  const { t } = useLocale();
  const eT = t.configEditor;

  const [yaml, setYaml] = useState("");
  const [loadedYaml, setLoadedYaml] = useState("");
  const [source, setSource] = useState<ConfigSource>("generated");
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasUnsavedChanges = yaml !== loadedYaml;

  const loadConfig = useCallback(async (nextSource: ConfigSource, initial = false) => {
    if (initial) {
      setLoading(true);
    } else {
      setReloading(true);
    }

    try {
      const endpoint = nextSource === "generated" ? "/api/config/generated" : "/api/config";
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error();
      const text = await res.text();
      setYaml(text);
      setLoadedYaml(text);
      setSource(nextSource);
    } catch {
      toast.error(t.common.error);
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }, [t.common.error]);

  useEffect(() => {
    void loadConfig("generated", true);
  }, [loadConfig]);

  // Only flag reserved ports when they are assigned to inbound listener keys.
  function checkProtectedPorts(content: string): { port: number; service: string }[] {
    return PROTECTED_PORTS.filter(({ port }) => {
      const regex = new RegExp(`(^|\\n)(?:${PROTECTED_PORT_KEYS.join("|")}):\\s*${port}\\b`, "m");
      return regex.test(content);
    });
  }

  async function handleSourceChange(nextSource: ConfigSource) {
    if (nextSource === source) return;
    if (hasUnsavedChanges && !window.confirm(eT.discardChangesConfirm)) return;
    await loadConfig(nextSource);
  }

  async function handleSave() {
    // Warn if protected ports appear in the config
    const found = checkProtectedPorts(yaml);
    if (found.length > 0) {
      const names = found.map((p) => `${p.port} (${p.service})`).join(", ");
      const ok = window.confirm(
        `⚠️ Config contains protected ports: ${names}.\n\nThese ports are required by Fluxo. Modifying them may break the dashboard.\n\nSave anyway?`
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml }),
      });
      if (!res.ok) throw new Error();
      setLoadedYaml(yaml);
      setSource("raw");
      toast.success(eT.saved);
    } catch {
      toast.error(eT.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleReload() {
    if (source === "raw") {
      if (hasUnsavedChanges && !window.confirm(eT.discardChangesConfirm)) return;
      setReloading(true);
      try {
        const reloadRes = await fetch("/api/mihomo/reload", { method: "POST" });
        if (!reloadRes.ok) throw new Error();
        const configRes = await fetch("/api/config");
        if (!configRes.ok) throw new Error();
        const text = await configRes.text();
        setYaml(text);
        setLoadedYaml(text);
        toast.success(eT.reloaded);
      } catch {
        toast.error(eT.reloadFailed);
      } finally {
        setReloading(false);
      }
      return;
    }

    await loadConfig(source);
  }

  const activeModeLabel = source === "generated" ? eT.generatedMode : eT.rawMode;
  const activeModeDesc = source === "generated" ? eT.generatedModeDesc : eT.rawModeDesc;

  return (
    <div className="flex flex-col h-full">
      <Topbar title={eT.title} description={eT.subtitle}>
        <ModeSegment
          options={[
            { label: eT.sourceGenerated, value: "generated" },
            { label: eT.sourceRaw, value: "raw" },
          ]}
          value={source}
          onChange={(value) => void handleSourceChange(value as ConfigSource)}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleReload()}
          disabled={loading || reloading}
          className="gap-2 text-xs"
        >
          {reloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          {eT.reload}
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={loading || saving || !hasUnsavedChanges}
          className="gap-2 bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-white text-xs"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {eT.save}
        </Button>
      </Topbar>

      <div className="flex-1 flex flex-col p-6 min-h-0">
        {/* Protected ports banner */}
        <div className="mb-3 flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <span className="font-semibold">{activeModeLabel}</span> — {activeModeDesc}&nbsp;
            {PROTECTED_PORTS.map((p) => `${p.port} (${p.service})`).join(" · ")} {eT.reservedPortsWarning}
          </p>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" />
          </div>
        ) : (
          <textarea
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs font-mono text-[var(--foreground)] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] resize-none"
          />
        )}
      </div>
    </div>
  );
}
