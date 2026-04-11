"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, RefreshCw, Loader2, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Topbar } from "@/components/layout/topbar";
import { useLocale } from "@/lib/i18n/context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


interface Provider {
  id: string;
  name: string;
  url: string;
  interval: number;
  filter: string | null;
  health_check_url: string | null;
  last_updated: string | null;
  created_at: string;
  updated_at: string;
}

function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const res = await fetch(`/api/providers`);
      if (!res.ok) throw new Error("Failed to load providers");
      return res.json() as Promise<Provider[]>;
    },
  });
}

function formatInterval(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export default function ProvidersPage() {
  const { t } = useLocale();
  const qc = useQueryClient();
  const { data: providers = [], isLoading } = useProviders();

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    url: "",
    interval: "86400",
    filter: "",
    healthCheckUrl: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; url: string; interval: number; filter?: string; healthCheckUrl?: string }) => {
      const res = await fetch(`/api/providers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["providers"] }); toast.success(t.providers.providerAdded); setShowDialog(false); },
    onError: () => toast.error(t.providers.providerAddFailed),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ name: string; url: string; interval: number; filter: string }> }) => {
      const res = await fetch(`/api/providers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["providers"] }); toast.success(t.providers.providerUpdated); setShowDialog(false); },
    onError: () => toast.error(t.providers.providerUpdateFailed),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/providers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["providers"] }); toast.success(t.providers.providerDeleted); },
    onError: () => toast.error(t.providers.providerDeleteFailed),
  });

  const openNew = () => {
    setEditingId(null);
    setForm({ name: "", url: "", interval: "86400", filter: "", healthCheckUrl: "" });
    setShowDialog(true);
  };

  const openEdit = (p: Provider) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      url: p.url,
      interval: String(p.interval),
      filter: p.filter ?? "",
      healthCheckUrl: p.health_check_url ?? "",
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.url.trim()) return;
    const data = {
      name: form.name.trim(),
      url: form.url.trim(),
      interval: Number(form.interval),
      ...(form.filter.trim() ? { filter: form.filter.trim() } : {}),
      ...(form.healthCheckUrl.trim() ? { healthCheckUrl: form.healthCheckUrl.trim() } : {}),
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleUpdateNow = async (p: Provider) => {
    try {
      const res = await fetch(`/api/mihomo/providers/${encodeURIComponent(p.name)}/update`, { method: "PUT" });
      if (!res.ok) throw new Error();
      toast.success(t.providers.updateNowSuccess);
    } catch {
      toast.error(t.providers.updateNowFailed);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Topbar title={t.providers.title} description={t.providers.subtitle}>
        <Button onClick={openNew} size="sm" className="gap-1.5 text-xs bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-white">
          <Plus className="h-3.5 w-3.5" />
          {t.providers.addProvider}
        </Button>
      </Topbar>

      <div className="flex-1 p-6 overflow-auto space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" />
          </div>
        ) : providers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[var(--surface-2)] border border-[var(--border)]">
              <Package className="h-7 w-7 text-[var(--muted)]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--foreground)]">{t.providers.noProviders}</p>
              <p className="text-xs text-[var(--muted)] mt-1">{t.providers.noProvidersDesc}</p>
            </div>
            <Button onClick={openNew} size="sm" className="gap-1.5 text-xs bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-white">
              <Plus className="h-3.5 w-3.5" />
              {t.providers.addProvider}
            </Button>
          </div>
        ) : (
          providers.map((p) => (
            <Card key={p.id}>
              <div className="p-5 flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] text-base font-bold text-[var(--brand-500)]">
                  {p.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{p.name}</p>
                  <p className="text-xs font-mono text-[var(--muted)] truncate">{p.url}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                    <span>{t.providers.interval}: {formatInterval(p.interval)}</span>
                    {p.filter && <span>{t.providers.filterLabel}: <code className="font-mono">{p.filter}</code></span>}
                    {p.last_updated && <span>{t.providers.lastUpdated}: {new Date(p.last_updated).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5"
                    onClick={() => handleUpdateNow(p)}
                  >
                    <RefreshCw className="h-3 w-3" />
                    {t.providers.update}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-[var(--muted)] hover:text-[var(--brand-500)]"
                    onClick={() => openEdit(p)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-[var(--muted)] hover:text-red-500"
                    onClick={() => deleteMutation.mutate(p.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t.providers.editProvider : t.providers.addProvider}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--foreground)]">{t.providers.name}</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="My Subscription" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--foreground)]">{t.profiles.subscriptionUrlLabel}</label>
              <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://sub.example.com/..." className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--foreground)]">{t.providers.interval}</label>
              <Select value={form.interval} onValueChange={(v) => setForm((f) => ({ ...f, interval: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3600">{t.profiles.interval1h}</SelectItem>
                  <SelectItem value="21600">{t.profiles.interval6h}</SelectItem>
                  <SelectItem value="86400">{t.profiles.interval24h}</SelectItem>
                  <SelectItem value="604800">{t.profiles.interval7d}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--foreground)]">{t.providers.filterLabel}</label>
              <Input value={form.filter} onChange={(e) => setForm((f) => ({ ...f, filter: e.target.value }))} placeholder="HK|JP|SG" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--foreground)]">{t.providers.healthCheckUrl}</label>
              <Input value={form.healthCheckUrl} onChange={(e) => setForm((f) => ({ ...f, healthCheckUrl: e.target.value }))} placeholder="https://www.gstatic.com/generate_204" className="font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>{t.providers.cancel}</Button>
            <Button onClick={handleSubmit} className="bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-white">
              {editingId ? t.providers.save : t.common.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
