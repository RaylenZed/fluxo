"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  useMihomoProxies,
} from "@/lib/hooks";
import { proxiesApi, type ProxyRow, type GroupRow, type MihomoProxyState } from "@/lib/api";
import { toast } from "sonner";
import { useLocale } from "@/lib/i18n/context";

// ─── Constants ────────────────────────────────────────────────────────────────
const groupTypeIcons = {
  select: MoreHorizontal,
  "url-test": Zap,
  fallback: RotateCcw,
  "load-balance": Network,
} as const;

const BUILTIN_PROXY_NAMES = new Set(["DIRECT", "REJECT"]);

function isBuiltinProxy(name: string) {
  return BUILTIN_PROXY_NAMES.has(name);
}

function parseProxyConfig(config: string): Record<string, unknown> {
  try {
    return JSON.parse(config ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readProxyLatency(config: string): number {
  const parsed = parseProxyConfig(config);
  return typeof parsed.latency === "number" ? parsed.latency : 0;
}

function parseGroupProxyNames(group: GroupRow): string[] {
  try {
    const parsed = JSON.parse(group.proxies ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function parseGroupProviderNames(group: GroupRow): string[] {
  try {
    const parsed = JSON.parse(group.providers ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function getOrderedGroupProxyNames(group: GroupRow, proxyNodes: ProxyRow[]): string[] {
  const orderedNames = [...parseGroupProxyNames(group)];

  if (group.use_all_proxies) {
    for (const node of proxyNodes) {
      if (!orderedNames.includes(node.name)) orderedNames.push(node.name);
    }
  }

  return orderedNames;
}

function getRuntimeGroupChoices(runtimeGroup: MihomoProxyState | null | undefined): string[] {
  if (!Array.isArray(runtimeGroup?.all)) return [];
  return runtimeGroup.all.filter((value): value is string => typeof value === "string");
}

function groupChoicesMatch(group: GroupRow, proxyNodes: ProxyRow[], runtimeGroup: MihomoProxyState | null | undefined) {
  if (!runtimeGroup) return false;

  const expectedChoices = getOrderedGroupProxyNames(group, proxyNodes);
  const runtimeChoices = getRuntimeGroupChoices(runtimeGroup);
  const hasProviderMembers = parseGroupProviderNames(group).length > 0;
  if (hasProviderMembers) {
    return runtimeChoices.length > 0 && expectedChoices.every((proxyName) => runtimeChoices.includes(proxyName));
  }

  const expectedChoiceSet = new Set(expectedChoices);

  return runtimeChoices.length === expectedChoices.length
    && runtimeChoices.every((proxyName) => expectedChoiceSet.has(proxyName));
}

// ─── NodeCard ─────────────────────────────────────────────────────────────────
function NodeCard({
  node,
  selected,
  disabled,
  pendingLabel,
  onClick,
}: {
  node: { name: string; type: string; latency: number; loadedInRuntime: boolean };
  selected: boolean;
  disabled: boolean;
  pendingLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full rounded-[12px] border p-3 text-left transition-all duration-150",
        selected
          ? "border-[var(--brand-500)] bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/10"
          : disabled
            ? "cursor-not-allowed border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
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
      {!node.loadedInRuntime ? (
        <span className="mt-2 inline-block rounded-[5px] bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
          {pendingLabel}
        </span>
      ) : node.latency > 0 ? (
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
  runtimeProxyMap,
  runtimeReady,
  onEdit,
  onDelete,
  onLatencyTest,
}: {
  group: GroupRow;
  proxyNodes: ProxyRow[];
  runtimeProxyMap: Record<string, MihomoProxyState> | null;
  runtimeReady: boolean;
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
  const runtimeLoadedNames = runtimeProxyMap ? new Set(Object.keys(runtimeProxyMap)) : null;
  const runtimeGroup = runtimeProxyMap?.[group.name];
  const runtimeGroupChoices = getRuntimeGroupChoices(runtimeGroup);
  const runtimeGroupChoiceSet = new Set(runtimeGroupChoices);
  const runtimeSelectedProxy = typeof runtimeGroup?.now === "string" ? runtimeGroup.now : null;
  const providerNames = parseGroupProviderNames(group);
  const hasProviderMembers = providerNames.length > 0;

  const displayedNodes = (() => {
    const localNodes = getOrderedGroupProxyNames(group, proxyNodes)
      .map((name) => {
        const loadedInRuntime = runtimeLoadedNames
          ? Boolean(runtimeGroup) && runtimeLoadedNames.has(name) && (runtimeGroupChoiceSet.size === 0 || runtimeGroupChoiceSet.has(name))
          : true;

        if (isBuiltinProxy(name)) {
          return { name, type: "builtin", latency: 0, loadedInRuntime };
        }

        const node = proxyNodes.find((candidate) => candidate.name === name);
        if (!node) return null;

        return {
          name: node.name,
          type: node.type,
          latency: readProxyLatency(node.config),
          loadedInRuntime,
        };
      })
      .filter((node): node is { name: string; type: string; latency: number; loadedInRuntime: boolean } => node !== null);

    if (!hasProviderMembers) {
      return localNodes;
    }

    const displayedNames = new Set(localNodes.map((node) => node.name));
    if (runtimeGroupChoices.length === 0) {
      const providerPlaceholders = providerNames
        .filter((name) => !displayedNames.has(name))
        .map((name) => ({
          name,
          type: "provider",
          latency: 0,
          loadedInRuntime: false,
        }));
      return [...localNodes, ...providerPlaceholders];
    }

    const providerNodes = runtimeGroupChoices
      .filter((name) => !displayedNames.has(name))
      .map((name) => ({
        name,
        type: runtimeProxyMap?.[name]?.type ?? "provider",
        latency: 0,
        loadedInRuntime: true,
      }));

    return [...localNodes, ...providerNodes];
  })();

  const fallbackSelectedProxy = displayedNodes.find((node) => node.loadedInRuntime)?.name
    ?? displayedNodes[0]?.name
    ?? "DIRECT";
  const runtimeSelectionStillLoaded = Boolean(
    runtimeSelectedProxy && (isBuiltinProxy(runtimeSelectedProxy) || runtimeLoadedNames?.has(runtimeSelectedProxy))
  );
  const runtimeSelectionMissingFromDisplay = Boolean(
    runtimeSelectedProxy && !isBuiltinProxy(runtimeSelectedProxy) && !displayedNodes.some((node) => node.name === runtimeSelectedProxy)
  );
  const hasPendingRuntimeChanges = runtimeLoadedNames !== null && (
    !groupChoicesMatch(group, proxyNodes, runtimeGroup)
    || runtimeSelectionMissingFromDisplay
  );

  const [optimisticProxy, setOptimisticProxy] = useState<string | null>(null);
  const optimisticProxyStillDisplayed = Boolean(
    optimisticProxy && displayedNodes.some((node) => node.name === optimisticProxy)
  );
  const selectedProxy = optimisticProxy && optimisticProxy !== runtimeSelectedProxy && optimisticProxyStillDisplayed
    ? optimisticProxy
    : runtimeSelectedProxy && runtimeSelectionStillLoaded
      ? runtimeSelectedProxy
      : fallbackSelectedProxy;

  const selectedNode = proxyNodes.find((n) => n.name === selectedProxy);
  const selectedLatency = selectedNode ? readProxyLatency(selectedNode.config) : 0;

  function canUseRuntimeNode(name: string) {
    if (!runtimeReady) return false;
    if (!runtimeLoadedNames) return true;
    if (!runtimeGroup) return false;
    return runtimeLoadedNames.has(name) && (runtimeGroupChoiceSet.size === 0 || runtimeGroupChoiceSet.has(name));
  }

  async function switchProxy(name: string) {
    if (!canUseRuntimeNode(name)) {
      toast.error(`${group.name}: ${t.policies.switchFailed}`);
      return;
    }

    const prev = selectedProxy;
    setOptimisticProxy(name);
    const res = await fetch(`/api/mihomo/proxies/${encodeURIComponent(group.name)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string; errorType?: string };
      setOptimisticProxy(prev === runtimeSelectedProxy ? null : prev);
      if (data.errorType === "not_loaded") {
        toast.error(`${group.name}: ${t.policies.switchFailed}`);
      } else if (data.error) {
        toast.error(`${group.name}: ${data.error}`);
      } else {
        toast.error(`${group.name}: ${t.common.error}`);
      }
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
            <DropdownMenuItem disabled={!runtimeReady || hasPendingRuntimeChanges} onClick={onLatencyTest}>{t.policies.latencyTest}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={onDelete}>{t.policies.deleteGroup}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="text-sm font-bold text-[var(--foreground)] mb-2 truncate">{group.name}</p>
      {hasPendingRuntimeChanges && (
        <p className="mb-2 text-[11px] font-medium text-amber-600 dark:text-amber-300">{t.policies.pendingApply}</p>
      )}

      <button
        onClick={() => setShowNodes(!showNodes)}
        className={cn(
          "flex items-center gap-1.5 text-xs font-semibold rounded-[8px] px-2 py-1 transition-all duration-150 w-full",
          hasPendingRuntimeChanges
            ? "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
            : selectedProxy === "DIRECT"
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
          {displayedNodes.map((node) => (
            <NodeCard
              key={node.name}
              node={node}
              selected={selectedProxy === node.name}
              disabled={!runtimeReady || !node.loadedInRuntime}
              pendingLabel={t.policies.pendingApply}
              onClick={() => void switchProxy(node.name)}
            />
          ))}
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
  const queryClient = useQueryClient();

  async function persistNodeLatency(nodeId: string, latency: number) {
    const targetNode = proxyNodes.find((node) => node.id === nodeId);
    if (!targetNode) return;

    const nextConfig = {
      ...parseProxyConfig(targetNode.config),
      latency,
    };

    await proxiesApi.update(nodeId, { config: nextConfig });

    queryClient.setQueryData<ProxyRow[]>(["proxies"], (current) =>
      current?.map((node) =>
        node.id === nodeId
          ? { ...node, config: JSON.stringify(nextConfig) }
          : node
      ) ?? current
    );
  }

  async function persistNamedLatencies(delays: Record<string, number>) {
    const updates = Object.entries(delays)
      .filter(([, latency]) => typeof latency === "number" && latency > 0)
      .map(([proxyName, latency]) => {
        const targetNode = proxyNodes.find((node) => node.name === proxyName);
        return targetNode ? persistNodeLatency(targetNode.id, latency) : null;
      })
      .filter((task): task is Promise<void> => task !== null);

    if (updates.length === 0) return true;

    const results = await Promise.allSettled(updates);
    return results.every((result) => result.status === "fulfilled");
  }

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

  async function testNodeLatency(name: string, nodeId?: string, kind: "proxy" | "group" = "proxy") {
    if (!runtimeReady) {
      toast.error(t.policies.runtimeStateUnavailable);
      return;
    }

    if (runtimeLoadedNames && !runtimeLoadedNames.has(name)) {
      toast.error(`${name}: ${t.policies.switchFailed}`);
      return;
    }

    try {
      const res = await fetch("/api/mihomo/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind }),
      });
      const data = await res.json().catch(() => ({})) as { delay?: number; error?: string; errorType?: string } & Record<string, unknown>;
      if (res.ok) {
        if (kind === "group") {
          const groupDelays = Object.fromEntries(
            Object.entries(data).filter(([, value]) => typeof value === "number")
          ) as Record<string, number>;

          if (Object.keys(groupDelays).length > 0) {
            const persisted = await persistNamedLatencies(groupDelays);
            if (!persisted) {
              queryClient.invalidateQueries({ queryKey: ["proxies"] });
            }

            const summary = Object.entries(groupDelays)
              .sort(([, a], [, b]) => a - b)
              .map(([proxyName, delay]) => `${proxyName} ${delay}ms`)
              .join(" · ");

            toast.success(`${name}: ${summary}`);
            return;
          }
        }

        if (nodeId && typeof data.delay === "number" && data.delay > 0) {
          try {
            await persistNodeLatency(nodeId, data.delay);
          } catch {
            queryClient.invalidateQueries({ queryKey: ["proxies"] });
          }
        }
        toast.success(`${name}: ${data.delay ?? "?"}ms`);
      } else {
        if (data.errorType === "not_loaded") {
          toast.error(`${name}: ${t.policies.switchFailed}`);
        } else if (data.errorType === "timeout") {
          toast.error(`${name}: ${t.proxyNode.connTimeout}`);
        } else if (data.errorType === "unreachable") {
          toast.error(`${name}: ${data.error ?? t.policies.nodeUnreachable}`);
        } else if (data.error) {
          toast.error(`${name}: ${data.error}`);
        } else {
          toast.error(`${name}: ${t.common.error}`);
        }
      }
    } catch {
      toast.error(`${name}: ${t.policies.cannotReachApi}`);
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
  const runtimeProxiesQuery = useMihomoProxies();

  const proxyNodes = proxiesQuery.data ?? [];
  const proxyGroups = groupsQuery.data ?? [];
  const runtimeProxyMap = runtimeProxiesQuery.data?.proxies ?? null;
  const runtimeReady = Boolean(runtimeProxyMap);
  const runtimeLoadedNames = runtimeProxyMap ? new Set(Object.keys(runtimeProxyMap)) : null;

  const hasPendingRuntimeSync = runtimeLoadedNames
    ? proxyNodes.some((node) => !runtimeLoadedNames.has(node.name))
      || proxyGroups.some((group) => {
        const runtimeGroup = runtimeProxyMap?.[group.name];
        return !groupChoicesMatch(group, proxyNodes, runtimeGroup);
      })
    : false;

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
        {runtimeProxiesQuery.isError && (
          <div className="flex items-start gap-3 rounded-[16px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <ServerCrash className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.policies.runtimeStateUnavailable}</p>
              <p className="text-xs text-amber-700 dark:text-amber-200">{t.policies.runtimeStateUnavailableHint}</p>
            </div>
          </div>
        )}

        {hasPendingRuntimeSync && (
          <div className="flex items-start gap-3 rounded-[16px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.policies.runtimeSyncNeeded}</p>
              <p className="text-xs text-amber-700 dark:text-amber-200">{t.policies.runtimeSyncHint}</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => applyConfig.mutate()}
              disabled={applyConfig.isPending}
              className="shrink-0 gap-1.5 border-amber-200 bg-white/70 text-amber-900 hover:bg-white dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20"
            >
              {applyConfig.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Check className="h-3.5 w-3.5" />}
              {t.topbar.applyConfig}
            </Button>
          </div>
        )}

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
                const latency = readProxyLatency(node.config);
                const loadedInRuntime = runtimeLoadedNames ? runtimeLoadedNames.has(node.name) : true;

                return (
                  <Card key={node.id} className="p-3 hover:shadow-lg transition-all group cursor-pointer">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">{node.type}</div>
                    <p className="text-sm font-bold text-[var(--foreground)] truncate">{node.name}</p>
                    <div className="mt-2 flex items-center justify-between">
                      {!loadedInRuntime ? (
                        <span className="text-[11px] font-semibold rounded-[5px] px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                          {t.policies.pendingApply}
                        </span>
                      ) : latency > 0 ? (
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
                          <DropdownMenuItem disabled={!runtimeReady || !loadedInRuntime} onClick={() => testNodeLatency(node.name, node.id)}>{t.policies.latencyTest}</DropdownMenuItem>
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
                  runtimeProxyMap={runtimeProxyMap}
                  runtimeReady={runtimeReady}
                  onEdit={() => setEditingGroupId(group.id)}
                  onDelete={() => deleteGroup.mutate(group.id)}
                  onLatencyTest={() => testNodeLatency(group.name, undefined, "group")}
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
