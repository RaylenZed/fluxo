"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, ExternalLink, Filter, Layers, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLocale } from "@/lib/i18n/context";
import { proxiesApi, groupsApi, providersApi, type ProxyRow, type GroupRow, type ProviderPreviewResult } from "@/lib/api";
import { cn } from "@/lib/utils";

type MemberItem = {
  name: string;
  type: string;
  kind: "builtin" | "proxy" | "group";
};

type GroupProviderNodePreview = {
  providerName: string;
  names: string[];
  count: number;
  skipped: number;
};

interface ProxyGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onSave?: (data: Record<string, unknown>) => void;
  groupName?: string;
  editGroup?: GroupRow;
}

const PROVIDER_NODE_PREVIEW_LIMIT = 300;

function parseStringList(value?: string | null): string[] {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
  } catch {
    return [];
  }
}

function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildExactNameFilter(names: string[]) {
  const uniqueNames = uniqueStrings(names);
  if (uniqueNames.length === 0) return "";
  return `^(?:${uniqueNames.map(escapeRegex).join("|")})$`;
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

export function ProxyGroupDialog({ open, onClose, onSave, groupName, editGroup }: ProxyGroupDialogProps) {
  const { t } = useLocale();
  const gT = t.proxyGroup;

  const initSelected = (() => { try { return JSON.parse(editGroup?.proxies ?? "[]") as string[]; } catch { return []; } })();
  const initProviders = (() => { try { return JSON.parse(editGroup?.providers ?? "[]") as string[]; } catch { return []; } })();

  const [name, setName] = useState(editGroup?.name ?? groupName ?? "");
  const [type, setType] = useState(editGroup?.type ?? "select");
  const [selected, setSelected] = useState<string[]>(initSelected);
  const [externalProviderNames, setExternalProviderNames] = useState<string[]>(initProviders);
  const [useExternal, setUseExternal] = useState(initProviders.length > 0);
  const [externalUrl, setExternalUrl] = useState<string | null>(null);
  const [externalInterval, setExternalInterval] = useState<string | null>(null);
  const [externalPreview, setExternalPreview] = useState<{ url: string; result: ProviderPreviewResult } | null>(null);
  const [groupNodePreviews, setGroupNodePreviews] = useState<Record<string, GroupProviderNodePreview[]>>({});
  const [selectedProviderNodes, setSelectedProviderNodes] = useState<Record<string, string[]>>({});
  const [useAllProxies, setUseAllProxies] = useState(Boolean(editGroup?.use_all_proxies));
  const [filterRegex, setFilterRegex] = useState(editGroup?.filter ?? "");
  const [url, setUrl] = useState(editGroup?.url ?? "https://www.google.com/generate_204");
  const [interval, setInterval] = useState(String(editGroup?.interval ?? 300));
  const [tolerance, setTolerance] = useState(String(editGroup?.tolerance ?? 150));
  const [strategy, setStrategy] = useState(editGroup?.strategy ?? "consistent-hashing");

  // Fetch real proxies and groups from API
  const { data: proxies = [], isLoading: loadingProxies } = useQuery({
    queryKey: ["proxies"],
    queryFn: () => proxiesApi.list(),
    enabled: open,
    staleTime: 30_000,
  });

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupsApi.list(),
    enabled: open,
    staleTime: 30_000,
  });

  const { data: providers = [], isLoading: loadingProviders } = useQuery({
    queryKey: ["providers"],
    queryFn: () => providersApi.list(),
    enabled: open,
    staleTime: 30_000,
  });

  const firstExternalProvider = useMemo(
    () => providers.find((provider) => externalProviderNames.includes(provider.name)),
    [externalProviderNames, providers]
  );
  const effectiveExternalUrl = externalUrl ?? firstExternalProvider?.url ?? "";
  const effectiveExternalInterval = externalInterval ?? String(firstExternalProvider?.interval ?? 86400);
  const visibleExternalPreview = externalPreview?.url === effectiveExternalUrl.trim() ? externalPreview.result : null;
  const providerByName = useMemo(() => new Map(providers.map((provider) => [provider.name, provider])), [providers]);
  const groupByName = useMemo(() => new Map(groups.map((group) => [group.name, group])), [groups]);

  const previewExternal = useMutation({
    mutationFn: (url: string) => providersApi.preview({ url }),
    onSuccess: (result, previewUrl) => setExternalPreview({ url: previewUrl.trim(), result }),
  });

  const loadGroupNodes = useMutation({
    mutationFn: async (group: GroupRow) => {
      const providerNames = parseStringList(group.providers);
      const previews = await Promise.all(providerNames.map(async (providerName) => {
        const provider = providerByName.get(providerName);
        if (!provider) return null;
        const result = await providersApi.preview({ url: provider.url, limit: PROVIDER_NODE_PREVIEW_LIMIT });
        return {
          providerName,
          names: uniqueStrings(applyGroupFilter(result.names, group.filter)),
          count: result.count,
          skipped: result.skipped,
        };
      }));

      return {
        groupName: group.name,
        providers: previews.filter((preview): preview is GroupProviderNodePreview => preview !== null),
      };
    },
    onSuccess: ({ groupName: loadedGroupName, providers: previewProviders }) => {
      setGroupNodePreviews((prev) => ({ ...prev, [loadedGroupName]: previewProviders }));
    },
  });

  const isLoading = loadingProxies || loadingGroups || loadingProviders;

  // Build member list: DIRECT, REJECT + real proxies + other groups (excluding current)
  const builtins: MemberItem[] = [
    { name: "DIRECT", type: "builtin", kind: "builtin" },
    { name: "REJECT", type: "builtin", kind: "builtin" },
  ];
  const proxyMembers: MemberItem[] = proxies.map((p: ProxyRow) => ({ name: p.name, type: p.type, kind: "proxy" }));
  const groupMembers = groups
    .filter((g: GroupRow) => g.name !== groupName)
    .map((g: GroupRow) => ({ name: g.name, type: "group", kind: "group" as const }));

  const allMembers = [...builtins, ...proxyMembers, ...groupMembers];

  const toggleProxy = (proxyName: string) => {
    setSelected((prev) =>
      prev.includes(proxyName) ? prev.filter((p) => p !== proxyName) : [...prev, proxyName]
    );
  };

  const toggleProviderNode = (providerName: string, nodeName: string, parentGroupName: string) => {
    setSelected((prev) => prev.filter((name) => name !== parentGroupName));
    setSelectedProviderNodes((prev) => {
      const current = prev[providerName] ?? [];
      const next = current.includes(nodeName)
        ? current.filter((name) => name !== nodeName)
        : [...current, nodeName];
      return { ...prev, [providerName]: next };
    });
  };

  const renderMemberRows = (members: MemberItem[], showNoProxiesMessage = false) => (
    <div className="max-h-[420px] overflow-y-auto rounded-[6px] border border-[#d7d7da] bg-white dark:bg-[var(--surface)]">
      <div className="sticky top-0 z-10 grid h-9 grid-cols-[52px_110px_minmax(0,1fr)] items-center border-b border-[#d7d7da] bg-white/95 text-[13px] font-bold text-[var(--muted)] backdrop-blur dark:bg-[var(--surface)]">
        <span />
        <span>{gT.type}</span>
        <span>{gT.tabMembers}</span>
      </div>
      {members.map((proxy) => {
        const group = proxy.kind === "group" ? groupByName.get(proxy.name) : undefined;
        const groupProviders = group ? parseStringList(group.providers) : [];
        const canLoadGroupNodes = Boolean(group && groupProviders.length > 0);
        const groupPreview = group ? groupNodePreviews[group.name] : undefined;
        const isLoadingGroupNodes = Boolean(loadGroupNodes.isPending && loadGroupNodes.variables?.name === group?.name);

        return (
          <div key={proxy.name}>
            <button
              onClick={() => toggleProxy(proxy.name)}
              className={cn("grid min-h-11 w-full grid-cols-[52px_110px_minmax(0,1fr)] items-center border-b border-[#ececef] text-left text-[15px] transition-colors duration-150",
                selected.includes(proxy.name) ? "bg-[#edf5ff] dark:bg-[var(--brand-500)]/15" : "hover:bg-[#f5f5f6]"
              )}
            >
              <div className="flex justify-center">
                <div className={cn("flex h-5 w-5 items-center justify-center rounded-[5px] border transition-all",
                  selected.includes(proxy.name) ? "border-[var(--brand-500)] bg-[var(--brand-500)]" : "border-[#d9dbe2] bg-[#eeeeef]"
                )}>
                  {selected.includes(proxy.name) && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
              </div>
              <span className="w-fit rounded-[5px] bg-[#f2f3f5] px-2 py-1 font-mono text-[12px] uppercase text-[var(--muted-foreground)]">{proxy.type}</span>
              <span className="truncate pr-3 font-semibold text-[var(--foreground)]">{proxy.name}</span>
            </button>

            {canLoadGroupNodes && (
              <div className="border-b border-[#ececef] bg-white dark:bg-[var(--surface)]">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => group && loadGroupNodes.mutate(group)}
                  disabled={isLoadingGroupNodes}
                  className="ml-[156px] h-8 px-2 text-[13px] font-semibold text-[var(--muted)]"
                >
                  {isLoadingGroupNodes ? gT.loadingGroupNodes : gT.loadGroupNodes}
                </Button>

                {groupPreview?.map((providerPreview) => (
                  <div key={providerPreview.providerName} className="border-l border-[#d7d7da] ml-[104px]">
                    {providerPreview.names.length === 0 ? (
                      <p className="py-2 pl-4 text-xs text-[var(--muted)]">{gT.noProviderNodes}</p>
                    ) : providerPreview.names.map((nodeName) => {
                      const isSelected = selectedProviderNodes[providerPreview.providerName]?.includes(nodeName) ?? false;
                      return (
                        <button
                          key={`${providerPreview.providerName}:${nodeName}`}
                          type="button"
                          onClick={() => toggleProviderNode(providerPreview.providerName, nodeName, proxy.name)}
                          className={cn("grid min-h-10 w-full grid-cols-[52px_110px_minmax(0,1fr)] items-center text-left text-[14px] transition-colors duration-150",
                            isSelected ? "bg-[#edf5ff] dark:bg-[var(--brand-500)]/15" : "hover:bg-[#f5f5f6]"
                          )}
                        >
                          <div className="flex justify-center">
                            <div className={cn("flex h-5 w-5 items-center justify-center rounded-[5px] border transition-all",
                              isSelected ? "border-[var(--brand-500)] bg-[var(--brand-500)]" : "border-[#d9dbe2] bg-[#eeeeef]"
                            )}>
                              {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                            </div>
                          </div>
                          <span className="w-fit rounded-[5px] bg-[#f2f3f5] px-2 py-1 font-mono text-[12px] uppercase text-[var(--muted-foreground)]">{gT.providerNode}</span>
                          <span className="truncate pr-3 font-semibold text-[var(--foreground)]">{nodeName}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {showNoProxiesMessage && <p className="py-3 text-center text-xs text-[var(--muted)]">{gT.noProxies}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] w-[min(980px,calc(100vw-32px))] max-w-none overflow-hidden rounded-[24px] bg-[#fbfbfd] shadow-[0_26px_90px_rgba(0,0,0,0.28)]">
        <DialogHeader className="border-b border-[#e6e6e8] px-9 pb-5 pt-7">
          <DialogTitle className="text-[30px] font-black tracking-[-0.02em]">
            {groupName ? gT.titleEdit.replace("{name}", groupName) : gT.titleNew}
          </DialogTitle>
          <DialogDescription className="text-[17px] font-medium text-[var(--muted)]">{gT.description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(88vh-176px)] space-y-5 overflow-y-auto px-9 py-6">
          {/* Name + Type */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[15px] font-bold text-[var(--muted)]">{gT.groupName}</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={gT.groupNamePlaceholder}
                className="h-12 rounded-[9px] bg-white text-[18px] font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[15px] font-bold text-[var(--muted)]">{gT.type}</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-12 rounded-[9px] bg-white text-[18px] font-semibold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="select">{gT.typeManual}</SelectItem>
                  <SelectItem value="url-test">{gT.typeAuto}</SelectItem>
                  <SelectItem value="fallback">{gT.typeFallback}</SelectItem>
                  <SelectItem value="load-balance">{gT.typeLoadBalance}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="members">
            <TabsList className="grid h-12 w-full grid-cols-4 rounded-[12px] bg-[#f1f2f5] p-1">
              <TabsTrigger value="members" className="gap-2 text-[16px] font-bold data-[state=active]:rounded-[10px]">
                <Check className="h-3.5 w-3.5" />{gT.tabMembers}
              </TabsTrigger>
              <TabsTrigger value="external" className="gap-2 text-[16px] font-bold data-[state=active]:rounded-[10px]">
                <ExternalLink className="h-3.5 w-3.5" />{gT.tabExternal}
              </TabsTrigger>
              <TabsTrigger value="filter" className="gap-2 text-[16px] font-bold data-[state=active]:rounded-[10px]">
                <Filter className="h-3.5 w-3.5" />{gT.tabFilter}
              </TabsTrigger>
              <TabsTrigger value="options" className="gap-2 text-[16px] font-bold data-[state=active]:rounded-[10px]">
                <Layers className="h-3.5 w-3.5" />{gT.tabOptions}
              </TabsTrigger>
            </TabsList>

            {/* Members tab */}
            <TabsContent value="members" className="mt-5">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-sm text-[var(--muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" />{gT.loadingProxies}
                </div>
              ) : allMembers.length === 2 /* only builtins */ && proxies.length === 0 ? (
                renderMemberRows(builtins, true)
              ) : (
                renderMemberRows(allMembers)
              )}
            </TabsContent>

            {/* External provider tab */}
            <TabsContent value="external" className="mt-5 space-y-4">
              <div className="flex items-center justify-between rounded-[10px] border border-[#e1e2e8] bg-white px-4 py-3">
                <div>
                  <p className="text-[16px] font-bold text-[var(--foreground)]">{gT.includeExternal}</p>
                  <p className="text-[14px] font-medium text-[var(--muted)]">{gT.includeExternalDesc}</p>
                </div>
                <Switch checked={useExternal} onCheckedChange={setUseExternal} />
              </div>
              {useExternal && (
                <div className="space-y-3 pl-1">
                  <div className="space-y-1.5">
                    <label className="text-[15px] font-bold text-[var(--muted)]">{gT.subscriptionUrl}</label>
                    <div className="flex gap-2">
                      <Input
                        value={effectiveExternalUrl}
                        onChange={(e) => setExternalUrl(e.target.value)}
                        placeholder="https://example.com/sub.yaml"
                        className="h-11 bg-white font-mono text-[14px]"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => previewExternal.mutate(effectiveExternalUrl.trim())}
                        disabled={!effectiveExternalUrl.trim() || previewExternal.isPending}
                        className="shrink-0"
                      >
                        {previewExternal.isPending ? gT.previewingExternal : gT.previewExternal}
                      </Button>
                    </div>
                    {previewExternal.isError && (
                      <p className="text-xs text-red-500">{gT.externalPreviewFailed}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[15px] font-bold text-[var(--muted)]">{gT.autoUpdateInterval}</label>
                    <Input className="h-11 bg-white text-[15px]" type="number" value={effectiveExternalInterval} onChange={(e) => setExternalInterval(e.target.value)} />
                  </div>
                  {visibleExternalPreview && (
                    <div className="rounded-[10px] border border-[#e1e2e8] bg-white p-4">
                      <p className="text-xs font-semibold text-[var(--foreground)]">
                        {gT.externalPreviewReady.replace("{count}", String(visibleExternalPreview.count))}
                      </p>
                      {visibleExternalPreview.skipped > 0 && (
                        <p className="mt-1 text-[11px] text-[var(--muted)]">
                          {gT.externalPreviewSkipped.replace("{count}", String(visibleExternalPreview.skipped))}
                        </p>
                      )}
                      {visibleExternalPreview.names.length > 0 && (
                        <div className="mt-3 max-h-36 overflow-y-auto rounded-[8px] border border-[#e1e2e8] bg-[#f7f7f8]">
                          {uniqueStrings(visibleExternalPreview.names).slice(0, 12).map((proxyName) => (
                            <div key={proxyName} className="truncate px-2 py-1 text-xs text-[var(--foreground)]">
                              {proxyName}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Filter tab */}
            <TabsContent value="filter" className="mt-5 space-y-4">
              <div className="rounded-[10px] border border-[#e1e2e8] bg-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[16px] font-bold text-[var(--foreground)]">{gT.includeAllProxies}</p>
                    <p className="text-[14px] font-medium text-[var(--muted)]">{gT.includeAllProxiesDesc}</p>
                  </div>
                  <Switch checked={useAllProxies} onCheckedChange={setUseAllProxies} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[15px] font-bold text-[var(--muted)]">{gT.filterRegex}</label>
                <Input value={filterRegex} onChange={(e) => setFilterRegex(e.target.value)} placeholder='e.g. ^(?=.*(US|美国)).*$' className="h-11 bg-white font-mono text-[14px]" />
                <p className="text-[13px] font-medium text-[var(--muted-foreground)]">{gT.filterRegexDesc}</p>
              </div>
            </TabsContent>

            {/* Options tab */}
            <TabsContent value="options" className="mt-5 space-y-4">
              {(type === "url-test" || type === "fallback") && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[15px] font-bold text-[var(--muted)]">{t.proxyNode.testUrl}</label>
                    <Input className="h-11 bg-white text-[15px]" value={url} onChange={(e) => setUrl(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[15px] font-bold text-[var(--muted)]">{t.proxyNode.testInterval}</label>
                      <Input className="h-11 bg-white text-[15px]" type="number" value={interval} onChange={(e) => setInterval(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[15px] font-bold text-[var(--muted)]">{t.proxyNode.tolerance}</label>
                      <Input className="h-11 bg-white text-[15px]" type="number" value={tolerance} onChange={(e) => setTolerance(e.target.value)} />
                    </div>
                  </div>
                </>
              )}
              {type === "load-balance" && (
                <div className="space-y-1.5">
                  <label className="text-[15px] font-bold text-[var(--muted)]">{t.proxyNode.strategy}</label>
                  <Select value={strategy} onValueChange={setStrategy}>
                    <SelectTrigger className="h-11 bg-white text-[15px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consistent-hashing">Consistent Hashing</SelectItem>
                      <SelectItem value="round-robin">Round Robin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {type === "select" && (
                <div className="flex items-center justify-center py-4 text-sm text-[var(--muted)]">
                  {gT.noOptionsForSelect}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="border-t border-[#e6e6e8] bg-[#fbfbfd] px-9 py-5">
          <Button variant="secondary" onClick={onClose}>{gT.cancel}</Button>
          <Button
            onClick={() => {
              const providerUrl = effectiveExternalUrl.trim();
              const externalProviderNamesForSave = useExternal
                ? (firstExternalProvider ? [firstExternalProvider.name] : externalProviderNames)
                : [];
              const selectedProviderNames = Object.entries(selectedProviderNodes)
                .filter(([, nodeNames]) => nodeNames.length > 0)
                .map(([providerName]) => providerName);
              const selectedProviderNodeNames = Object.values(selectedProviderNodes).flat();
              const providerNames = uniqueStrings([...externalProviderNamesForSave, ...selectedProviderNames]);
              const uniqueSelectedProviderNodeNames = uniqueStrings(selectedProviderNodeNames);
              const nextFilter = uniqueSelectedProviderNodeNames.length > 0
                ? buildExactNameFilter(uniqueSelectedProviderNodeNames)
                : filterRegex;
              setExternalProviderNames(providerNames);
              onSave?.({
                name: name.trim(),
                type,
                proxies: selected,
                providers: providerNames,
                externalProvider: useExternal ? {
                  url: providerUrl,
                  interval: parseInt(effectiveExternalInterval, 10),
                } : null,
                filter: nextFilter,
                url,
                interval: parseInt(interval, 10),
                tolerance: parseInt(tolerance, 10),
                strategy,
                use_all_proxies: useAllProxies ? 1 : 0,
              });
            }}
            disabled={!name.trim() || (useExternal && !effectiveExternalUrl.trim())}
          >
            {groupName ? gT.saveChanges : gT.createGroup}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
