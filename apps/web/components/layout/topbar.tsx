"use client";
import { Moon, Sun, Bell, RotateCcw } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 bg-[var(--background)]/80 backdrop-blur-md px-6 border-b border-[var(--border)]">
      {/* Title */}
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-base font-semibold text-[var(--foreground)] truncate">{title}</h1>
        {description && (
          <span className="hidden sm:block text-xs text-[var(--muted)] truncate">{description}</span>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        {children}

        {/* System proxy + TUN toggles */}
        <div className="hidden md:flex items-center gap-3 pl-2 border-l border-[var(--border)]">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <span className="text-xs text-[var(--muted)] font-medium">System Proxy</span>
            <Switch className="scale-90" />
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <span className="text-xs text-[var(--muted)] font-medium">Enhanced</span>
            <Switch className="scale-90" />
          </label>
        </div>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="text-[var(--muted)]"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon-sm" className="relative text-[var(--muted)]">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[var(--brand-500)]" />
        </Button>
      </div>
    </header>
  );
}

export { ModeSegment };
