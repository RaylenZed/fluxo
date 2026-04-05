"use client";
import { useState } from "react";
import { Check, ExternalLink, Filter, Layers, Globe2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const allProxies = [
  { name: "DIRECT", type: "builtin" },
  { name: "REJECT", type: "builtin" },
  { name: "US OwO", type: "hysteria2", flag: "🇺🇸" },
  { name: "KR ORACLE", type: "vmess", flag: "🇰🇷" },
  { name: "JP TYO GREEN", type: "ss", flag: "🇯🇵" },
  { name: "JP RFC", type: "ss", flag: "🇯🇵" },
  { name: "Proxy", type: "group" },
  { name: "PayPal", type: "group" },
  { name: "Twitter", type: "group" },
];

interface ProxyGroupDialogProps {
  open: boolean;
  onClose: () => void;
  groupName?: string;
}

export function ProxyGroupDialog({ open, onClose, groupName }: ProxyGroupDialogProps) {
  const [name, setName] = useState(groupName ?? "");
  const [type, setType] = useState("select");
  const [selected, setSelected] = useState<string[]>(["US OwO", "KR ORACLE"]);
  const [useExternal, setUseExternal] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [externalInterval, setExternalInterval] = useState("86400");
  const [useAllProxies, setUseAllProxies] = useState(false);
  const [filterRegex, setFilterRegex] = useState("");
  const [url, setUrl] = useState("https://www.google.com/generate_204");
  const [interval, setInterval] = useState("300");

  const toggleProxy = (proxyName: string) => {
    setSelected((prev) =>
      prev.includes(proxyName) ? prev.filter((p) => p !== proxyName) : [...prev, proxyName]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{groupName ? `Edit: ${groupName}` : "New Policy Group"}</DialogTitle>
          <DialogDescription>Configure proxy group type, members, and options.</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-4">
          {/* Name + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--muted)]">Group Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Proxy"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--muted)]">Type</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="select">Manual Select</SelectItem>
                  <SelectItem value="url-test">Auto URL Test</SelectItem>
                  <SelectItem value="fallback">Fallback</SelectItem>
                  <SelectItem value="load-balance">Load Balance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="members">
            <TabsList className="w-full">
              <TabsTrigger value="members" className="flex-1 gap-1.5">
                <Check className="h-3.5 w-3.5" />Members
              </TabsTrigger>
              <TabsTrigger value="external" className="flex-1 gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />External
              </TabsTrigger>
              <TabsTrigger value="filter" className="flex-1 gap-1.5">
                <Filter className="h-3.5 w-3.5" />Filter
              </TabsTrigger>
              <TabsTrigger value="options" className="flex-1 gap-1.5">
                <Layers className="h-3.5 w-3.5" />Options
              </TabsTrigger>
            </TabsList>

            {/* Members tab */}
            <TabsContent value="members" className="mt-3">
              <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
                {allProxies.map((proxy) => (
                  <button
                    key={proxy.name}
                    onClick={() => toggleProxy(proxy.name)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm transition-all duration-150",
                      selected.includes(proxy.name)
                        ? "bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/15"
                        : "hover:bg-[var(--surface-2)]"
                    )}
                  >
                    <div className={cn(
                      "h-4 w-4 rounded-[4px] border flex items-center justify-center transition-all",
                      selected.includes(proxy.name)
                        ? "bg-[var(--brand-500)] border-[var(--brand-500)]"
                        : "border-[var(--border)] bg-[var(--surface-2)]"
                    )}>
                      {selected.includes(proxy.name) && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)] bg-[var(--surface-2)] rounded px-1.5 py-0.5 font-mono uppercase">
                      {proxy.type}
                    </span>
                    <span className="flex-1 text-left font-medium text-[var(--foreground)]">
                      {"flag" in proxy ? `${proxy.flag} ` : ""}{proxy.name}
                    </span>
                  </button>
                ))}
              </div>
            </TabsContent>

            {/* External provider tab */}
            <TabsContent value="external" className="mt-3 space-y-3">
              <div className="flex items-center justify-between rounded-[12px] bg-[var(--surface-2)] px-3 py-2.5 border border-[var(--border)]">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">Include External Provider</p>
                  <p className="text-xs text-[var(--muted)]">Subscribe to remote proxy list</p>
                </div>
                <Switch checked={useExternal} onCheckedChange={setUseExternal} />
              </div>
              {useExternal && (
                <div className="space-y-3 pl-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--muted)]">Subscription URL</label>
                    <Input
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      placeholder="https://example.com/sub.yaml"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--muted)]">Auto-update interval (seconds)</label>
                    <Input
                      type="number"
                      value={externalInterval}
                      onChange={(e) => setExternalInterval(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Filter tab */}
            <TabsContent value="filter" className="mt-3 space-y-3">
              <div className="rounded-[12px] bg-[var(--surface-2)] px-3 py-2.5 border border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">Include All Proxies</p>
                    <p className="text-xs text-[var(--muted)]">Auto-include all current nodes</p>
                  </div>
                  <Switch checked={useAllProxies} onCheckedChange={setUseAllProxies} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--muted)]">Filter Regex (optional)</label>
                <Input
                  value={filterRegex}
                  onChange={(e) => setFilterRegex(e.target.value)}
                  placeholder="e.g. ^(?=.*(US|美国)).*$"
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  Only include nodes whose names match this regex
                </p>
              </div>
            </TabsContent>

            {/* Options tab (for url-test / fallback) */}
            <TabsContent value="options" className="mt-3 space-y-3">
              {(type === "url-test" || type === "fallback") && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--muted)]">Test URL</label>
                    <Input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--muted)]">Test Interval (s)</label>
                      <Input
                        type="number"
                        value={interval}
                        onChange={(e) => setInterval(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--muted)]">Tolerance (ms)</label>
                      <Input type="number" defaultValue="150" />
                    </div>
                  </div>
                </>
              )}
              {type === "load-balance" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--muted)]">Strategy</label>
                  <Select defaultValue="consistent-hashing">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consistent-hashing">Consistent Hashing</SelectItem>
                      <SelectItem value="round-robin">Round Robin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {type === "select" && (
                <div className="flex items-center justify-center py-4 text-sm text-[var(--muted)]">
                  No additional options for manual select
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onClose} disabled={!name.trim()}>
            {groupName ? "Save Changes" : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
