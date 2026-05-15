"use client";

import { useState } from "react";
import { PanelLeft } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-dvh items-stretch bg-[var(--canvas)] p-0 md:p-3">
      <div className="relative flex flex-1 overflow-hidden bg-[var(--background)] shadow-[0_18px_60px_rgba(24,32,48,0.20),0_1px_4px_rgba(24,32,48,0.10)] md:rounded-[24px]">
        <button
          type="button"
          className="absolute left-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] shadow-sm transition-all hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] md:hidden"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open navigation"
        >
          <PanelLeft className="h-4 w-4" />
        </button>

        <div className="hidden md:flex">
          <Sidebar />
        </div>
        <Sidebar
          mobile
          open={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />

        <main className="min-w-0 flex-1 overflow-y-auto bg-[var(--background)]">
          {children}
        </main>
      </div>
    </div>
  );
}
