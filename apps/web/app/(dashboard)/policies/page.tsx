"use client";
import { useState } from "react";
import { Plus, MoreHorizontal, Zap, ChevronDown, Clock, RotateCcw, Network, ServerCrash, Check, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Topbar, ModeSegment } from "@/components/layout/topbar";
import { cn, getLatencyBg } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProxyGroupDialog } from "@/components/policy/proxy-group-dialog";
import { ProxyNodeDialog } from "@/components/proxy/proxy-node-dialog";
import {
  useProxies,
  useGroups,
  useCreateProxy,
  useUpdateProxy,
  useDeleteProxy,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useApplyConfig,
} from "@/lib/hooks";
import type { ProxyRow, GroupRow } from "@/lib/api";
import { toast } from "sonner";
import { useLocale } from "@/lib/i18n/context";

// ─── Constants ────────────────────────────────────────────────────────────────
const groupTypeIcons = {
  select: MoreHorizontal,
  "url-test": Zap,
  fallback: RotateCcw,
  "load-balance": Network,
} as const;

// ─── NodeCard ─────────────────────────────────────────────────────────────────
function NodeCard({
  node,
  selected,
  onClick,
}: {
  node: { name: string; type: string; latency: number };
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
      <p className="text-sm font-semibold text-[var(--foreground)] truncate">{node.name}</p>
      {node.latency > 0 ? (
        <span className={cn("mt-2 inline-block text-[11px] font-semibold rounded-[5px] px-1.5 py-0.5", getLatencyBg(node.latency))}>
          {node.latency}ms
        </span>
      ) : (
        <span className="mt-2 inline-block text-[11px] font-semibold rounded-[5px] px-1.5 py-0.5 text-[var(--muted)]">
          —
        </span>
      )}
    </button>
  );
}

// ─── GroupCard ────────────────────────────────────────────────────────────────
function GroupCard({
  group,
  proxyNodes,
  onEdit,
  onDelete,
  onLatencyTest,
}: {
  group: GroupRow;
  proxyNodes: ProxyRow[];
  onEdit: () => void;
  onDelete: () => void;
  onLatencyTest: () => void;
}) {
  const [showNodes, setShowNodes] = useState(false);
  const { t } = useLocale();

  const groupTypeLabels = {
    select: t.policies.typeSelect,
    "url-test": t.policies.typeAuto,
    fallback: t.policies.typeFallback,
    "load-balance": t.policies.typeLoadBalance,
  } as const;

  const groupType = group.type as keyof typeof groupTypeIcons;
  const TypeIcon = groupTypeIcons[groupType] ?? MoreHorizontal;
  const typeLabel = groupTypeLabels[groupType] ?? group.type;

  let parsedProxies: string[] = [];
  try {
    parsedProxies = JSON.parse(group.proxies ?? "[]");
  } catch {
    parsedProxies = [];
  }

  // Local selected state — updated optimistically when user picks a node.
  // Initialized from first available proxy; reflects runtime selection immediately.
  const [selectedProxy, setSelectedProxy] = useState(parsedProxies[0] ?? "DIRECT");

  const selectedNode = proxyNodes.find((n) => n.name === selectedProxy);
  let selectedLatency = 0;
  if (selectedNode) {
    try {
      const cfg = JSON.parse(selectedNode.config ?? "{}") as Record<string, unknown>;
      if (typeof cfg.latency === "number") selectedLatency = cfg.latency;
    } catch {
      selectedLatency = 0;
    }
  }

  async function switchProxy(name: string) {
    const prev = selectedProxy;
    setSelectedProxy(name); // optimistic
    const res = await fetch(`/api/mihomo/proxies/${encodeURIComponent(group.name)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      setSelectedProxy(prev);
      toast.error(t.policies.switchFailed);
    }
  }

  return (
    <Card className="p-3 hover:shadow-lg transition-all duration-200 group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <TypeIcon className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
          <span className="text-[10px] text-[var(--muted)] font-medium">{typeLabel}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 h-6 w-6 text-[var(--muted)]">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>{t.policies.editGroup}</DropdownMenuItem>
            <DropdownMenuItem onClick={onLatencyTest}>{t.policies.latencyTest}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={onDelete}>{t.policies.deleteGroup}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="text-sm font-bold text-[var(--foreground)] mb-2 truncate">{group.name}</p>

      <button
        onClick={() => setShowNodes(!showNodes)}
        className={cn(
          "flex items-center gap-1.5 text-xs font-semibold rounded-[8px] px-2 py-1 transition-all duration-150 w-full",
          selectedProxy === "DIRECT"
            ? "bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--border)]"
            : "bg-[var(--brand-50)] text-[var(--brand-600)] dark:bg-[var(--brand-500)]/20 dark:text-[var(--brand-300)]"
        )}
      >
        <span className="flex-1 text-left truncate">{selectedProxy}</span>
        {selectedLatency > 0 && (
          <span className={cn("text-[10px]", getLatencyBg(selectedLatency), "rounded px-1 py-0.5")}>
            {selectedLatency}ms
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", showNodes && "rotate-180")} />
      </button>

      {showNodes && (
        <div className="mt-2 grid grid-cols-1 gap-1.5">
          <NodeCard
            node={{ name: "DIRECT", type: "builtin", latency: 0 }}
            selected={selectedProxy === "DIRECT"}
            onClick={() => void switchProxy("DIRECT")}
          />
          {proxyNodes.map((node) => {
            let latency = 0;
            try {
              const cfg = JSON.parse(node.config ?? "{}") as Record<string, unknown>;
              if (typeof cfg.latency === "number") latency = cfg.latency;
            } catch {
              latency = 0;
            }
            return (
              <NodeCard
                key={node.id}
                node={{ name: node.name, type: node.type, latency }}
                selected={selectedProxy === node.name}
                onClick={() => void switchProxy(node.name)}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function NodeSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-3 h-[90px] animate-pulse bg-[var(--surface-2)]" />
      ))}
    </div>
  );
}

function GroupSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="p-3 h-[110px] animate-pulse bg-[var(--surface-2)]" />
      ))}
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────
function ApiError() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-[var(--muted)]">
      <ServerCrash className="h-10 w-10 mb-3 opacity-40" />
      <p className="text-sm font-medium">{t.policies.cannotReachApi}</p>
      <p className="text-xs mt-1">{t.policies.makeBackendRunning}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PoliciesPage() {
  const [outboundMode, setOutboundMode] = useState("rule");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const { t } = useLocale();

  async function switchMode(mode: string) {
    setOutboundMode(mode);
    try {
      await fetch("/api/mihomo/mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
    } catch { /* ignore if mihomo unreachable */ }
  }

  async function testNodeLatency(name: string) {
    try {
      const res = await fetch("/api/mihomo/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json() as { delay?: number };
        toast.success(`${name}: ${data.delay ?? "?"}ms`);
      } else {
        toast.error(`${name}: timeout`);
      }
    } catch {
      toast.error(`${name}: unreachable`);
    }
  }

  const proxiesQuery = useProxies();
  const groupsQuery = useGroups();
  const createProxy = useCreateProxy();
  const deleteProxy = useDeleteProxy();
  const updateProxy = useUpdateProxy();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const applyConfig = useApplyConfig();

  const proxyNodes = proxiesQuery.data ?? [];
  const proxyGroups = groupsQuery.data ?? [];

  const editingGroup = proxyGroups.find((g) => g.id === editingGroupId) ?? null;

  return (
    <div className="flex flex-col h-full">
      <Topbar title={t.policies.title} description={`${proxyNodes.length} nodes · ${proxyGroups.length} groups`}>
        <ModeSegment
          value={outboundMode}
          onChange={switchMode}
          options={[
            { label: t.topbar.direct, value: "direct" },
            { label: t.topbar.global, value: "global" },
            { label: t.topbar.rules, value: "rule" },
          ]}
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => applyConfig.mutate()}
          disabled={applyConfig.isPending}
          className="gap-1.5"
        >
          {applyConfig.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Check className="h-3.5 w-3.5" />}
          {t.topbar.applyConfig}
        </Button>
        <Button size="sm" onClick={() => setShowNewGroup(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {t.policies.addGroup}
        </Button>
      </Topbar>

      <div className="flex-1 p-6 overflow-auto space-y-6">
        {/* Proxy Nodes */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-500)] mb-3 flex items-center gap-2">
            <span className="h-px flex-1 bg-[var(--border)]" />
            {t.policies.proxyNodes} ({proxyNodes.length})
            <span className="h-px flex-1 bg-[var(--border)]" />
          </h2>

          {proxiesQuery.isLoading ? (
            <NodeSkeleton />
          ) : proxiesQuery.isError ? (
            <ApiError />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {proxyNodes.map((node) => {
                let latency = 0;
                try {
                  const cfg = JSON.parse(node.config ?? "{}") as Record<string, unknown>;
                  if (typeof cfg.latency === "number") latency = cfg.latency;
                } catch {
                  latency = 0;
                }
                return (
                  <Card key={node.id} className="p-3 hover:shadow-lg transition-all group cursor-pointer">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">{node.type}</div>
                    <p className="text-sm font-bold text-[var(--foreground)] truncate">{node.name}</p>
                    <div className="mt-2 flex items-center justify-between">
                      {latency > 0 ? (
                        <span className={cn("text-[11px] font-semibold rounded-[5px] px-1.5 py-0.5", getLatencyBg(latency))}>
                          {latency}ms
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold rounded-[5px] px-1.5 py-0.5 text-[var(--muted)]">—</span>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 h-5 w-5">
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onClick={() => setEditingNodeId(node.id)}>{t.policies.editNode}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => testNodeLatency(node.name)}>{t.policies.latencyTest}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => deleteProxy.mutate(node.id)}
                          >
                            {t.policies.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                );
              })}
              <button
                className="flex flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-[var(--border)] p-3 text-[var(--muted)] hover:border-[var(--brand-400)] hover:text-[var(--brand-500)] transition-all min-h-[80px]"
                onClick={() => setShowAddNode(true)}
              >
                <Plus className="h-5 w-5" />
                <span className="text-xs mt-1">{t.policies.addNode}</span>
              </button>
            </div>
          )}
        </section>

        {/* Policy Groups */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-3 flex items-center gap-2">
            <span className="h-px flex-1 bg-[var(--border)]" />
            {t.policies.policyGroups} ({proxyGroups.length})
            <span className="h-px flex-1 bg-[var(--border)]" />
          </h2>

          {groupsQuery.isLoading ? (
            <GroupSkeleton />
          ) : groupsQuery.isError ? (
            <ApiError />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {proxyGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  proxyNodes={proxyNodes}
                  onEdit={() => setEditingGroupId(group.id)}
                  onDelete={() => deleteGroup.mutate(group.id)}
                  onLatencyTest={() => testNodeLatency(group.name)}
                />
              ))}
              <button
                className="flex flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-[var(--border)] p-3 text-[var(--muted)] hover:border-[var(--brand-400)] hover:text-[var(--brand-500)] transition-all min-h-[100px]"
                onClick={() => setShowNewGroup(true)}
              >
                <Plus className="h-5 w-5" />
                <span className="text-xs mt-1">{t.policies.addGroup}</span>
              </button>
            </div>
          )}
        </section>
      </div>

      <ProxyGroupDialog
        key={editingGroupId ?? "new-group"}
        open={showNewGroup || editingGroupId !== null}
        onClose={() => { setShowNewGroup(false); setEditingGroupId(null); }}
        groupName={editingGroup?.name ?? undefined}
        editGroup={editingGroup ?? undefined}
        onSave={(data) => {
          if (editingGroupId) {
            updateGroup.mutate({ id: editingGroupId, data }, {
              onSuccess: () => { setShowNewGroup(false); setEditingGroupId(null); },
            });
          } else {
            createGroup.mutate(data, {
              onSuccess: () => { setShowNewGroup(false); setEditingGroupId(null); },
            });
          }
        }}
      />
      <ProxyNodeDialog
        open={showAddNode}
        onClose={() => setShowAddNode(false)}
        onSave={(data) => createProxy.mutate(data, { onSuccess: () => setShowAddNode(false) })}
      />
      <ProxyNodeDialog
        key={editingNodeId ?? "new-node"}
        open={editingNodeId !== null}
        onClose={() => setEditingNodeId(null)}
        editNode={proxyNodes.find((n) => n.id === editingNodeId)}
        onSave={(data) => {
          if (editingNodeId) updateProxy.mutate({ id: editingNodeId, data }, { onSuccess: () => setEditingNodeId(null) });
        }}
      />
    </div>
  );
}
