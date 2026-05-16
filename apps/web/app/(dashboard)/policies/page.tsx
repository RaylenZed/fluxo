"use client";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, MoreHorizontal, Zap, ChevronDown, Clock, RotateCcw, Network, ServerCrash, Check, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Topbar, ModeSegment } from "@/components/layout/topbar";
import { cn, getLatencyBg } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
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
import { proxiesApi, providersApi, type ProxyRow, type GroupRow, type ProviderRow, type MihomoProxyState } from "@/lib/api";
import { toast } from "sonner";
import { useLocale } from "@/lib/i18n/context";
import { useDesktopMode } from "@/lib/desktop";

// ─── Constants ────────────────────────────────────────────────────────────────
const groupTypeIcons = {
  select: MoreHorizontal,
  "url-test": Zap,
  fallback: RotateCcw,
  "load-balance": Network,
} as const;

const BUILTIN_PROXY_NAMES = new Set(["DIRECT", "REJECT"]);
const PROVIDER_NODE_PREVIEW_LIMIT = 300;

type DisplayNode = {
  name: string;
  type: string;
  latency: number;
  loadedInRuntime: boolean;
  pendingReason?: "apply" | "preview-loading" | "preview-error";
};

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

function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
}

function applyGroupFilter(names: string[], filter?: string | null) {
  const trimmed = filter?.trim();
  if (!trimmed) return names;
  try {
    const pattern = new RegExp(trimmed);
    return names.filter((name) => pattern.test(name));
  } catch {
    return names;
  }
}

function getOrderedGroupProxyNames(group: GroupRow, proxyNodes: ProxyRow[]): string[] {
  const orderedNames = uniqueStrings(parseGroupProxyNames(group));

  if (group.use_all_proxies) {
    for (const node of proxyNodes) {
      if (!orderedNames.includes(node.name)) orderedNames.push(node.name);
    }
  }

  return orderedNames;
}

function getRuntimeGroupChoices(runtimeGroup: MihomoProxyState | null | undefined): string[] {
  if (!Array.isArray(runtimeGroup?.all)) return [];
  return uniqueStrings(runtimeGroup.all.filter((value): value is string => typeof value === "string"));
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

// ─── GroupCard ────────────────────────────────────────────────────────────────
function GroupCard({
  group,
  proxyNodes,
  providers,
  latencyOverrides,
  runtimeProxyMap,
  runtimeReady,
  onEdit,
  onDelete,
  onLatencyTest,
  desktopMode,
}: {
  group: GroupRow;
  proxyNodes: ProxyRow[];
  providers: ProviderRow[];
  latencyOverrides: Record<string, number>;
  runtimeProxyMap: Record<string, MihomoProxyState> | null;
  runtimeReady: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLatencyTest: () => void;
  desktopMode: boolean;
}) {
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
  const providerRows = providerNames
    .map((name) => providers.find((provider) => provider.name === name))
    .filter((provider): provider is ProviderRow => Boolean(provider));
  const providerPreviewQuery = useQuery({
    queryKey: [
      "policy-group-provider-preview",
      group.id,
      group.filter ?? "",
      providerRows.map((provider) => `${provider.name}:${provider.url}:${provider.filter ?? ""}`),
    ],
    queryFn: async () => {
      return Promise.all(providerRows.map(async (provider) => {
        const result = await providersApi.preview({ url: provider.url, limit: PROVIDER_NODE_PREVIEW_LIMIT });
        const providerFilteredNames = applyGroupFilter(result.names, provider.filter);
        return {
          names: applyGroupFilter(providerFilteredNames, group.filter),
        };
      }));
    },
    enabled: hasProviderMembers && providerRows.length > 0 && runtimeGroupChoices.length === 0,
    staleTime: 60_000,
  });

  const displayedNodes: DisplayNode[] = (() => {
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
          latency: latencyOverrides[node.name] ?? readProxyLatency(node.config),
          loadedInRuntime,
        };
      })
      .filter((node): node is DisplayNode => node !== null);

    if (!hasProviderMembers) {
      return localNodes;
    }

    const displayedNames = new Set(localNodes.map((node) => node.name));
    if (runtimeGroupChoices.length === 0) {
      const previewNames = uniqueStrings((providerPreviewQuery.data ?? []).flatMap((preview) => preview.names));
      if (previewNames.length > 0) {
        const providerPreviewNodes = previewNames
          .filter((name) => !displayedNames.has(name))
          .map((name) => ({
            name,
            type: "provider",
            latency: latencyOverrides[name] ?? 0,
            loadedInRuntime: false,
            pendingReason: "apply" as const,
          }));
        return [...localNodes, ...providerPreviewNodes];
      }
      if (providerPreviewQuery.isSuccess) {
        return localNodes;
      }

      const providerPlaceholders = providerNames
        .filter((name) => !displayedNames.has(name))
        .map((name) => ({
          name,
          type: "provider",
          latency: 0,
          loadedInRuntime: false,
          pendingReason: providerPreviewQuery.isLoading
            ? "preview-loading" as const
            : providerPreviewQuery.isError
              ? "preview-error" as const
              : "apply" as const,
        }));
      return [...localNodes, ...providerPlaceholders];
    }

    const providerNodes = runtimeGroupChoices
      .filter((name) => !displayedNames.has(name))
      .map((name) => ({
        name,
        type: runtimeProxyMap?.[name]?.type ?? "provider",
        latency: latencyOverrides[name] ?? 0,
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
  const selectedDisplayedNode = displayedNodes.find((node) => node.name === selectedProxy);
  const selectedLatency = selectedNode
    ? (latencyOverrides[selectedNode.name] ?? readProxyLatency(selectedNode.config))
    : (selectedDisplayedNode?.latency ?? 0);

  function canUseRuntimeNode(name: string) {
    if (!runtimeReady) return false;
    if (!runtimeLoadedNames) return true;
    if (!runtimeGroup) return false;
    return runtimeLoadedNames.has(name) && (runtimeGroupChoiceSet.size === 0 || runtimeGroupChoiceSet.has(name));
  }

  async function switchProxy(name: string) {
    if (desktopMode) return;

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

  const selectedMenuNode = displayedNodes.find((node) => node.name === selectedProxy);

  return (
    <Card
      className={cn(
        "group flex h-[132px] flex-col rounded-[10px] border-0 bg-[#eeeeef] p-4 shadow-none transition-all duration-150",
        "hover:bg-[#e8e9ec] hover:shadow-[0_10px_26px_rgba(24,32,48,0.10)] dark:bg-[var(--surface-2)]",
        selectedProxy !== "DIRECT" && "bg-[#f0f0f1]",
        hasPendingRuntimeChanges && "bg-[#fff7df] ring-1 ring-amber-200 dark:ring-amber-500/30"
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--muted-foreground)]">
            <TypeIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{typeLabel}</span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="h-6 w-6 shrink-0 text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-[14px] bg-white/95 p-2 shadow-[0_14px_38px_rgba(24,32,48,0.22)] backdrop-blur dark:bg-[var(--surface)]">
            <DropdownMenuItem onClick={onEdit}>{t.policies.editGroup}</DropdownMenuItem>
            {!desktopMode && <DropdownMenuItem disabled={!runtimeReady || hasPendingRuntimeChanges} onClick={onLatencyTest}>{t.policies.latencyTest}</DropdownMenuItem>}
            {!desktopMode && <DropdownMenuSeparator />}
            <DropdownMenuItem className="text-red-600" onClick={onDelete}>{t.policies.deleteGroup}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="truncate text-[18px] font-bold tracking-[-0.01em] text-[var(--foreground)]">{group.name}</p>
      {hasPendingRuntimeChanges && (
        <p className="mt-1 truncate text-[11px] font-medium text-amber-600 dark:text-amber-300">{t.policies.pendingApply}</p>
      )}

      <div className="mt-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex h-9 w-full items-center gap-2 rounded-[8px] border px-3 text-[13px] font-bold transition-colors",
                hasPendingRuntimeChanges
                  ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                  : selectedProxy === "DIRECT"
                    ? "border-transparent bg-white/50 text-[var(--muted)] hover:bg-white"
                    : "border-transparent bg-[#e9f2ff] text-[var(--brand-600)] hover:bg-[#dcecff] dark:bg-[var(--brand-500)]/20 dark:text-[var(--brand-300)]"
              )}
            >
              <span className="min-w-0 flex-1 truncate text-left">{selectedProxy}</span>
              {selectedLatency > 0 && (
                <span className={cn("rounded px-1 py-0.5 text-[10px]", getLatencyBg(selectedLatency))}>
                  {selectedLatency}ms
                </span>
              )}
              {!selectedMenuNode?.loadedInRuntime && hasPendingRuntimeChanges && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              )}
              <ChevronDown className="h-3 w-3 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80 rounded-[14px] bg-white/96 p-0 shadow-[0_18px_46px_rgba(24,32,48,0.20)] backdrop-blur dark:bg-[var(--surface)]">
            <DropdownMenuLabel className="flex items-center justify-between gap-3">
              <span className="truncate">{group.name}</span>
              {displayedNodes.length > 0 && (
                <span className="text-[10px] font-medium text-[var(--muted-foreground)]">{displayedNodes.length}</span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-[340px] overflow-y-auto px-1.5 pb-1.5">
              {displayedNodes.map((node) => {
                const disabled = desktopMode || !runtimeReady || !node.loadedInRuntime;
                const selected = selectedProxy === node.name;
                return (
                  <DropdownMenuItem
                    key={node.name}
                    disabled={disabled}
                    onSelect={() => void switchProxy(node.name)}
                    className="min-h-12 gap-3 rounded-[8px]"
                  >
                    <Check className={cn("h-3.5 w-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{node.name}</div>
                      <div className="text-[10px] font-medium uppercase text-[var(--muted-foreground)]">{node.type}</div>
                    </div>
                    {!node.loadedInRuntime ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                        {node.pendingReason === "preview-loading"
                          ? t.common.loading
                          : node.pendingReason === "preview-error"
                            ? t.common.error
                            : t.policies.pendingApply}
                      </span>
                    ) : node.latency > 0 ? (
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", getLatencyBg(node.latency))}>
                        {node.latency}ms
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">—</span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function NodeSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="h-[112px] animate-pulse rounded-[10px] border-0 bg-[#eeeeef] p-4 shadow-none" />
      ))}
    </div>
  );
}

function GroupSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="h-[132px] animate-pulse rounded-[10px] border-0 bg-[#eeeeef] p-4 shadow-none" />
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

function SectionHeader({
  title,
  count,
  accent = false,
  action,
}: {
  title: string;
  count: number;
  accent?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className={cn("text-[17px] font-black tracking-[-0.01em]", accent ? "text-[#c026d3]" : "text-[var(--brand-500)]")}>{title}</h2>
        <span className="text-[15px] font-medium text-[var(--muted)]">{count}</span>
      </div>
      {action}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PoliciesPage() {
  const desktopMode = useDesktopMode();
  const [outboundMode, setOutboundMode] = useState("rule");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [latencyOverrides, setLatencyOverrides] = useState<Record<string, number>>({});
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
    setLatencyOverrides((current) => ({ ...current, [targetNode.name]: latency }));

    queryClient.setQueryData<ProxyRow[]>(["proxies"], (current) =>
      current?.map((node) =>
        node.id === nodeId
          ? { ...node, config: JSON.stringify(nextConfig) }
          : node
      ) ?? current
    );
  }

  async function persistNamedLatencies(delays: Record<string, number>) {
    const validDelays = Object.fromEntries(
      Object.entries(delays).filter(([, latency]) => typeof latency === "number" && latency > 0)
    ) as Record<string, number>;
    if (Object.keys(validDelays).length > 0) {
      setLatencyOverrides((current) => ({ ...current, ...validDelays }));
    }

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
    if (configModeQuery.data?.mode !== "managed") return;
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
          setLatencyOverrides((current) => ({ ...current, [name]: data.delay as number }));
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
  const providersQuery = useQuery({
    queryKey: ["providers"],
    queryFn: () => providersApi.list(),
    staleTime: 30_000,
  });
  const createProxy = useCreateProxy();
  const deleteProxy = useDeleteProxy();
  const updateProxy = useUpdateProxy();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const applyConfig = useApplyConfig();
  const runtimeProxiesQuery = useMihomoProxies({ enabled: !desktopMode });
  const configModeQuery = useQuery({
    queryKey: ["config-mode"],
    queryFn: async () => {
      const res = await fetch("/api/config/mode");
      if (!res.ok) return { mode: "manual" as const };
      return res.json() as Promise<{ mode: "manual" | "managed" }>;
    },
    staleTime: 30_000,
  });
  const managedMode = configModeQuery.data?.mode === "managed";
  const applyConfigLabel = managedMode ? t.topbar.applyConfig : t.topbar.exportConfig;

  const proxyNodes = proxiesQuery.data ?? [];
  const proxyGroups = groupsQuery.data ?? [];
  const providers = providersQuery.data ?? [];
  const runtimeProxyMap = desktopMode ? null : runtimeProxiesQuery.data?.proxies ?? null;
  const runtimeReady = desktopMode ? true : Boolean(runtimeProxyMap);
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
        {!desktopMode && managedMode && <ModeSegment
          value={outboundMode}
          onChange={switchMode}
          options={[
            { label: t.topbar.direct, value: "direct" },
            { label: t.topbar.global, value: "global" },
            { label: t.topbar.rules, value: "rule" },
          ]}
        />}
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
          {applyConfigLabel}
        </Button>
        <Button size="sm" onClick={() => setShowNewGroup(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {t.policies.addGroup}
        </Button>
      </Topbar>

      <div className="flex-1 overflow-auto px-8 py-7">
        {!desktopMode && runtimeProxiesQuery.isError && (
          <div className="mb-5 flex items-start gap-3 rounded-[12px] border border-amber-200 bg-[#fff9e9] px-5 py-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <ServerCrash className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.policies.runtimeStateUnavailable}</p>
              <p className="text-xs text-amber-700 dark:text-amber-200">{t.policies.runtimeStateUnavailableHint}</p>
            </div>
          </div>
        )}

        {!desktopMode && hasPendingRuntimeSync && (
          <div className="mb-6 flex items-start gap-3 rounded-[12px] border border-amber-200 bg-[#fff9e9] px-5 py-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
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
              {applyConfigLabel}
            </Button>
          </div>
        )}

        {/* Proxy Nodes */}
        <section className="mb-10">
          <SectionHeader
            title={t.policies.proxyNodes}
            count={proxyNodes.length}
            accent
            action={
              proxyNodes.length > 0 ? (
                <Button size="sm" variant="secondary" onClick={() => setShowAddNode(true)} className="h-8 gap-1.5 rounded-[7px] px-3 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  {t.policies.addNode}
                </Button>
              ) : null
            }
          />

          {proxiesQuery.isLoading ? (
            <NodeSkeleton />
          ) : proxiesQuery.isError ? (
            <ApiError />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {proxyNodes.map((node) => {
                const latency = readProxyLatency(node.config);
                const loadedInRuntime = runtimeLoadedNames ? runtimeLoadedNames.has(node.name) : true;

                return (
                  <Card key={node.id} className="group flex h-[112px] flex-col rounded-[10px] border-0 bg-[#eeeeef] p-4 shadow-none transition-all duration-150 hover:bg-[#e8e9ec] hover:shadow-[0_10px_26px_rgba(24,32,48,0.10)] dark:bg-[var(--surface-2)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[var(--muted-foreground)]">{node.type}</div>
                        <p className="mt-1 truncate text-[17px] font-bold tracking-[-0.01em] text-[var(--foreground)]">{node.name}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" className="h-6 w-6 shrink-0 text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 rounded-[14px] bg-white/95 p-2 shadow-[0_14px_38px_rgba(24,32,48,0.22)] backdrop-blur dark:bg-[var(--surface)]">
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
                    <div className="mt-auto">
                      {!loadedInRuntime ? (
                        <span className="rounded-[5px] bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                          {t.policies.pendingApply}
                        </span>
                      ) : latency > 0 ? (
                        <span className={cn("rounded-[5px] px-1.5 py-0.5 text-[13px] font-bold", getLatencyBg(latency))}>
                          {latency}ms
                        </span>
                      ) : (
                        <span className="rounded-[5px] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--muted)]">—</span>
                      )}
                    </div>
                  </Card>
                );
              })}
              <button
                className="flex h-[112px] flex-col items-center justify-center rounded-[10px] border border-dashed border-[#cfd3da] p-4 text-[var(--muted)] transition-all hover:border-[var(--brand-400)] hover:bg-white/60 hover:text-[var(--brand-500)]"
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
          <SectionHeader
            title={t.policies.policyGroups}
            count={proxyGroups.length}
            action={
              <Button size="sm" variant="secondary" onClick={() => setShowNewGroup(true)} className="h-8 gap-1.5 rounded-[7px] px-3 text-xs">
                <Plus className="h-3.5 w-3.5" />
                {t.policies.addGroup}
              </Button>
            }
          />

          {groupsQuery.isLoading ? (
            <GroupSkeleton />
          ) : groupsQuery.isError ? (
            <ApiError />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {proxyGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  proxyNodes={proxyNodes}
                  providers={providers}
                  latencyOverrides={latencyOverrides}
                  runtimeProxyMap={runtimeProxyMap}
                  runtimeReady={runtimeReady}
                  onEdit={() => setEditingGroupId(group.id)}
                  onDelete={() => deleteGroup.mutate(group.id)}
                  onLatencyTest={() => testNodeLatency(group.name, undefined, "group")}
                  desktopMode={desktopMode}
                />
              ))}
              <button
                className="flex h-[132px] flex-col items-center justify-center rounded-[10px] border border-dashed border-[#cfd3da] p-4 text-[var(--muted)] transition-all hover:border-[var(--brand-400)] hover:bg-white/60 hover:text-[var(--brand-500)]"
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
