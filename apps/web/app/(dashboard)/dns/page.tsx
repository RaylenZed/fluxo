import { Topbar } from "@/components/layout/topbar";

export default function Page() {
  const name = "dns";
  return (
    <div className="flex flex-col h-full">
      <Topbar title={name.charAt(0).toUpperCase() + name.slice(1)} />
      <div className="flex-1 flex items-center justify-center text-[var(--muted)]">
        <div className="text-center">
          <p className="text-4xl mb-2">🚧</p>
          <p className="text-sm font-medium capitalize">{name} — coming soon</p>
        </div>
      </div>
    </div>
  );
}
