import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen items-stretch p-3 bg-[var(--canvas)]">
      {/* Floating island container */}
      <div className="flex flex-1 overflow-hidden rounded-[24px] bg-[var(--background)] shadow-[0_4px_32px_rgba(0,0,0,0.10),0_1px_6px_rgba(0,0,0,0.06)]">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
