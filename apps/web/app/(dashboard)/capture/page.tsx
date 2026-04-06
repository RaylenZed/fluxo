"use client";
import { useRef, useEffect, useState } from "react";
import { ScrollText, Trash2, Download, Pause, Play, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Topbar } from "@/components/layout/topbar";
import { useLogs, type LogEntry } from "@/lib/hooks/use-logs";
import { useLocale } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

type LevelFilter = "all" | "info" | "warning" | "error";

const levelColors: Record<string, string> = {
  info: "text-emerald-400",
  warning: "text-amber-400",
  error: "text-red-400",
  debug: "text-zinc-500",
};

const levelLabels: Record<string, string> = {
  info: "[INFO]",
  warning: "[WARN]",
  error: "[ERR ]",
  debug: "[DBG ]",
};

const levelPriority: Record<string, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
};

function matchesFilter(entry: LogEntry, filter: LevelFilter): boolean {
  if (filter === "all") return true;
  return levelPriority[entry.level] >= levelPriority[filter];
}

export default function LogsPage() {
  const { t } = useLocale();
  const lT = t.logs;
  const { logs, paused, connected, clear, togglePause } = useLogs(500);
  const [autoScroll, setAutoScroll] = useState(true);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = logs.filter((e) => matchesFilter(e, levelFilter));

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length, autoScroll]);

  const handleExport = () => {
    const content = filtered
      .map((e) => `${e.timestamp} ${levelLabels[e.level] ?? e.level} ${e.message}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mihomo-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      <Topbar title={lT.title} description={lT.subtitle}>
        <div className="flex items-center gap-1.5">
          {connected ? (
            <Wifi className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-[var(--muted)]" />
          )}
          <span className={cn("text-xs", connected ? "text-emerald-500" : "text-[var(--muted)]")}>
            {connected ? lT.connected : lT.disconnected}
          </span>
        </div>
        <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as LevelFilter)}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lT.allLevels}</SelectItem>
            <SelectItem value="info">INFO+</SelectItem>
            <SelectItem value="warning">WARN+</SelectItem>
            <SelectItem value="error">{lT.errorOnly}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--muted)] text-xs gap-1.5"
          onClick={() => setAutoScroll((v) => !v)}
        >
          <ScrollText className="h-3.5 w-3.5" />
          {autoScroll ? lT.autoScrollOn : lT.autoScrollOff}
        </Button>
        <Button variant="ghost" size="sm" className="text-[var(--muted)] text-xs gap-1.5" onClick={clear}>
          <Trash2 className="h-3.5 w-3.5" />
          {lT.clear}
        </Button>
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" />
          {lT.export}
        </Button>
        <Button
          size="sm"
          onClick={togglePause}
          className={cn("gap-1.5 text-xs font-semibold", paused ? "bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-white" : "bg-zinc-700 hover:bg-zinc-600 text-white")}
        >
          {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          {paused ? lT.resume : lT.pause}
        </Button>
      </Topbar>

      <div className="flex-1 p-6 overflow-hidden">
        <Card className="h-full flex flex-col">
          <CardContent className="flex-1 p-0 overflow-hidden">
            <div
              ref={scrollRef}
              className="h-full overflow-y-auto bg-zinc-950 rounded-[inherit] p-4"
              onScroll={(e) => {
                const el = e.currentTarget;
                const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
                setAutoScroll(isAtBottom);
              }}
            >
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  {connected ? (
                    <>
                      <ScrollText className="h-8 w-8 text-zinc-600" />
                      <p className="text-sm text-zinc-600">{lT.waitingForLogs}</p>
                      <p className="text-xs text-zinc-700">{lT.logsWillAppear}</p>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-8 w-8 text-zinc-600" />
                      <p className="text-sm text-zinc-600">{lT.waitingForMihomo}</p>
                      <p className="text-xs text-zinc-700">{lT.mihomoRunning}</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-0.5 font-mono text-sm">
                  {filtered.map((entry) => (
                    <div key={entry.id} className="flex gap-2 leading-relaxed">
                      <span className="shrink-0 text-zinc-600 text-xs">{entry.timestamp}</span>
                      <span className={cn("shrink-0 font-bold text-xs", levelColors[entry.level] ?? "text-zinc-400")}>
                        {levelLabels[entry.level] ?? entry.level.toUpperCase()}
                      </span>
                      <span className="text-zinc-300 text-xs break-all">{entry.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
