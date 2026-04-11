"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Search, Download, Upload, GripVertical, MoreHorizontal,
  ChevronDown, ChevronRight, LayoutList, FolderOpen, Globe, ExternalLink,
  ServerCrash,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Topbar } from "@/components/layout/topbar";
import { useLocale } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  useRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useReorderRules,
  useGroups,
} from "@/lib/hooks";
import { rulesApi, type RuleRow } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
type RuleType =
  | "DOMAIN" | "DOMAIN-SUFFIX" | "DOMAIN-KEYWORD" | "DOMAIN-WILDCARD" | "DOMAIN-SET"
  | "IP-CIDR" | "IP-CIDR6" | "GEOIP" | "GEOSITE" | "IP-ASN"
  | "PROCESS-NAME" | "USER-AGENT" | "URL-REGEX"
  | "IN-PORT" | "DEST-PORT" | "SRC-PORT" | "SRC-IP"
  | "DEVICE-NAME" | "PROTOCOL" | "SUBNET" | "HOSTNAME-TYPE" | "FINAL";

// UI rule type (adds matches for display)
interface Rule {
  id: string;
  type: RuleType;
  value: string;
  policy: string;
  matches: number;
  note: string;
}

const RULE_TYPES: RuleType[] = [
  "DOMAIN", "DOMAIN-SUFFIX", "DOMAIN-KEYWORD", "DOMAIN-WILDCARD", "DOMAIN-SET",
  "IP-CIDR", "IP-CIDR6", "GEOIP", "GEOSITE", "IP-ASN",
  "PROCESS-NAME", "USER-AGENT", "URL-REGEX",
  "IN-PORT", "DEST-PORT", "SRC-PORT", "SRC-IP",
  "DEVICE-NAME", "PROTOCOL", "SUBNET", "HOSTNAME-TYPE", "FINAL",
];

const BUILTIN_RULE_SETS = [
  "geoip-cn", "geoip-us", "geosite-cn", "geosite-geolocation-!cn",
  "geosite-google", "geosite-youtube", "geosite-telegram",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function rowToRule(row: RuleRow): Rule {
  return {
    id: row.id,
    type: row.type as RuleType,
    value: row.value,
    policy: row.policy,
    matches: 0,
    note: row.note ?? "",
  };
}

function getRuleTypeBadgeClass(type: RuleType): string {
  if (type.startsWith("DOMAIN")) return "bg-[var(--brand-100)] text-[var(--brand-700)] dark:bg-[var(--brand-500)]/20 dark:text-[var(--brand-300)]";
  if (["IP-CIDR", "IP-CIDR6", "GEOIP", "GEOSITE", "IP-ASN", "SRC-IP", "SUBNET"].includes(type))
    return "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300";
  if (type === "PROCESS-NAME") return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
  if (type === "FINAL") return "bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--border)]";
  return "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300";
}

function getPolicyBadgeClass(policy: string): string {
  if (policy === "DIRECT") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  if (policy === "REJECT") return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300";
  if (policy === "Proxy") return "bg-[var(--brand-100)] text-[var(--brand-700)] dark:bg-[var(--brand-500)]/20 dark:text-[var(--brand-300)]";
  return "bg-[var(--surface-2)] text-[var(--foreground)] border border-[var(--border)]";
}

// ─── Sortable Row ─────────────────────────────────────────────────────────────
function SortableRuleRow({
  rule,
  index,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  rule: Rule;
  index: number;
  onEdit: (rule: Rule) => void;
  onDelete: (id: string) => void;
  onDuplicate: (rule: Rule) => void;
}) {
  const { t } = useLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <tr ref={setNodeRef} style={style} className="group relative">
      <td className="w-12 pl-3 pr-1 py-2.5">
        <div className="flex items-center gap-1.5">
          <button
            {...attributes}
            {...listeners}
            className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-[var(--muted)] hover:text-[var(--foreground)] transition-opacity"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs text-[var(--muted)] font-mono w-5 text-right">{index + 1}</span>
        </div>
      </td>
      <td className="py-2.5 pr-3">
        <span className={cn("inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-semibold font-mono whitespace-nowrap", getRuleTypeBadgeClass(rule.type))}>
          {rule.type}
        </span>
      </td>
      <td className="py-2.5 pr-3 max-w-[200px]">
        <span className="text-sm font-mono text-[var(--foreground)] truncate block">
          {rule.value || <span className="text-[var(--muted)] italic">—</span>}
        </span>
      </td>
      <td className="py-2.5 pr-3">
        <span className={cn("inline-flex items-center rounded-[6px] px-2 py-0.5 text-xs font-semibold whitespace-nowrap", getPolicyBadgeClass(rule.policy))}>
          {rule.policy}
        </span>
      </td>
      <td className="py-2.5 pr-3 text-right">
        <span className="text-xs tabular-nums text-[var(--muted)]">
          {rule.matches.toLocaleString()}
        </span>
      </td>
      <td className="py-2.5 pr-2 max-w-[140px]">
        <span className="text-xs text-[var(--muted)] truncate block">{rule.note}</span>
      </td>
      <td className="py-2.5 pr-3 w-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 h-6 w-6 text-[var(--muted)]"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onEdit(rule)}>{t.rules.editRule}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(rule)}>{t.rules.duplicate}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={() => onDelete(rule.id)}>
              {t.rules.deleteItem}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

// ─── Policy Group Section ─────────────────────────────────────────────────────
function PolicyGroup({
  policy,
  rules,
  onEdit,
  onDelete,
  onDuplicate,
  startIndex,
}: {
  policy: string;
  rules: Rule[];
  onEdit: (r: Rule) => void;
  onDelete: (id: string) => void;
  onDuplicate: (r: Rule) => void;
  startIndex: number;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <tr>
        <td colSpan={7} className="pt-3 pb-1 pl-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            <span className={cn("inline-flex items-center rounded-[6px] px-2 py-0.5 font-semibold", getPolicyBadgeClass(policy))}>
              {policy}
            </span>
            <span className="text-[var(--muted-foreground)] font-normal">({rules.length})</span>
          </button>
        </td>
      </tr>
      {!collapsed && rules.map((rule, i) => (
        <SortableRuleRow
          key={rule.id}
          rule={rule}
          index={startIndex + i}
          onEdit={onEdit}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      ))}
    </>
  );
}

// ─── Add/Edit Rule Dialog ─────────────────────────────────────────────────────
function RuleDialog({
  open,
  onClose,
  editingRule,
  policies,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  editingRule?: Rule;
  policies: string[];
  onSave: (rule: Omit<Rule, "id" | "matches">, notify: boolean, extendedMatch: boolean) => void;
}) {
  const { t } = useLocale();
  const rT = t.rules;

  const [type, setType] = useState<RuleType>(editingRule?.type ?? "DOMAIN-SUFFIX");
  const [value, setValue] = useState(editingRule?.value ?? "");
  const [policy, setPolicy] = useState(editingRule?.policy ?? "Proxy");
  const [note, setNote] = useState(editingRule?.note ?? "");
  const [sendNotif, setSendNotif] = useState(false);
  const [extendedMatch, setExtendedMatch] = useState(false);
  const [resolveDns, setResolveDns] = useState(false);

  const isDomain = type.startsWith("DOMAIN");
  const isNoValue = type === "FINAL";

  function handleSave() {
    onSave({ type, value, policy, note }, sendNotif, extendedMatch);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{editingRule ? rT.editRule : rT.newRule}</DialogTitle>
          <DialogDescription>{rT.configureRule}</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted)]">{rT.ruleType}</label>
            <Select value={type} onValueChange={(v) => setType(v as RuleType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RULE_TYPES.map((rt) => (
                  <SelectItem key={rt} value={rt}>{rt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isNoValue && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--muted)]">{rT.value}</label>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                  type === "IP-CIDR" ? "e.g. 103.0.0.0/8"
                  : type === "GEOIP" ? "e.g. CN"
                  : type === "PROCESS-NAME" ? "e.g. chrome"
                  : "e.g. api.openai.com"
                }
                className="font-mono"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted)]">{rT.policyLabel}</label>
            <Select value={policy} onValueChange={setPolicy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {policies.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted)]">{rT.notes}</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.profiles.descriptionPlaceholder}
            />
          </div>

          <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] divide-y divide-[var(--border)]">
            <label className="flex items-center justify-between px-3 py-2.5 cursor-pointer">
              <span className="text-sm text-[var(--foreground)]">{rT.sendNotification}</span>
              <Switch checked={sendNotif} onCheckedChange={setSendNotif} />
            </label>
            <label className="flex items-center justify-between px-3 py-2.5 cursor-pointer">
              <span className="text-sm text-[var(--foreground)]">{rT.extendedMatching}</span>
              <Switch checked={extendedMatch} onCheckedChange={setExtendedMatch} />
            </label>
            {isDomain && (
              <label className="flex items-center justify-between px-3 py-2.5 cursor-pointer">
                <span className="text-sm text-[var(--foreground)]">{rT.resolveDns}</span>
                <Switch checked={resolveDns} onCheckedChange={setResolveDns} />
              </label>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>{rT.cancel}</Button>
          <Button onClick={handleSave} disabled={!isNoValue && !value.trim()}>
            {editingRule ? rT.saveChanges : rT.addRule}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Predefined rule set URL map (Loyalsoldier clash-rules)
const BUILTIN_PRESET: Record<string, { url: string; behavior: string }> = {
  "geoip-cn": { url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt", behavior: "ipcidr" },
  "geoip-us": { url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt", behavior: "ipcidr" },
  "geosite-cn": { url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt", behavior: "domain" },
  "geosite-geolocation-!cn": { url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt", behavior: "domain" },
  "geosite-google": { url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/google.txt", behavior: "domain" },
  "geosite-youtube": { url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/applications.txt", behavior: "domain" },
  "geosite-telegram": { url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt", behavior: "ipcidr" },
};

// ─── Rule Set Dialog ───────────────────────────────────────────────────────────
function RuleSetDialog({
  open,
  onClose,
  policies,
}: {
  open: boolean;
  onClose: () => void;
  policies: string[];
}) {
  const { t } = useLocale();
  const rT = t.rules;
  const rsT = t.ruleSets;
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<"builtin" | "external">("builtin");
  const [builtinSet, setBuiltinSet] = useState(BUILTIN_RULE_SETS[0]);
  const [behavior, setBehavior] = useState("domain");
  const [policy, setPolicy] = useState("Proxy");
  const [url, setUrl] = useState("");
  const [interval, setIntervalVal] = useState("86400");
  const [testing, setTesting] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; behavior: string; url?: string; interval: number; policy: string }) => {
      const res = await fetch("/api/rule-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rule-providers"] });
      toast.success(rsT.ruleSetAdded);
      onClose();
      setName(""); setUrl(""); setSourceType("builtin");
    },
    onError: () => toast.error(rsT.ruleSetAddFailed),
  });

  async function handleTest() {
    if (!url.trim()) return;
    setTesting(true);
    try {
      await fetch(url, { method: "HEAD", mode: "no-cors" });
      toast.success(rsT.urlReachable);
    } catch {
      toast.error(rsT.urlUnreachable);
    } finally {
      setTesting(false);
    }
  }

  function handleAdd() {
    if (!name.trim()) return;
    if (sourceType === "builtin") {
      const preset = BUILTIN_PRESET[builtinSet];
      createMutation.mutate({
        name: name.trim() || builtinSet,
        type: "http",
        behavior: preset?.behavior ?? "domain",
        url: preset?.url,
        interval: Number(interval),
        policy,
      });
    } else {
      if (!url.trim()) return;
      createMutation.mutate({
        name: name.trim(),
        type: "http",
        behavior,
        url: url.trim(),
        interval: Number(interval),
        policy,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{rT.newRuleSetTitle}</DialogTitle>
          <DialogDescription>{rT.addRuleSetDesc}</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted)]">{t.profiles.nameLabel}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. my-cn-rules" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted)]">Source</label>
            <div className="flex gap-1.5 rounded-[10px] bg-[var(--surface-2)] p-0.5 border border-[var(--border)]">
              {(["builtin", "external"] as const).map((src) => (
                <button
                  key={src}
                  onClick={() => setSourceType(src)}
                  className={cn(
                    "flex-1 rounded-[8px] py-1.5 text-xs font-semibold transition-all capitalize",
                    sourceType === src
                      ? "bg-[var(--brand-500)] text-white shadow-sm"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  {src === "builtin" ? rT.builtIn : rT.externalUrl}
                </button>
              ))}
            </div>
          </div>

          {sourceType === "builtin" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--muted)]">{rT.builtInSet}</label>
              <Select value={builtinSet} onValueChange={(v) => { setBuiltinSet(v); if (!name) setName(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUILTIN_RULE_SETS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {sourceType === "external" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--muted)]">{rT.subscriptionUrl}</label>
                <div className="flex gap-2">
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/rules.yaml"
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleTest}
                    disabled={!url || testing}
                    className="shrink-0 gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {testing ? rT.testing : rT.test}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--muted)]">Behavior</label>
                  <Select value={behavior} onValueChange={setBehavior}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="domain">Domain</SelectItem>
                      <SelectItem value="ipcidr">IP CIDR</SelectItem>
                      <SelectItem value="classical">Classical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--muted)]">{rT.updateInterval}</label>
                  <Input
                    type="number"
                    value={interval}
                    onChange={(e) => setIntervalVal(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted)]">{rT.policyLabel}</label>
            <Select value={policy} onValueChange={setPolicy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {policies.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>{rT.cancel}</Button>
          <Button
            onClick={handleAdd}
            disabled={!name.trim() || (sourceType === "external" && !url.trim()) || createMutation.isPending}
          >
            {rT.addRuleSet}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Loading skeleton rows ────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          <td colSpan={7} className="py-2.5 px-3">
            <div className="h-5 rounded-[6px] animate-pulse bg-[var(--surface-2)]" />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RulesPage() {
  const { t } = useLocale();
  const rT = t.rules;
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [groupByPolicy, setGroupByPolicy] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [showAddRuleSet, setShowAddRuleSet] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | undefined>();

  const rulesQuery = useRules();
  const groupsQuery = useGroups();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const reorderRules = useReorderRules();

  const rawRules: Rule[] = (rulesQuery.data ?? []).map(rowToRule);

  // Build policies from groups + builtins
  const groupNames = (groupsQuery.data ?? []).map((g) => g.name);
  const policies = ["DIRECT", "REJECT", ...groupNames];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filtered = rawRules.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.type.toLowerCase().includes(q) ||
      r.value.toLowerCase().includes(q) ||
      r.policy.toLowerCase().includes(q) ||
      r.note.toLowerCase().includes(q)
    );
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = rawRules.findIndex((r) => r.id === active.id);
      const newIdx = rawRules.findIndex((r) => r.id === over.id);
      const reordered = arrayMove(rawRules, oldIdx, newIdx);
      reorderRules.mutate(reordered.map((r) => r.id));
    }
  }

  function handleDelete(id: string) {
    deleteRule.mutate(id);
  }

  function handleSaveRule(
    data: Omit<Rule, "id" | "matches">,
    notify: boolean,
    extendedMatch: boolean
  ) {
    const payload = {
      type: data.type,
      value: data.value,
      policy: data.policy,
      note: data.note,
      notify: notify ? 1 : 0,
      extended_matching: extendedMatch ? 1 : 0,
    };
    const close = () => { setShowAddRule(false); setEditingRule(undefined); };
    if (editingRule) {
      updateRule.mutate({ id: editingRule.id, data: payload }, { onSuccess: close });
    } else {
      createRule.mutate(payload, { onSuccess: close });
    }
  }

  function handleDuplicate(rule: Rule) {
    createRule.mutate({
      type: rule.type,
      value: rule.value,
      policy: rule.policy,
      note: rule.note ? `${rule.note} (copy)` : undefined,
      notify: 0,
      extended_matching: 0,
    });
  }

  function handleExport() {
    const data = (rulesQuery.data ?? []).map((r) => ({
      type: r.type,
      value: r.value,
      policy: r.policy,
      note: r.note,
      notify: r.notify,
      extended_matching: r.extended_matching,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rules.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const rows = JSON.parse(text) as Array<Partial<RuleRow>>;
        if (!Array.isArray(rows)) throw new Error("invalid");
        const valid = rows.filter((r) => r.type && r.value && r.policy);
        let ok = 0;
        for (const row of valid) {
          try {
            await rulesApi.create({
              type: row.type, value: row.value, policy: row.policy,
              note: row.note, notify: row.notify ?? 0,
              extended_matching: row.extended_matching ?? 0,
            });
            ok++;
          } catch { /* 单条失败不阻塞整体 */ }
        }
        qc.invalidateQueries({ queryKey: ['rules'] });
        toast.success(`${rT.import}: ${ok}`);
      } catch {
        toast.error(rT.importFailed);
      }
    };
    input.click();
  }

  // Group by policy
  const grouped = filtered.reduce<Record<string, Rule[]>>((acc, rule) => {
    if (!acc[rule.policy]) acc[rule.policy] = [];
    acc[rule.policy].push(rule);
    return acc;
  }, {});

  const isLoading = rulesQuery.isLoading;
  const isError = rulesQuery.isError;

  return (
    <div className="flex flex-col h-full">
      <Topbar title={rT.title} description={`${rulesQuery.data?.length ?? 0} ${rT.rulesConfigured}`}>
        <Button variant="ghost" size="sm" className="gap-1.5 text-[var(--muted)]" onClick={handleImport}>
          <Upload className="h-3.5 w-3.5" />
          {rT.import}
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5 text-[var(--muted)]" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" />
          {rT.export}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowAddRuleSet(true)} className="gap-1.5">
          <Globe className="h-3.5 w-3.5" />
          {rT.addRuleSet}
        </Button>
        <Button size="sm" onClick={() => setShowAddRule(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {rT.addRule}
        </Button>
      </Topbar>

      <div className="flex-1 p-6 overflow-auto">
        {isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--muted)]">
            <ServerCrash className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">{rT.cannotReachApi}</p>
            <p className="text-xs mt-1">{rT.backendHint}</p>
          </div>
        ) : (
          <>
            {/* Filter bar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted)]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={rT.searchRules}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <button
                onClick={() => setGroupByPolicy(!groupByPolicy)}
                className={cn(
                  "flex items-center gap-1.5 rounded-[8px] px-3 h-8 text-xs font-semibold border transition-all",
                  groupByPolicy
                    ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]"
                    : "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)]"
                )}
              >
                {groupByPolicy ? <FolderOpen className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}
                {groupByPolicy ? rT.byPolicy : rT.flatList}
              </button>

              <span className="text-xs text-[var(--muted)] ml-auto">
                {filtered.length} / {rawRules.length} {rT.filterCount}
              </span>
            </div>

            {/* Table */}
            <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-[var(--surface-2)] border-b border-[var(--border)]">
                    <tr>
                      <th className="pl-3 pr-1 py-2.5 w-12" />
                      <th className="py-2.5 pr-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{rT.typeCol}</th>
                      <th className="py-2.5 pr-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{rT.valueCol}</th>
                      <th className="py-2.5 pr-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{rT.policyCol}</th>
                      <th className="py-2.5 pr-3 text-right text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{rT.matchesCol}</th>
                      <th className="py-2.5 pr-2 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{rT.notesCol}</th>
                      <th className="py-2.5 pr-3 w-10" />
                    </tr>
                  </thead>

                  <SortableContext items={filtered.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                    <tbody className="divide-y divide-[var(--border)]">
                      {isLoading ? (
                        <SkeletonRows />
                      ) : groupByPolicy ? (
                        Object.entries(grouped).map(([policy, groupRules]) => {
                          const startIdx = filtered.indexOf(groupRules[0]);
                          return (
                            <PolicyGroup
                              key={policy}
                              policy={policy}
                              rules={groupRules}
                              onEdit={(r) => { setEditingRule(r); setShowAddRule(true); }}
                              onDelete={handleDelete}
                              onDuplicate={handleDuplicate}
                              startIndex={startIdx}
                            />
                          );
                        })
                      ) : (
                        filtered.map((rule, i) => (
                          <SortableRuleRow
                            key={rule.id}
                            rule={rule}
                            index={i}
                            onEdit={(r) => { setEditingRule(r); setShowAddRule(true); }}
                            onDelete={handleDelete}
                            onDuplicate={handleDuplicate}
                          />
                        ))
                      )}

                      {!isLoading && filtered.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-sm text-[var(--muted)]">
                            {rT.noRulesMatch}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </SortableContext>
                </table>
              </DndContext>
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      <RuleDialog
        key={editingRule?.id ?? "new-rule"}
        open={showAddRule}
        onClose={() => { setShowAddRule(false); setEditingRule(undefined); }}
        editingRule={editingRule}
        policies={policies}
        onSave={handleSaveRule}
      />
      <RuleSetDialog
        open={showAddRuleSet}
        onClose={() => setShowAddRuleSet(false)}
        policies={policies}
      />
    </div>
  );
}
