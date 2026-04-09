"use client";
import { Moon, Sun, Bell, Search, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/context";

function useTunState() {
  const qc = useQueryClient();
  const { data: tunEnabled = false } = useQuery({
    queryKey: ["tun-state"],
    queryFn: async () => {
      const r = await fetch(`/api/settings`);
      if (!r.ok) return false;
      const d = await r.json();
      return d['tun.enable'] === true || d['tun.enable'] === 'true';
    },
    staleTime: 30_000,
  });
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
  return { tunEnabled, toggle: toggle.mutate };
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
    <div className="flex items-center gap-0.5 rounded-[10px] bg-[var(--surface-2)] p-0.5 border border-[var(--border)]">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-[8px] px-3 py-1 text-xs font-semibold transition-all duration-150",
            value === opt.value
              ? "bg-[var(--brand-500)] text-white shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Topbar({ title, description, children }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();
  const { tunEnabled, toggle } = useTunState();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 bg-[var(--background)]/90 backdrop-blur-md px-5 border-b border-[var(--border)]">
      {/* Page title */}
      <div className="flex items-center gap-2 min-w-[140px] shrink-0">
        <h1 className="text-[15px] font-bold text-[var(--foreground)] truncate">{title}</h1>
        {description && (
          <span className="hidden lg:block text-xs text-[var(--muted)] truncate">{description}</span>
        )}
      </div>

      {/* Search bar — center, flex-1 */}
      <div className="flex-1 mx-2 hidden sm:block">
        <div className="flex items-center gap-2.5 h-10 rounded-full bg-[var(--surface-2)] border border-[var(--border)] px-4 max-w-[480px] mx-auto">
          <Search className="h-3.5 w-3.5 text-[var(--muted-foreground)] shrink-0" />
          <input
            type="text"
            placeholder={t.topbar.searchPlaceholder}
            className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none"
            readOnly
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
        {children}

        {/* TUN toggle */}
        <div className="hidden md:flex items-center gap-2 pr-2 border-r border-[var(--border)]">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <span className="text-xs text-[var(--muted)] font-medium">{t.topbar.enhanced}</span>
            <Switch
              className="scale-90"
              checked={tunEnabled}
              onCheckedChange={(v) => toggle(v)}
            />
          </label>
        </div>

        {/* Theme toggle — circular */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-all"
          aria-label={t.topbar.toggleTheme}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </button>

        {/* Notifications — circular */}
        <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-all">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[var(--brand-500)] border-2 border-[var(--surface)]" />
        </button>

        {/* User profile chip */}
        <div className="flex items-center gap-2 h-10 rounded-full border border-[var(--border)] bg-[var(--surface)] pl-1.5 pr-3 ml-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-500)] shrink-0">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-[var(--foreground)] hidden sm:block">Admin</span>
        </div>
      </div>
    </header>
  );
}

export { ModeSegment };
