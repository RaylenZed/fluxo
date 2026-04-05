"use client";
import { useState } from "react";
import { Plus, MoreHorizontal, Zap, ChevronDown, Clock, RotateCcw, Network } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Topbar, ModeSegment } from "@/components/layout/topbar";
import { cn, getLatencyBg } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProxyGroupDialog } from "@/components/policy/proxy-group-dialog";

// Mock data
const proxyNodes = [
  { name: "US OwO", type: "hysteria2", latency: 78, flag: "🇺🇸" },
  { name: "KR ORACLE", type: "vmess", latency: 45, flag: "🇰🇷" },
  { name: "JP TYO GREEN", type: "ss", latency: 62, flag: "🇯🇵" },
  { name: "JP RFC", type: "ss", latency: 88, flag: "🇯🇵" },
];

const proxyGroups = [
  { name: "Proxy", type: "select" as const, selected: "US OwO", flag: "🇺🇸", latency: 78 },
  { name: "PayPal", type: "select" as const, selected: "DIRECT", flag: null, latency: 0 },
  { name: "Twitter", type: "url-test" as const, selected: "JP RFC", flag: "🇯🇵", latency: 88 },
  { name: "YouTube", type: "select" as const, selected: "US OwO", flag: "🇺🇸", latency: 78 },
  { name: "OpenAI", type: "select" as const, selected: "US OwO", flag: "🇺🇸", latency: 78 },
  { name: "Claude", type: "select" as const, selected: "US OwO", flag: "🇺🇸", latency: 78 },
  { name: "Gemini", type: "select" as const, selected: "US OwO", flag: "🇺🇸", latency: 78 },
  { name: "Steam", type: "select" as const, selected: "US OwO", flag: "🇺🇸", latency: 78 },
  { name: "Github", type: "select" as const, selected: "US OwO", flag: "🇺🇸", latency: 78 },
  { name: "Google", type: "url-test" as const, selected: "US OwO", flag: "🇺🇸", latency: 78 },
  { name: "WeChat", type: "select" as const, selected: "DIRECT", flag: null, latency: 0 },
  { name: "Speedtest", type: "select" as const, selected: "KR ORACLE", flag: "🇰🇷", latency: 45 },
  { name: "Telegram", type: "select" as const, selected: "US OwO", flag: "🇺🇸", latency: 78 },
  { name: "Dropbox", type: "select" as const, selected: "US OwO", flag: "🇺🇸", latency: 78 },
  { name: "Spotify", type: "select" as const, selected: "DIRECT", flag: null, latency: 0 },
  { name: "Oracle", type: "select" as const, selected: "DIRECT", flag: null, latency: 0 },
  { name: "Amazon", type: "select" as const, selected: "US OwO", flag: "🇺🇸", latency: 78 },
  { name: "Final", type: "select" as const, selected: "US OwO", flag: "🇺🇸", latency: 78 },
  { name: "All Server", type: "url-test" as const, selected: "US OwO", flag: "🇺🇸", latency: 78 },
];

const groupTypeIcons = {
  select: MoreHorizontal,
  "url-test": Zap,
  fallback: RotateCcw,
  "load-balance": Network,
};

const groupTypeLabels = {
  select: "Select",
  "url-test": "Auto",
  fallback: "Fallback",
  "load-balance": "Load Bal.",
};

function NodeCard({ node, selected, onClick }: {
  node: { name: string; type: string; latency: number; flag: string };
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-[12px] p-3 border transition-all duration-150",
        selected
          ? "border-[var(--brand-500)] bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/10"
          : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--brand-300)] hover:bg-[var(--surface)]"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          {node.type}
        </span>
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-500)]" />}
      </div>
      <p className="text-sm font-semibold text-[var(--foreground)] truncate">{node.flag} {node.name}</p>
      <span className={cn("mt-2 inline-block text-[11px] font-semibold rounded-[5px] px-1.5 py-0.5", getLatencyBg(node.latency))}>
        {node.latency}ms
      </span>
    </button>
  );
}

function GroupCard({ group, onEdit }: {
  group: typeof proxyGroups[0];
  onEdit: () => void;
}) {
  const [showNodes, setShowNodes] = useState(false);
  const TypeIcon = groupTypeIcons[group.type];

  return (
    <Card className="p-3 hover:shadow-lg transition-all duration-200 group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <TypeIcon className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
          <span className="text-[10px] text-[var(--muted)] font-medium">{groupTypeLabels[group.type]}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 h-6 w-6 text-[var(--muted)]">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>Edit Group</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuItem>Latency Test</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">Delete Group</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="text-sm font-bold text-[var(--foreground)] mb-2 truncate">{group.name}</p>

      <button
        onClick={() => setShowNodes(!showNodes)}
        className={cn(
          "flex items-center gap-1.5 text-xs font-semibold rounded-[8px] px-2 py-1 transition-all duration-150 w-full",
          group.selected === "DIRECT"
            ? "bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--border)]"
            : "bg-[var(--brand-50)] text-[var(--brand-600)] dark:bg-[var(--brand-500)]/20 dark:text-[var(--brand-300)]"
        )}
      >
        {group.flag && <span>{group.flag}</span>}
        <span className="flex-1 text-left truncate">{group.selected}</span>
        {group.latency > 0 && (
          <span className={cn("text-[10px]", getLatencyBg(group.latency), "rounded px-1 py-0.5")}>
            {group.latency}ms
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", showNodes && "rotate-180")} />
      </button>

      {showNodes && (
        <div className="mt-2 grid grid-cols-1 gap-1.5">
          <NodeCard
            node={{ name: "DIRECT", type: "builtin", latency: 0, flag: "" }}
            selected={group.selected === "DIRECT"}
            onClick={() => {}}
          />
          {proxyNodes.map((node) => (
            <NodeCard
              key={node.name}
              node={node}
              selected={group.selected === node.name}
              onClick={() => {}}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function PoliciesPage() {
  const [outboundMode, setOutboundMode] = useState("rule");
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [showNewGroup, setShowNewGroup] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Policies" description="Manage proxy nodes and policy groups">
        <ModeSegment
          value={outboundMode}
          onChange={setOutboundMode}
          options={[
            { label: "Direct", value: "direct" },
            { label: "Global", value: "global" },
            { label: "Rules", value: "rule" },
          ]}
        />
        <Button size="sm" onClick={() => setShowNewGroup(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Group
        </Button>
      </Topbar>

      <div className="flex-1 p-6 overflow-auto space-y-6">
        {/* Proxy Nodes */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-500)] mb-3 flex items-center gap-2">
            <span className="h-px flex-1 bg-[var(--border)]" />
            Proxy Nodes
            <span className="h-px flex-1 bg-[var(--border)]" />
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {proxyNodes.map((node) => (
              <Card key={node.name} className="p-3 hover:shadow-lg transition-all group cursor-pointer">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">{node.type}</div>
                <p className="text-sm font-bold text-[var(--foreground)] truncate">{node.flag} {node.name}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className={cn("text-[11px] font-semibold rounded-[5px] px-1.5 py-0.5", getLatencyBg(node.latency))}>
                    {node.latency}ms
                  </span>
                  <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 h-5 w-5">
                    <Zap className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))}
            <button
              className="flex flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-[var(--border)] p-3 text-[var(--muted)] hover:border-[var(--brand-400)] hover:text-[var(--brand-500)] transition-all min-h-[80px]"
              onClick={() => {}}
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs mt-1">Add Node</span>
            </button>
          </div>
        </section>

        {/* Policy Groups */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-3 flex items-center gap-2">
            <span className="h-px flex-1 bg-[var(--border)]" />
            Policy Groups ({proxyGroups.length})
            <span className="h-px flex-1 bg-[var(--border)]" />
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {proxyGroups.map((group) => (
              <GroupCard
                key={group.name}
                group={group}
                onEdit={() => setEditingGroup(group.name)}
              />
            ))}
            <button
              className="flex flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-[var(--border)] p-3 text-[var(--muted)] hover:border-[var(--brand-400)] hover:text-[var(--brand-500)] transition-all min-h-[100px]"
              onClick={() => setShowNewGroup(true)}
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs mt-1">Add Group</span>
            </button>
          </div>
        </section>
      </div>

      <ProxyGroupDialog
        open={showNewGroup || editingGroup !== null}
        onClose={() => { setShowNewGroup(false); setEditingGroup(null); }}
        groupName={editingGroup ?? undefined}
      />
    </div>
  );
}
