/**
 * ViewManager — Coupa-style saved views
 * Single-page layout with pre-filled suggestions, drag-and-drop columns
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import {
  Bookmark, Plus, ChevronDown, Star, Globe, Lock, Edit2, Trash2,
  Copy, X, Check, SlidersHorizontal, GripVertical, ArrowUpDown,
  ArrowUp, ArrowDown, Loader2, Sparkles, LayoutList, LayoutGrid
} from "lucide-react";

export type ViewFilter = { field: string; operator: string; value: string; label?: string };
export type DisplayType = "table" | "cards" | "compact";
export interface ViewState {
  filters: ViewFilter[];
  columns?: string[];
  sortBy?: string;
  sortDir?: "asc" | "desc";
  displayType: DisplayType;
}
export interface ColumnDef {
  key: string; label: string;
  filterable?: boolean; sortable?: boolean;
  type?: "string" | "number" | "date" | "status" | "amount";
  filterOptions?: { value: string; label: string }[];
}
interface ViewManagerProps {
  entity: string; entityLabel: string;
  columns: ColumnDef[]; defaultColumns?: string[];
  value: ViewState; onChange: (s: ViewState) => void;
}

const OPS_BY_TYPE: Record<string, { op: string; label: string }[]> = {
  string:  [{ op: "contains", label: "contient" }, { op: "eq", label: "est" }, { op: "not_contains", label: "ne contient pas" }, { op: "starts_with", label: "commence par" }],
  status:  [{ op: "eq", label: "est" }, { op: "neq", label: "n'est pas" }],
  number:  [{ op: "eq", label: "=" }, { op: "gt", label: ">" }, { op: "lt", label: "<" }, { op: "gte", label: "≥" }, { op: "lte", label: "≤" }],
  amount:  [{ op: "gt", label: "supérieur à" }, { op: "lt", label: "inférieur à" }, { op: "gte", label: "≥" }, { op: "lte", label: "≤" }, { op: "eq", label: "égal à" }],
  date:    [{ op: "after", label: "après le" }, { op: "before", label: "avant le" }, { op: "eq", label: "le" }],
};

// Pre-filled smart view suggestions per entity
const SMART_SUGGESTIONS: Record<string, Array<{ name: string; icon: string; filters: Partial<ViewFilter>[]; sortBy?: string; sortDir?: "asc" | "desc" }>> = {
  purchaseRequests: [
    { name: "Mes demandes en attente", icon: "⏳", filters: [{ field: "status", operator: "eq", value: "pending_approval" }] },
    { name: "Demandes urgentes", icon: "🔴", filters: [{ field: "urgencyLevel", operator: "eq", value: "critical" }], sortBy: "createdAt", sortDir: "desc" },
    { name: "Demandes approuvées ce mois", icon: "✅", filters: [{ field: "status", operator: "eq", value: "approved" }], sortBy: "updatedAt", sortDir: "desc" },
    { name: "Gros montants (> 1M XOF)", icon: "💰", filters: [{ field: "amountEstimate", operator: "gt", value: "1000000" }], sortBy: "amountEstimate", sortDir: "desc" },
  ],
  purchaseOrders: [
    { name: "BCs émis en attente", icon: "📤", filters: [{ field: "status", operator: "eq", value: "issued" }] },
    { name: "BCs approuvés à facturer", icon: "🧾", filters: [{ field: "status", operator: "eq", value: "approved" }] },
    { name: "Livraisons partielles", icon: "📦", filters: [{ field: "status", operator: "eq", value: "partially_received" }] },
  ],
  invoices: [
    { name: "Factures à approuver", icon: "⏳", filters: [{ field: "status", operator: "eq", value: "pending_approval" }] },
    { name: "Factures en litige", icon: "⚠️", filters: [{ field: "status", operator: "eq", value: "disputed" }] },
    { name: "Factures approuvées à payer", icon: "💳", filters: [{ field: "status", operator: "eq", value: "approved" }] },
    { name: "Factures échues", icon: "🔴", filters: [{ field: "status", operator: "eq", value: "overdue" }] },
  ],
  vendors: [
    { name: "Fournisseurs actifs", icon: "✅", filters: [{ field: "status", operator: "eq", value: "active" }] },
    { name: "En attente d'approbation", icon: "⏳", filters: [{ field: "status", operator: "eq", value: "pending" }] },
  ],
};

// ── Draggable column item ─────────────────────────────────────────────────────
function DraggableColumn({ col, visible, index, total, onToggle, onMoveUp, onMoveDown }: {
  col: ColumnDef; visible: boolean; index: number; total: number;
  onToggle: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${visible ? "bg-blue-50/50 border-blue-200" : "bg-muted/20 border-border"}`}>
      <div className="flex flex-col gap-0.5 shrink-0">
        <button onClick={onMoveUp} disabled={index === 0} className="h-4 w-4 flex items-center justify-center disabled:opacity-20 hover:text-foreground text-muted-foreground">
          <ArrowUp className="h-2.5 w-2.5" />
        </button>
        <button onClick={onMoveDown} disabled={index === total - 1} className="h-4 w-4 flex items-center justify-center disabled:opacity-20 hover:text-foreground text-muted-foreground">
          <ArrowDown className="h-2.5 w-2.5" />
        </button>
      </div>
      <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
      <span className={`text-sm flex-1 ${visible ? "font-medium text-blue-900" : "text-muted-foreground"}`}>{col.label}</span>
      <button onClick={onToggle}
        className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${visible ? "bg-blue-600 border-blue-600" : "border-gray-300 hover:border-gray-400"}`}>
        {visible && <Check className="h-3 w-3 text-white" />}
      </button>
    </div>
  );
}

// ── Filter row ────────────────────────────────────────────────────────────────
function FilterRow({ filter, index, columns, onChange, onDelete }: {
  filter: ViewFilter; index: number; columns: ColumnDef[];
  onChange: (patch: Partial<ViewFilter>) => void; onDelete: () => void;
}) {
  const col = columns.find(c => c.key === filter.field);
  const ops = OPS_BY_TYPE[col?.type ?? "string"] ?? OPS_BY_TYPE.string;

  return (
    <div className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2.5 border">
      {index > 0 && <span className="text-xs font-medium text-muted-foreground w-6 shrink-0">ET</span>}
      <Select value={filter.field} onValueChange={v => {
        const newCol = columns.find(c => c.key === v);
        const newOps = OPS_BY_TYPE[newCol?.type ?? "string"] ?? OPS_BY_TYPE.string;
        onChange({ field: v, label: newCol?.label, operator: newOps[0].op, value: "" });
      }}>
        <SelectTrigger className="h-8 text-sm w-40 bg-background"><SelectValue /></SelectTrigger>
        <SelectContent>{columns.filter(c => c.filterable !== false).map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filter.operator} onValueChange={v => onChange({ operator: v })}>
        <SelectTrigger className="h-8 text-sm w-32 bg-background"><SelectValue /></SelectTrigger>
        <SelectContent>{ops.map(op => <SelectItem key={op.op} value={op.op}>{op.label}</SelectItem>)}</SelectContent>
      </Select>
      {col?.filterOptions ? (
        <Select value={filter.value} onValueChange={v => onChange({ value: v })}>
          <SelectTrigger className="h-8 text-sm flex-1 bg-background"><SelectValue placeholder="Choisir…" /></SelectTrigger>
          <SelectContent>{col.filterOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
        </Select>
      ) : (
        <Input value={filter.value} onChange={e => onChange({ value: e.target.value })}
          className="h-8 text-sm flex-1 bg-background"
          type={col?.type === "date" ? "date" : (col?.type === "number" || col?.type === "amount") ? "number" : "text"}
          placeholder="Valeur…" />
      )}
      <button onClick={onDelete} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-100 hover:text-red-600 text-muted-foreground transition-colors shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── View Builder Dialog ───────────────────────────────────────────────────────
function ViewBuilderDialog({ open, onOpenChange, entity, entityLabel, columns, currentState, defaultColumns, editingView, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; entity: string; entityLabel: string;
  columns: ColumnDef[]; currentState: ViewState; defaultColumns?: string[];
  editingView: any; onSave: (def: any, id?: number) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [filters, setFilters] = useState<ViewFilter[]>([]);
  const [orderedCols, setOrderedCols] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [isShared, setIsShared] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<"filters" | "columns" | "sort">("filters");

  const suggestions = SMART_SUGGESTIONS[entity] ?? [];

  useEffect(() => {
    if (!open) return;
    const base = defaultColumns ?? columns.map(c => c.key);
    if (editingView) {
      setName(editingView.name ?? "");
      setFilters(editingView.filters ?? []);
      setOrderedCols(editingView.columns ?? base);
      setSortBy(editingView.sortBy ?? "");
      setSortDir(editingView.sortDir ?? "asc");
      setIsShared(editingView.isShared ?? false);
      setIsDefault(editingView.isDefault ?? false);
    } else {
      setName("");
      setFilters(currentState.filters ?? []);
      setOrderedCols(currentState.columns ?? base);
      setSortBy(currentState.sortBy ?? "");
      setSortDir(currentState.sortDir ?? "asc");
      setIsShared(false);
      setIsDefault(false);
    }
    setActiveSection("filters");
  }, [open, editingView]);

  const applySuggestion = (s: typeof suggestions[0]) => {
    setName(s.name);
    setFilters(s.filters.map(f => {
      const col = columns.find(c => c.key === f.field);
      const ops = OPS_BY_TYPE[col?.type ?? "string"] ?? OPS_BY_TYPE.string;
      return { field: f.field ?? "", operator: f.operator ?? ops[0].op, value: f.value ?? "", label: col?.label };
    }));
    if (s.sortBy) setSortBy(s.sortBy);
    if (s.sortDir) setSortDir(s.sortDir);
  };

  const addFilter = () => {
    const col = columns.find(c => c.filterable !== false) ?? columns[0];
    if (!col) return;
    const ops = OPS_BY_TYPE[col.type ?? "string"] ?? OPS_BY_TYPE.string;
    setFilters(f => [...f, { field: col.key, operator: ops[0].op, value: "", label: col.label }]);
  };

  const visibleCols = orderedCols.filter(k => columns.find(c => c.key === k));
  const allColsOrdered = [
    ...orderedCols.filter(k => columns.find(c => c.key === k)),
    ...columns.filter(c => !orderedCols.includes(c.key)).map(c => c.key),
  ];

  const toggleCol = (key: string) => {
    setOrderedCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const moveCol = (key: string, dir: "up" | "down") => {
    setOrderedCols(prev => {
      const arr = [...allColsOrdered];
      const idx = arr.indexOf(key);
      if (dir === "up" && idx > 0) [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      if (dir === "down" && idx < arr.length - 1) [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
      return arr.filter(k => orderedCols.includes(k) || (dir === "up" || dir === "down" ? true : false));
    });
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Le nom de la vue est requis"); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), entity, filters, columns: orderedCols, sortBy: sortBy || undefined, sortDir, displayType: "table", isShared, isDefault }, editingView?.id);
    } finally { setSaving(false); }
  };

  const SECTIONS = [
    { id: "filters", label: "Filtres", count: filters.length },
    { id: "columns", label: "Colonnes", count: visibleCols.length },
    { id: "sort", label: "Tri & Options" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="text-lg">{editingView ? `Modifier "${editingView.name}"` : `Nouvelle vue — ${entityLabel}`}</DialogTitle>
        </DialogHeader>

        {/* Name field */}
        <div className="px-6 pt-4 pb-0">
          <Input value={name} onChange={e => setName(e.target.value)}
            placeholder="Nom de la vue (ex: Mes demandes urgentes)"
            className="text-base font-medium h-11 border-2 focus:border-blue-500" />
        </div>

        {/* Smart suggestions */}
        {!editingView && suggestions.length > 0 && (
          <div className="px-6 pt-3 pb-0">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-blue-500" />Suggestions rapides
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => applySuggestion(s)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors">
                  <span>{s.icon}</span>{s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Section nav */}
        <div className="flex border-b mx-6 mt-4">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeSection === s.id ? "border-blue-600 text-blue-700" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {s.label}
              {"count" in s && s.count > 0 && (
                <span className="h-5 min-w-5 px-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center justify-center">{s.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Section content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-[280px]">

          {/* FILTERS */}
          {activeSection === "filters" && (
            <div className="space-y-2">
              {filters.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed p-8 text-center">
                  <SlidersHorizontal className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Aucun filtre appliqué</p>
                  <p className="text-xs text-muted-foreground mt-1">Tous les enregistrements seront affichés, ou choisissez une suggestion ci-dessus</p>
                  <button onClick={addFilter} className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
                    <Plus className="h-4 w-4" />Ajouter un filtre
                  </button>
                </div>
              ) : (
                <>
                  {filters.map((f, i) => (
                    <FilterRow key={i} filter={f} index={i} columns={columns}
                      onChange={patch => setFilters(prev => prev.map((r, j) => j === i ? { ...r, ...patch } : r))}
                      onDelete={() => setFilters(prev => prev.filter((_, j) => j !== i))} />
                  ))}
                  <button onClick={addFilter} className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 mt-2 py-1">
                    <Plus className="h-4 w-4" />Ajouter un filtre
                  </button>
                </>
              )}
            </div>
          )}

          {/* COLUMNS */}
          {activeSection === "columns" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1">
                <p className="text-sm text-muted-foreground">{visibleCols.length}/{columns.length} colonnes · Réorganisez avec les flèches</p>
                <div className="flex gap-2">
                  <button onClick={() => setOrderedCols(columns.map(c => c.key))}
                    className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors">Tout afficher</button>
                  <button onClick={() => setOrderedCols(columns.slice(0, 3).map(c => c.key))}
                    className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors">Minimaliste</button>
                </div>
              </div>
              {allColsOrdered.map((key, i) => {
                const col = columns.find(c => c.key === key);
                if (!col) return null;
                const visible = orderedCols.includes(key);
                return (
                  <DraggableColumn key={key} col={col} visible={visible} index={i} total={allColsOrdered.length}
                    onToggle={() => toggleCol(key)}
                    onMoveUp={() => {
                      const arr = [...allColsOrdered];
                      if (i > 0) { [arr[i-1], arr[i]] = [arr[i], arr[i-1]]; }
                      setOrderedCols(arr.filter(k => orderedCols.includes(k)));
                    }}
                    onMoveDown={() => {
                      const arr = [...allColsOrdered];
                      if (i < arr.length - 1) { [arr[i+1], arr[i]] = [arr[i], arr[i+1]]; }
                      setOrderedCols(arr.filter(k => orderedCols.includes(k)));
                    }} />
                );
              })}
            </div>
          )}

          {/* SORT & OPTIONS */}
          {activeSection === "sort" && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Trier par</Label>
                <div className="flex gap-2">
                  <Select value={sortBy || "none"} onValueChange={v => setSortBy(v === "none" ? "" : v)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Aucun tri" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun tri</SelectItem>
                      {columns.filter(c => c.sortable !== false).map(col => (
                        <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {sortBy && (
                    <div className="flex rounded-lg border overflow-hidden">
                      <button onClick={() => setSortDir("asc")}
                        className={`flex items-center gap-1 px-3 py-2 text-sm transition-colors ${sortDir === "asc" ? "bg-blue-600 text-white" : "hover:bg-muted"}`}>
                        <ArrowUp className="h-3.5 w-3.5" />A→Z
                      </button>
                      <button onClick={() => setSortDir("desc")}
                        className={`flex items-center gap-1 px-3 py-2 text-sm transition-colors border-l ${sortDir === "desc" ? "bg-blue-600 text-white" : "hover:bg-muted"}`}>
                        <ArrowDown className="h-3.5 w-3.5" />Z→A
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <Label className="text-sm font-medium">Partage & visibilité</Label>
                <div className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    {isShared ? <Globe className="h-4 w-4 text-blue-600" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium">{isShared ? "Partagée avec l'organisation" : "Vue privée"}</p>
                      <p className="text-xs text-muted-foreground">{isShared ? "Tous les membres peuvent utiliser cette vue" : "Visible par vous uniquement"}</p>
                    </div>
                  </div>
                  <Switch checked={isShared} onCheckedChange={setIsShared} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Star className={`h-4 w-4 ${isDefault ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`} />
                    <div>
                      <p className="text-sm font-medium">Vue par défaut</p>
                      <p className="text-xs text-muted-foreground">Chargée automatiquement à l'ouverture</p>
                    </div>
                  </div>
                  <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">
            {filters.length > 0 ? `${filters.length} filtre${filters.length > 1 ? "s" : ""} · ` : ""}
            {visibleCols.length} colonne{visibleCols.length > 1 ? "s" : ""}
            {sortBy ? ` · Trié par ${columns.find(c => c.key === sortBy)?.label}` : ""}
          </p>
          <div className="flex gap-2">
            <button onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
              Annuler
            </button>
            <button onClick={handleSave} disabled={!name.trim() || saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold btn-primary text-white disabled:opacity-50">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement...</> : <><Check className="h-4 w-4" />{editingView ? "Mettre à jour" : "Créer la vue"}</>}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ViewManager component ────────────────────────────────────────────────
export function ViewManager({ entity, entityLabel, columns, defaultColumns, value, onChange }: ViewManagerProps) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingView, setEditingView] = useState<any>(null);
  const [activeView, setActiveView] = useState<any>(null);

  const { data: views = [] } = trpc.views.list.useQuery({ entity });

  const createMut = trpc.views.create.useMutation({
    onSuccess: () => utils.views.list.invalidate(),
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = trpc.views.update.useMutation({
    onSuccess: () => utils.views.list.invalidate(),
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = trpc.views.delete.useMutation({
    onSuccess: () => { utils.views.list.invalidate(); setActiveView(null); },
    onError: (e: any) => toast.error(e.message),
  });

  // Auto-load default view on mount
  useEffect(() => {
    const defaultView = (views as any[]).find((v: any) => v.isDefault);
    if (defaultView && !activeView) applyView(defaultView, false);
  }, [views]);

  const applyView = (view: any, showToast = true) => {
    setActiveView(view);
    onChange({
      filters: view.filters ?? [],
      columns: view.columns,
      sortBy: view.sortBy,
      sortDir: view.sortDir ?? "asc",
      displayType: view.displayType ?? "table",
    });
    if (showToast) toast.success(`Vue "${view.name}" appliquée`);
  };

  const resetView = () => {
    setActiveView(null);
    onChange({ filters: [], columns: defaultColumns, sortBy: undefined, sortDir: "asc", displayType: "table" });
  };

  const handleSave = async (def: any, id?: number) => {
    if (id) {
      await updateMut.mutateAsync({ id, ...def });
      toast.success("Vue mise à jour");
    } else {
      const r = await createMut.mutateAsync(def);
      applyView({ id: r.id, ...def }, false);
      toast.success(`Vue "${def.name}" créée`);
    }
    setBuilderOpen(false);
    setEditingView(null);
  };

  const myViews = (views as any[]).filter((v: any) => v.userId === user?.id);
  const sharedViews = (views as any[]).filter((v: any) => v.isShared && v.userId !== user?.id);
  const activeFilterCount = value.filters?.length ?? 0;

  return (
    <div className="flex items-center gap-2">
      {/* Active view / filter indicator */}
      {activeView ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium">
          <Bookmark className="h-3.5 w-3.5" />
          <span>{activeView.name}</span>
          {activeView.isShared && <Globe className="h-3 w-3 text-blue-400" />}
          <button onClick={resetView} className="ml-1 hover:text-blue-900 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : activeFilterCount > 0 ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>{activeFilterCount} filtre{activeFilterCount > 1 ? "s" : ""} actif{activeFilterCount > 1 ? "s" : ""}</span>
          <button onClick={resetView} className="ml-1 hover:text-amber-900 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {/* Views dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
            <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
            Vues
            {(views as any[]).length > 0 && (
              <span className="h-4.5 min-w-4.5 px-1 rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                {(views as any[]).length}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {myViews.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mes vues</div>
              {myViews.map((v: any) => (
                <div key={v.id} className="flex items-center group">
                  <DropdownMenuItem className="flex-1 cursor-pointer" onClick={() => applyView(v)}>
                    <div className="flex items-center gap-2 w-full">
                      {v.isDefault && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                      {v.isShared && <Globe className="h-3 w-3 text-blue-500 shrink-0" />}
                      {!v.isDefault && !v.isShared && <Lock className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                      <span className="flex-1 truncate text-sm">{v.name}</span>
                      {v.filters?.length > 0 && (
                        <span className="text-[11px] text-muted-foreground">{v.filters.length} filtre{v.filters.length > 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </DropdownMenuItem>
                  <div className="hidden group-hover:flex items-center gap-0.5 pr-1">
                    <button onClick={() => { setEditingView(v); setBuilderOpen(true); }}
                      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button onClick={() => { if (confirm(`Supprimer "${v.name}" ?`)) deleteMut.mutate({ id: v.id }); }}
                      className="p-1 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
          {sharedViews.length > 0 && (
            <>
              {myViews.length > 0 && <DropdownMenuSeparator />}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Partagées</div>
              {sharedViews.map((v: any) => (
                <DropdownMenuItem key={v.id} className="cursor-pointer" onClick={() => applyView(v)}>
                  <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0 mr-2" />
                  <span className="flex-1 truncate text-sm">{v.name}</span>
                </DropdownMenuItem>
              ))}
            </>
          )}
          {(views as any[]).length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem className="cursor-pointer text-blue-700 font-medium" onClick={() => { setEditingView(null); setBuilderOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Créer une vue
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Quick new view button when no views */}
      {(views as any[]).length === 0 && (
        <button onClick={() => { setEditingView(null); setBuilderOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
          <Plus className="h-3.5 w-3.5" />Créer une vue
        </button>
      )}

      <ViewBuilderDialog
        open={builderOpen} onOpenChange={setBuilderOpen}
        entity={entity} entityLabel={entityLabel}
        columns={columns} currentState={value} defaultColumns={defaultColumns}
        editingView={editingView} onSave={handleSave}
      />
    </div>
  );
}
