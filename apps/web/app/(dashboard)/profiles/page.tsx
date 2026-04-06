"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Folder, Plus, Link, CheckCircle2, MoreHorizontal, Trash2, Copy, Pen, Download, Play, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Topbar } from "@/components/layout/topbar";
import { useLocale } from "@/lib/i18n/context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


interface Profile {
  id: string;
  name: string;
  description: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const res = await fetch(`/api/profiles`);
      if (!res.ok) throw new Error("Failed to load profiles");
      return res.json() as Promise<Profile[]>;
    },
  });
}

export default function ProfilesPage() {
  const { t } = useLocale();
  const qc = useQueryClient();
  const { data: profiles = [], isLoading } = useProfiles();

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingActivateId, setPendingActivateId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importInterval, setImportInterval] = useState("24h");

  const pT = t.profiles;

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await fetch(`/api/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profiles"] }); toast.success(pT.profileCreated); },
    onError: () => toast.error(pT.profileCreateFailed),
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/profiles/${id}/activate`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to activate");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profiles"] }); toast.success(pT.profileActivated); },
    onError: () => toast.error(pT.profileActivateFailed),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/profiles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profiles"] }); toast.success(pT.profileDeleted); },
    onError: () => toast.error(pT.profileDeleteFailed),
  });

  const handleActivate = (id: string) => {
    setPendingActivateId(id);
    setShowConfirmDialog(true);
  };

  const confirmActivate = () => {
    if (pendingActivateId) activateMutation.mutate(pendingActivateId);
    setShowConfirmDialog(false);
    setPendingActivateId(null);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate({ name: newName.trim(), description: newDesc.trim() });
    setNewName("");
    setNewDesc("");
    setShowNewDialog(false);
  };

  const pendingProfile = profiles.find((p) => p.id === pendingActivateId);

  return (
    <div className="flex flex-col h-full">
      <Topbar title={pT.title} description={pT.subtitle}>
        <Button onClick={() => setShowImportDialog(true)} variant="outline" size="sm" className="gap-1.5 text-xs">
          <Link className="h-3.5 w-3.5" />
          {pT.importUrl}
        </Button>
        <Button onClick={() => setShowNewDialog(true)} size="sm" className="gap-1.5 text-xs bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-white">
          <Plus className="h-3.5 w-3.5" />
          {pT.newProfile}
        </Button>
      </Topbar>

      <div className="flex-1 p-6 overflow-auto space-y-5">
        {/* Storage path */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)]">
              <Folder className="h-4 w-4 text-[var(--muted)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--muted)] mb-1">{pT.storagePath}</p>
              <Input value="~/.config/fluxo/profiles" readOnly className="bg-[var(--surface-2)] font-mono text-xs" />
            </div>
          </div>
        </Card>

        {/* Profile list */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-12 text-sm text-[var(--muted)]">
            {pT.noProfilesYet}
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((profile) => {
              const isActive = Boolean(profile.is_active);
              return (
                <Card
                  key={profile.id}
                  className={cn(
                    "transition-all duration-200",
                    isActive && "border-[var(--brand-500)] shadow-[0_0_0_1px_var(--brand-500)]"
                  )}
                >
                  <div className="p-5 flex items-start gap-4">
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] font-bold text-lg", isActive ? "bg-[var(--brand-500)] text-white" : "bg-[var(--surface-2)] text-[var(--muted)]")}>
                      {profile.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-[var(--foreground)]">{profile.name}</h3>
                        {isActive && (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {pT.active}
                          </Badge>
                        )}
                      </div>
                      {profile.description && (
                        <p className="text-sm text-[var(--muted)] mt-0.5 truncate">{profile.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-[var(--muted)]">
                        <span>{pT.updated} {new Date(profile.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1.5"
                          onClick={() => handleActivate(profile.id)}
                          disabled={activateMutation.isPending}
                        >
                          <Play className="h-3 w-3" />
                          {pT.activate}
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" className="text-[var(--muted)]">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2"><Download className="h-3.5 w-3.5" />{pT.export}</DropdownMenuItem>
                          <DropdownMenuItem className="gap-2"><Copy className="h-3.5 w-3.5" />{pT.duplicate}</DropdownMenuItem>
                          <DropdownMenuItem className="gap-2"><Pen className="h-3.5 w-3.5" />{pT.rename}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2 text-red-500"
                            onClick={() => deleteMutation.mutate(profile.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />{pT.deleteProfile}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* New Profile Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pT.newProfile}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--foreground)]">{pT.nameLabel}</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={pT.namePlaceholder} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--foreground)]">{pT.descriptionLabel}</label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={pT.descriptionPlaceholder} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>{t.common.cancel}</Button>
            <Button onClick={handleCreate} className="bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-white">{pT.create}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import URL Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pT.importFromUrl}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--foreground)]">{pT.subscriptionUrlLabel}</label>
              <Input value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder={pT.subscriptionUrlPlaceholder} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--foreground)]">{pT.autoUpdateInterval}</label>
              <Select value={importInterval} onValueChange={setImportInterval}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">{pT.intervalDisabled}</SelectItem>
                  <SelectItem value="1h">{pT.interval1h}</SelectItem>
                  <SelectItem value="6h">{pT.interval6h}</SelectItem>
                  <SelectItem value="24h">{pT.interval24h}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>{t.common.cancel}</Button>
            <Button
              onClick={() => {
                if (!importUrl.trim()) return;
                createMutation.mutate({ name: importUrl.split("/").pop() ?? "Imported", description: importUrl });
                setImportUrl("");
                setShowImportDialog(false);
              }}
              className="bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-white"
            >
              {pT.import}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Switch Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pT.switchProfile}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2">
            <p className="text-sm text-[var(--muted)]">
              {pT.switch} <strong className="text-[var(--foreground)]">{pendingProfile?.name}</strong>? Active connections will be restarted.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>{t.common.cancel}</Button>
            <Button onClick={confirmActivate} className="bg-[var(--brand-500)] hover:bg-[var(--brand-600)] text-white">{pT.switch}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
