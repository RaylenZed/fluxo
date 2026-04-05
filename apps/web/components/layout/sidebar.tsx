"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Activity, LayoutDashboard, Eye, Cpu, Monitor, GitBranch,
  List, Wifi, Lock, RefreshCw, Puzzle, FileText, Code,
  Settings, Server, ChevronRight, Zap, Globe
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  {
    group: "OVERVIEW",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/activity", label: "Activity", icon: Activity },
      { href: "/overview", label: "Overview", icon: Eye },
    ],
  },
  {
    group: "CLIENT",
    items: [
      { href: "/processes", label: "Processes", icon: Cpu },
      { href: "/devices", label: "Devices", icon: Monitor },
    ],
  },
  {
    group: "PROXY",
    items: [
      { href: "/policies", label: "Policies", icon: GitBranch },
      { href: "/rules", label: "Rules", icon: List },
    ],
  },
  {
    group: "HTTP",
    items: [
      { href: "/capture", label: "Capture", icon: Wifi },
      { href: "/mitm", label: "Decrypt", icon: Lock },
      { href: "/rewrite", label: "Rewrite", icon: RefreshCw },
    ],
  },
  {
    group: "SYSTEM",
    items: [
      { href: "/modules", label: "Modules", icon: Puzzle },
      { href: "/profiles", label: "Profiles", icon: FileText },
      { href: "/scripts", label: "Scripts", icon: Code },
      { href: "/dns", label: "DNS", icon: Globe },
    ],
  },
];

const bottomItems = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/system", label: "System", icon: Server },
];

function MihomoStatusDot({ running = false }: { running?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          running
            ? "bg-emerald-500 animate-pulse-dot"
            : "bg-[var(--muted-foreground)]"
        )}
      />
      <span className={cn("text-xs font-medium", running ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--muted)]")}>
        {running ? "Running" : "Stopped"}
      </span>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[220px] flex-col bg-[var(--sidebar)] border-r border-[var(--sidebar-border)] overflow-hidden shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--brand-500)] shadow-sm">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <span className="text-[15px] font-bold text-[var(--foreground)] tracking-tight">Mihomo</span>
          <span className="text-[15px] font-bold text-[var(--brand-500)] tracking-tight"> Party</span>
        </div>
      </div>

      {/* Mihomo status */}
      <div className="mx-3 mb-3 flex items-center justify-between rounded-[12px] bg-[var(--surface-2)] px-3 py-2.5 border border-[var(--border)]">
        <MihomoStatusDot running={true} />
        <span className="text-xs text-[var(--muted)]">v1.19.0</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
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

      {/* Bottom items */}
      <div className="px-3 pb-4 border-t border-[var(--sidebar-border)] pt-3">
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
      </div>
    </aside>
  );
}
