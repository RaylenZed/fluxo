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
    <div className="flex h-dvh items-stretch bg-[var(--canvas)] p-2 sm:p-3">
      {/* Floating island container */}
      <div className="relative flex flex-1 overflow-hidden rounded-[20px] bg-[var(--background)] shadow-[0_4px_32px_rgba(0,0,0,0.10),0_1px_6px_rgba(0,0,0,0.06)] sm:rounded-[24px]">
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

        <main className="min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
