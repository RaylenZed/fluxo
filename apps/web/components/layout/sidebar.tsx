"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Activity, LayoutDashboard, Eye, Cpu, Monitor, GitBranch,
  List, Info, Database, Package, FileText, CalendarClock,
  Settings, Server, ChevronRight, Zap, Globe, ScrollText, FileCode2, X
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMihomoStatus } from "@/lib/hooks";
import { useLocale } from "@/lib/i18n/context";

interface SidebarProps {
  mobile?: boolean;
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobile = false, open = false, onClose }: SidebarProps) {
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

  const sidebarShell = (
    <aside
      className={cn(
        "flex h-full flex-col overflow-hidden bg-[var(--sidebar)]",
        mobile
          ? "w-[288px] max-w-[calc(100vw-1rem)] rounded-[20px] border border-[var(--sidebar-border)] shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
          : "w-[244px] shrink-0 border-r border-[var(--sidebar-border)] md:rounded-l-[24px]"
      )}
    >
      <div className="hidden gap-2 px-5 pt-4 md:flex">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
      </div>

      {/* Logo */}
      <div className="flex items-center justify-between gap-2.5 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--brand-500)] shadow-[0_5px_14px_rgba(0,122,255,0.30)]">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-[17px] font-bold tracking-tight text-[var(--brand-500)]">Fluxo</span>
          </div>
        </div>
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Mihomo status */}
      <div className="mx-4 mb-5 flex items-center justify-between rounded-[9px] border border-black/5 bg-white/55 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:bg-[var(--surface-2)]">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isRunning ? "bg-emerald-500 animate-pulse-dot" : "bg-[var(--muted-foreground)]"
            )}
          />
          <span className={cn("text-[13px] font-semibold", isRunning ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--muted)]")}>
            {isRunning ? t.status.running : t.status.stopped}
          </span>
        </div>
        <span className="text-[13px] font-medium text-[var(--muted)]">
          {version ? `v${version}` : t.status.unknown}
        </span>
      </div>

      {/* Nav */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        {navItems.map((section) => (
          <div key={section.group} className="mb-2">
            <p className="mb-1 mt-4 px-2 text-[13px] font-semibold tracking-normal text-[var(--muted-foreground)]">
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
                        onClick={mobile ? onClose : undefined}
                        className={cn(
                          "mb-0.5 flex h-10 items-center gap-3 rounded-[8px] px-3 text-[16px] font-semibold tracking-[-0.01em] transition-all duration-150",
                          isActive
                            ? "bg-[var(--sidebar-active)] text-[var(--foreground)]"
                            : "text-[var(--muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0",
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
      <div className="shrink-0 border-t border-[var(--sidebar-border)] px-4 pb-4 pt-3">
        {bottomItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={mobile ? onClose : undefined}
              className={cn(
                "mb-0.5 flex h-10 items-center gap-3 rounded-[8px] px-3 text-[16px] font-semibold tracking-[-0.01em] transition-all duration-150",
                isActive
                  ? "bg-[var(--sidebar-active)] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-[var(--brand-500)]" : "text-current")} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Language switcher */}
        <div className="mt-2 flex items-center gap-1 rounded-[8px] bg-white/45 p-1 dark:bg-[var(--surface-2)]">
          <button
            onClick={() => setLocale('en')}
            className={cn(
              "flex-1 rounded-[6px] py-1 text-xs font-semibold transition-all",
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
              "flex-1 rounded-[6px] py-1 text-xs font-semibold transition-all",
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

  if (!mobile) {
    return sidebarShell;
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/45 transition-opacity duration-200 md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={cn(
          "fixed inset-y-2 left-2 z-40 transition-transform duration-200 ease-out md:hidden",
          open ? "translate-x-0" : "-translate-x-[115%]"
        )}
      >
        {sidebarShell}
      </div>
    </>
  );
}
