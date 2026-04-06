"use client";
import { useState } from "react";
import { CalendarClock, Play, RefreshCw, Database, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Topbar } from "@/components/layout/topbar";
import { useLocale } from "@/lib/i18n/context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  name: string;
  description: string;
  schedule: string;
  lastRun: string | null;
  enabled: boolean;
  icon: React.ElementType;
}

export default function TasksPage() {
  const { t } = useLocale();
  const tT = t.tasks;

  const initialTasks: Task[] = [
    {
      id: "1",
      name: tT.task1Name,
      description: tT.task1Desc,
      schedule: tT.task1Schedule,
      lastRun: null,
      enabled: false,
      icon: RefreshCw,
    },
    {
      id: "2",
      name: tT.task2Name,
      description: tT.task2Desc,
      schedule: tT.task2Schedule,
      lastRun: null,
      enabled: false,
      icon: Database,
    },
    {
      id: "3",
      name: tT.task3Name,
      description: tT.task3Desc,
      schedule: tT.task3Schedule,
      lastRun: null,
      enabled: false,
      icon: Shield,
    },
  ];

  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, enabled: !task.enabled } : task)));
  };

  const handleRunNow = (task: Task) => {
    toast.info(`${tT.runNow}: "${task.name}"`, {
      description: tT.scheduledTasksDesc,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <Topbar title={tT.title} description={tT.subtitle} />

      <div className="flex-1 p-6 overflow-auto space-y-4">
        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] px-4 py-3">
          <CalendarClock className="h-4 w-4 text-[var(--brand-500)] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{tT.scheduledTasks}</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">{tT.scheduledTasksDesc}</p>
          </div>
        </div>

        {tasks.map((task) => {
          const Icon = task.icon;
          return (
            <Card key={task.id}>
              <div className="p-5 flex items-start gap-4">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]",
                  task.enabled ? "bg-[var(--brand-100)] dark:bg-[var(--brand-500)]/20" : "bg-[var(--surface-2)]"
                )}>
                  <Icon className={cn("h-5 w-5", task.enabled ? "text-[var(--brand-500)]" : "text-[var(--muted)]")} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">{task.name}</h3>
                    <Badge variant={task.enabled ? "success" : "secondary"}>
                      {task.enabled ? tT.enabled : tT.disabled}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{task.description}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)] pt-1">
                    <span className="font-mono bg-[var(--surface-2)] px-2 py-0.5 rounded-[6px] border border-[var(--border)]">
                      {task.schedule}
                    </span>
                    <span>{tT.lastRun}: {task.lastRun ?? tT.never}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => handleRunNow(task)}
                  >
                    <Play className="h-3 w-3" />
                    {tT.runNow}
                  </Button>
                  <Switch checked={task.enabled} onCheckedChange={() => toggleTask(task.id)} />
                </div>
              </div>
            </Card>
          );
        })}

        {/* Setup instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{tT.howToSetup}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">macOS (launchd)</p>
              <pre className="text-xs font-mono text-[var(--foreground)] bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] p-3 overflow-auto">{`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.mihomo.update-providers</string>
  <key>ProgramArguments</key>
  <array>
    <string>curl</string>
    <string>-X</string><string>PUT</string>
    <string>http://localhost:8090/api/mihomo/providers/update</string>
  </array>
  <key>StartInterval</key><integer>86400</integer>
</dict>
</plist>`}</pre>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Linux (cron)</p>
              <pre className="text-xs font-mono text-[var(--foreground)] bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] p-3 overflow-auto">{`# Add to crontab: crontab -e
0 */24 * * * curl -X PUT http://localhost:8090/api/mihomo/providers/update
0 0 */7 * * curl -X PUT http://localhost:8090/api/mihomo/geo/update`}</pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
