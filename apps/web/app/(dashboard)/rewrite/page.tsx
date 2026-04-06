"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, Database, Globe, Map } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Topbar } from "@/components/layout/topbar";
import { useLocale } from "@/lib/i18n/context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8090";

interface RuleProvider {
  id: string;
  name: string;
  type: string;
  behavior: string;
  url: string | null;
  path: string | null;
  interval: number;
  policy: string;
  created_at: string;
  updated_at: string;
}

function useRuleProviders() {
  return useQuery({
    queryKey: ["rule-providers"],
    queryFn: async () => {
      const res = await fetch(`${API}/api/rule-providers`);
      if (!res.ok) throw new Error("Failed to load rule providers");
      return res.json() as Promise<RuleProvider[]>;
    },
  });
}

const typeColors: Record<string, string> = {
  http: "bg-[var(--brand-100)] text-[var(--brand-600)] dark:bg-[var(--brand-500)]/20 dark:text-[var(--brand-300)]",
  file: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  inline: "bg-sky-50 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
};

const behaviorColors: Record<string, string> = {
  domain: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  ipcidr: "bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  classical: "bg-zinc-50 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300",
};

const policyColors: Record<string, string> = {
  DIRECT: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  REJECT: "bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

export default function RuleProvidersPage() {
  const { t } = useLocale();
  const rT = t.ruleSets;

  const qc = useQueryClient();
  const { data: providers = [], isLoading } = useRuleProviders();

  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "http",
    behavior: "domain",
    url: "",
    policy: "DIRECT",
    interval: "86400",
  });

  const defaultQuickAdd = [
    {
      label: rT.geoCnDirect,
      icon: Map,
      data: { name: "geoip-cn", type: "http", behavior: "ipcidr", url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt", interval: 86400, policy: "DIRECT" },
    },
    {
      label: rT.geositeCnDirect,
      icon: Globe,
      data: { name: "geosite-cn", type: "http", behavior: "domain", url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt", interval: 86400, policy: "DIRECT" },
    },
    {
      label: rT.rejectAds,
      icon: Database,
      data: { name: "reject-ads", type: "http", behavior: "domain", url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt", interval: 86400, policy: "REJECT" },
    },
  ];

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; behavior: string; url?: string; interval: number; policy: string }) => {
      const res = await fetch(`${API}/api/rule-providers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rule-providers"] }); toast.success(rT.ruleSetAdded); },
    onError: () => toast.error(rT.ruleSetAddFailed),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API}/api/rule-providers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rule-providers"] }); toast.success(rT.ruleSetDeleted); },
    onError: () => toast.error(rT.ruleSetDeleteFailed),
  });

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    createMutation.mutate({
      name: form.name.trim(),
      type: form.type,
      behavior: form.behavior,
      ...(form.url.trim() ? { url: form.url.trim() } : {}),
      interval: Number(form.interval),
      policy: form.policy,
    });
    setShowDialog(false);
  };

  const handleQuickAdd = (item: typeof defaultQuickAdd[0]) => {
    createMutation.mutate(item.data);
  };

  return (
    <div className="flex flex-col h-full">
      <Topbar title={rT.title} description={rT.subtitle}>
        <Button onClick={() => setShowDialog(true)} size="sm" className="gap-1.5 text-xs bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-white">
          <Plus className="h-3.5 w-3.5" />
          {rT.addRuleSet}
        </Button>
      </Topbar>

      <div className="flex-1 p-6 overflow-auto space-y-5">
        {/* Quick-add section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{rT.quickAdd}</CardTitle>
            <p className="text-xs text-[var(--muted)]">{rT.quickAddDesc}</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {defaultQuickAdd.map((item) => {
                const Icon = item.icon;
                const exists = providers.some((p) => p.name === item.data.name);
                return (
                  <Button
                    key={item.label}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    disabled={exists || createMutation.isPending}
                    onClick={() => handleQuickAdd(item)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {exists ? `${item.label} ${rT.added}` : item.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Rule providers list */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" />
          </div>
        ) : providers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[var(--surface-2)] border border-[var(--border)]">
              <Database className="h-7 w-7 text-[var(--muted)]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--foreground)]">{rT.noRuleSets}</p>
              <p className="text-xs text-[var(--muted)] mt-1">{rT.noRuleSetsDesc}</p>
            </div>
          </div>
        ) : (
          <Card>
            <div className="px-4 py-2.5 border-b border-[var(--border)] grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">{rT.nameCol}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] w-16">{rT.typeCol}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] w-20 hidden sm:block">{rT.behaviorCol}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] w-20 hidden md:block">{rT.policyCol}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] w-20 hidden md:block">{rT.updatedCol}</span>
              <span className="w-8" />
            </div>
            <CardContent className="pt-2 pb-2 px-2 space-y-0.5">
              {providers.map((p) => (
                <div key={p.id} className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center rounded-[10px] px-2 py-2.5 hover:bg-[var(--surface-2)] group">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{p.name}</p>
                    {p.url && <p className="text-[11px] font-mono text-[var(--muted)] truncate">{p.url}</p>}
                  </div>
                  <div className="w-16">
                    <span className={cn("text-[11px] font-semibold rounded-[6px] px-2 py-0.5", typeColors[p.type] ?? "bg-[var(--surface-2)] text-[var(--muted)]")}>
                      {p.type}
                    </span>
                  </div>
                  <div className="w-20 hidden sm:block">
                    <span className={cn("text-[11px] font-semibold rounded-[6px] px-2 py-0.5", behaviorColors[p.behavior] ?? "bg-[var(--surface-2)] text-[var(--muted)]")}>
                      {p.behavior}
                    </span>
                  </div>
                  <div className="w-20 hidden md:block">
                    <span className={cn("text-[11px] font-semibold rounded-[6px] px-2 py-0.5", policyColors[p.policy] ?? "bg-[var(--surface-2)] text-[var(--muted)]")}>
                      {p.policy}
                    </span>
                  </div>
                  <div className="w-20 hidden md:block">
                    <span className="text-xs text-[var(--muted)]">{new Date(p.updated_at).toLocaleDateString()}</span>
                  </div>
                  <div className="w-8">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-red-500 transition-opacity"
                      onClick={() => deleteMutation.mutate(p.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rT.addRuleSet}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--foreground)]">{rT.nameLabel}</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="my-rule-set" className="font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--foreground)]">{rT.typeLabel}</label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="file">File</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--foreground)]">{rT.behaviorLabel}</label>
                <Select value={form.behavior} onValueChange={(v) => setForm((f) => ({ ...f, behavior: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="domain">Domain</SelectItem>
                    <SelectItem value="ipcidr">IP CIDR</SelectItem>
                    <SelectItem value="classical">Classical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--foreground)]">{rT.urlLabel}</label>
              <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://cdn.jsdelivr.net/..." className="font-mono text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--foreground)]">{rT.policyLabel}</label>
                <Input value={form.policy} onChange={(e) => setForm((f) => ({ ...f, policy: e.target.value }))} placeholder="DIRECT" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--foreground)]">{rT.intervalLabel}</label>
                <Input value={form.interval} onChange={(e) => setForm((f) => ({ ...f, interval: e.target.value }))} type="number" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>{rT.cancel}</Button>
            <Button onClick={handleSubmit} className="bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-white">{rT.add}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
