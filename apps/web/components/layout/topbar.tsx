"use client";
import { Moon, Sun, Bell, Search, Zap, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/context";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useDesktopMode } from "@/lib/desktop";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TunStatus = {
  desired: boolean;
  active: boolean;
  status: "active" | "mismatch" | "disabled" | "unknown";
  applyMode: "manual" | "managed";
};

function useTunState(enabled: boolean) {
  const qc = useQueryClient();
  const { data: tunStatus } = useQuery<TunStatus>({
    queryKey: ["tun-state"],
    queryFn: async () => {
      const modeRes = await fetch(`/api/config/mode`);
      const mode = modeRes.ok ? await modeRes.json() as { mode?: "manual" | "managed" } : null;
      const applyMode = mode?.mode ?? "manual";
      const r = await fetch(`/api/mihomo/tun/status`);
      if (r.ok) {
        const status = await r.json();
        return { ...status, applyMode };
      }

      const settingsRes = await fetch(`/api/settings`);
      if (!settingsRes.ok) return { desired: false, active: false, status: "unknown" as const, applyMode };
      const settings = await settingsRes.json();
      const desired = settings['tun.enable'] === true || settings['tun.enable'] === 'true';
      return { desired, active: false, status: "unknown" as const, applyMode };
    },
    enabled,
    staleTime: 30_000,
  });
  const tunEnabled = tunStatus?.desired ?? false;
  const toggle = useMutation({
    mutationFn: async (enable: boolean) => {
      const res = await fetch(`/api/mihomo/tun`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable }),
      });
      if (!res.ok) throw new Error('Failed to toggle TUN');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tun-state"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "info"] });
    },
  });
  return { tunEnabled, tunStatus, toggle: toggle.mutate };
}

interface TopbarProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

function ModeSegment({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-black/5 bg-[#e3e3e6] p-0.5 shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)] dark:bg-[var(--surface-2)]">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-full px-5 py-1.5 text-[13px] font-bold transition-all duration-150",
            value === opt.value
              ? "bg-[var(--brand-500)] text-white shadow-[0_1px_2px_rgba(0,0,0,0.16)]"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function UserMenu() {
  const { t } = useLocale();
  const router = useRouter();

  async function handleLogout() {
    try { await authApi.logout(); } catch { /* ignore */ }
    router.push('/login');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ml-1 flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] pl-1.5 pr-3 outline-none transition-colors hover:bg-[var(--surface-2)]">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-500)] shrink-0">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-[var(--foreground)] hidden sm:block">Admin</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-[var(--foreground)] gap-2">
          <LogOut className="h-3.5 w-3.5" />
          {t.topbar.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar({ title, description, children }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();
  const desktopMode = useDesktopMode();
  const { tunEnabled, tunStatus, toggle } = useTunState(!desktopMode);
  const tunMismatch = tunStatus?.desired && !tunStatus.active;
  const showTunSwitch = !desktopMode && tunStatus?.applyMode === "managed";

  return (
    <header className="sticky top-0 z-10 flex min-h-[86px] items-start gap-5 border-b border-black/5 bg-[var(--background)]/92 px-7 pb-4 pt-6 backdrop-blur-md">
      {/* Page title */}
      <div className="flex min-w-[190px] shrink-0 flex-col pl-12 md:pl-0">
        <h1 className="truncate text-[34px] font-black leading-none tracking-[-0.02em] text-[var(--foreground)]">{title}</h1>
        {description && (
          <span className="mt-2 hidden truncate text-[14px] font-medium text-[var(--muted)] lg:block">{description}</span>
        )}
      </div>

      {/* Search bar — center, flex-1 */}
      <div className="mx-2 hidden flex-1 sm:block">
        <div className="mx-auto flex h-11 max-w-[560px] items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
          <Search className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder={t.topbar.searchPlaceholder}
            className="flex-1 bg-transparent text-[15px] font-medium text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
            readOnly
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2 sm:ml-0">
        {children}

        {/* TUN toggle */}
        {showTunSwitch && <div className="hidden items-center gap-2 border-r border-[var(--border)] pr-2 md:flex">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <span
              className={cn("text-xs font-medium", tunMismatch ? "text-amber-600 dark:text-amber-400" : "text-[var(--muted)]")}
              title={tunMismatch ? "TUN is enabled in settings, but the Meta interface is not active." : undefined}
            >
              {t.topbar.enhanced}
            </span>
            <Switch
              className="scale-90"
              checked={tunEnabled}
              onCheckedChange={(v) => toggle(v)}
            />
          </label>
        </div>}

        {/* Theme toggle — circular */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-all hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          aria-label={t.topbar.toggleTheme}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </button>

        {/* Notifications — circular */}
        {!desktopMode && <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-all hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[var(--brand-500)] border-2 border-[var(--surface)]" />
        </button>}

        {/* User profile chip with logout dropdown */}
        {!desktopMode && <UserMenu />}
      </div>
    </header>
  );
}

export { ModeSegment };
