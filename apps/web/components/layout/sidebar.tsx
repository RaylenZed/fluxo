"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Activity, LayoutDashboard, Eye, Cpu, Monitor, GitBranch,
  List, Info, Database, Package, FileText, CalendarClock,
  Settings, Server, ChevronRight, Zap, Globe, ScrollText, FileCode2
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMihomoStatus } from "@/lib/hooks";
import { useLocale } from "@/lib/i18n/context";

export function Sidebar() {
  const pathname = usePathname();
  const { data: statusData } = useMihomoStatus();
  const isRunning = statusData?.running ?? false;
  const version = statusData?.version ?? null;
  const { locale, setLocale, t } = useLocale();

  const navItems = [
    {
      group: t.nav.groupOverview,
      items: [
        { href: "/", label: t.nav.dashboard, icon: LayoutDashboard },
        { href: "/activity", label: t.nav.activity, icon: Activity },
        { href: "/overview", label: t.nav.overview, icon: Eye },
      ],
    },
    {
      group: t.nav.groupClient,
      items: [
        { href: "/processes", label: t.nav.processes, icon: Cpu },
        { href: "/devices", label: t.nav.devices, icon: Monitor },
      ],
    },
    {
      group: t.nav.groupProxy,
      items: [
        { href: "/policies", label: t.nav.policies, icon: GitBranch },
        { href: "/rules", label: t.nav.rules, icon: List },
      ],
    },
    {
      group: t.nav.groupTools,
      items: [
        { href: "/capture", label: t.nav.logs, icon: ScrollText },
        { href: "/mitm", label: t.nav.proxyInfo, icon: Info },
        { href: "/rewrite", label: t.nav.ruleSets, icon: Database },
      ],
    },
    {
      group: t.nav.groupSystem,
      items: [
        { href: "/modules", label: t.nav.providers, icon: Package },
        { href: "/profiles", label: t.nav.profiles, icon: FileText },
        { href: "/scripts", label: t.nav.tasks, icon: CalendarClock },
        { href: "/dns", label: t.nav.dns, icon: Globe },
        { href: "/config-editor", label: t.nav.configEditor, icon: FileCode2 },
      ],
    },
  ];

  const bottomItems = [
    { href: "/settings", label: t.nav.settings, icon: Settings },
    { href: "/system", label: t.nav.system, icon: Server },
  ];

  return (
    <aside className="flex h-full w-[220px] flex-col bg-[var(--sidebar)] border-r border-[var(--sidebar-border)] overflow-hidden shrink-0 rounded-l-[24px]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--brand-500)] shadow-sm">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <span className="text-[15px] font-bold text-[var(--brand-500)] tracking-tight">Fluxo</span>
        </div>
      </div>

      {/* Mihomo status */}
      <div className="mx-3 mb-3 flex items-center justify-between rounded-[12px] bg-[var(--surface-2)] px-3 py-2.5 border border-[var(--border)]">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isRunning ? "bg-emerald-500 animate-pulse-dot" : "bg-[var(--muted-foreground)]"
            )}
          />
          <span className={cn("text-xs font-medium", isRunning ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--muted)]")}>
            {isRunning ? t.status.running : t.status.stopped}
          </span>
        </div>
        <span className="text-xs text-[var(--muted)]">
          {version ? `v${version}` : t.status.unknown}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {navItems.map((section) => (
          <div key={section.group} className="mb-1">
            <p className="mb-1 mt-4 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              {section.group}
            </p>
            {section.items.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <TooltipProvider key={item.href} delayDuration={600}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm font-medium transition-all duration-150 mb-0.5",
                          isActive
                            ? "bg-[var(--sidebar-active)] text-[var(--brand-600)] dark:text-[var(--brand-400)]"
                            : "text-[var(--muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-[var(--brand-500)]" : "text-current"
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                        {isActive && (
                          <ChevronRight className="ml-auto h-3 w-3 opacity-40" />
                        )}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom items + language switcher */}
      <div className="shrink-0 px-3 pb-4 border-t border-[var(--sidebar-border)] pt-3">
        {bottomItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm font-medium transition-all duration-150 mb-0.5",
                isActive
                  ? "bg-[var(--sidebar-active)] text-[var(--brand-600)] dark:text-[var(--brand-400)]"
                  : "text-[var(--muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]"
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[var(--brand-500)]" : "text-current")} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Language switcher */}
        <div className="mt-2 flex items-center gap-1 rounded-[10px] bg-[var(--surface-2)] p-1">
          <button
            onClick={() => setLocale('en')}
            className={cn(
              "flex-1 rounded-[8px] py-1 text-xs font-medium transition-all",
              locale === 'en'
                ? "bg-[var(--brand-500)] text-white shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            EN
          </button>
          <button
            onClick={() => setLocale('zh')}
            className={cn(
              "flex-1 rounded-[8px] py-1 text-xs font-medium transition-all",
              locale === 'zh'
                ? "bg-[var(--brand-500)] text-white shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            中文
          </button>
        </div>
      </div>
    </aside>
  );
}
