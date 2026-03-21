/**
 * ViewManager — Reusable custom views component
 *
 * Drop this into any list page to give users Coupa-style saved views:
 * - Filter conditions (field + operator + value)
 * - Column visibility control
 * - Sort preferences
 * - Display type (table / cards / compact)
 * - Private or shared with the whole organisation
 * - Set as default (auto-loads on page open)
 * - Duplicate and edit existing views
 */
import React, { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Separator } from "./ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Bookmark, Plus, ChevronDown, Star, Globe, Lock, Edit2, Trash2,
  Copy, X, Table2, LayoutGrid, AlignJustify, Check, SlidersHorizontal,
  Eye, EyeOff, ArrowUpDown,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
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
  key: string;
  label: string;
  filterable?: boolean;
  sortable?: boolean;
  type?: "string" | "number" | "date" | "status" | "amount";
  filterOptions?: { value: string; label: string }[];
}

interface ViewManagerProps {
  entity: string;
  entityLabel: string;
  columns: ColumnDef[];
  value: ViewState;
  onChange: (state: ViewState) => void;
  defaultColumns?: string[];
}

// ── Filter operators by type ──────────────────────────────────────────────────
const OPS_BY_TYPE: Record<string, { op: string; label: string }[]> = {
  string: [
    { op: "contains", label: "contient" },
    { op: "eq",       label: "égal à" },
    { op: "ne",       label: "différent de" },
  ],
  status: [
    { op: "eq",  label: "est" },
    { op: "ne",  label: "n'est pas" },
    { op: "in",  label: "est dans" },
  ],
  number: [
    { op: "eq",  label: "=" },
    { op: "ne",  label: "≠" },
    { op: "gt",  label: ">" },
    { op: "gte", label: "≥" },
    { op: "lt",  label: "<" },
    { op: "lte", label: "≤" },
  ],
  amount: [
    { op: "eq",  label: "=" },
    { op: "gt",  label: ">" },
    { op: "gte", label: "≥" },
    { op: "lt",  label: "<" },
    { op: "lte", label: "≤" },
  ],
  date: [
    { op: "eq",  label: "le" },
    { op: "gt",  label: "après le" },
    { op: "gte", label: "à partir du" },
    { op: "lt",  label: "avant le" },
    { op: "lte", label: "jusqu'au" },
  ],
};

const DISPLAY_ICONS: Record<DisplayType, React.FC<any>> = {
  table:   Table2,
  cards:   LayoutGrid,
  compact: AlignJustify,
};

const DISPLAY_LABELS: Record<DisplayType, string> = {
  table:   "Tableau",
  cards:   "Cartes",
  compact: "Compact",
};

// ── Main component ────────────────────────────────────────────────────────────
export function ViewManager({ entity, entityLabel, columns, value, onChange, defaultColumns }: ViewManagerProps) {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingView, setEditingView] = useState<any>(null);
  const [activeViewId, setActiveViewId] = useState<number | null>(null);

  const { data: views = [] } = trpc.views.list.useQuery({ entity });
  const createMut = trpc.views.create.useMutation({
    onSuccess: () => { utils.views.list.invalidate({ entity }); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = trpc.views.update.useMutation({
    onSuccess: () => { utils.views.list.invalidate({ entity }); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = trpc.views.delete.useMutation({
    onSuccess: () => { utils.views.list.invalidate({ entity }); toast.success("Vue supprimée"); },
    onError: (e: any) => toast.error(e.message),
  });
  const setDefaultMut = trpc.views.setDefault.useMutation({
    onSuccess: () => { utils.views.list.invalidate({ entity }); toast.success("Vue définie par défaut"); },
    onError: (e: any) => toast.error(e.message),
  });
  const duplicateMut = trpc.views.duplicate.useMutation({
    onSuccess: () => { utils.views.list.invalidate({ entity }); toast.success("Vue dupliquée"); },
    onError: (e: any) => toast.error(e.message),
  });

  // Auto-apply default view on mount
  useEffect(() => {
    const defaultView = (views as any[]).find((v: any) => v.isDefault);
    if (defaultView && activeViewId === null) {
      applyView(defaultView, false);
      setActiveViewId(defaultView.id);
    }
  }, [views]);

  const applyView = (v: any, notify = true) => {
    onChange({
      filters: v.filters ?? [],
      columns: v.columns ?? defaultColumns,
      sortBy: v.sortBy ?? undefined,
      sortDir: (v.sortDir as "asc" | "desc") ?? "asc",
      displayType: (v.displayType as DisplayType) ?? "table",
    });
    setActiveViewId(v.id);
    if (notify) toast.success(`Vue "${v.name}" appliquée`);
  };

  const clearView = () => {
    onChange({ filters: [], columns: defaultColumns, sortBy: undefined, sortDir: "asc", displayType: "table" });
    setActiveViewId(null);
  };

  const activeView = (views as any[]).find((v: any) => v.id === activeViewId);
  const hasActiveFilters = value.filters.length > 0 || value.sortBy;
  const sharedViews = (views as any[]).filter((v: any) => v.isShared && v.userId !== user?.id);
  const myViews = (views as any[]).filter((v: any) => v.userId === user?.id);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Active view pill */}
      {activeView ? (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-sm">
          <Bookmark className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-primary">{activeView.name}</span>
          {activeView.isShared ? <Globe className="h-3 w-3 text-primary/60 ml-1" /> : <Lock className="h-3 w-3 text-primary/60 ml-1" />}
          <button onClick={clearView} className="ml-1 text-primary/60 hover:text-primary"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : hasActiveFilters ? (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-full text-sm text-yellow-800">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>{value.filters.length} filtre{value.filters.length > 1 ? "s" : ""} actif{value.filters.length > 1 ? "s" : ""}</span>
          <button onClick={clearView} className="ml-1 text-yellow-600 hover:text-yellow-900"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}

      {/* Views dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Bookmark className="h-4 w-4" />
            Vues
            {views.length > 0 && <Badge className="bg-muted text-muted-foreground border-0 h-4 px-1 text-[10px]">{views.length}</Badge>}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="px-2 py-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mes vues</p>
          </div>
          {myViews.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Aucune vue personnelle</div>
          ) : myViews.map((v: any) => (
            <div key={v.id} className={`flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 rounded cursor-pointer group ${activeViewId === v.id ? "bg-primary/5" : ""}`}
              onClick={() => applyView(v)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {v.isDefault && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                  <span className="text-sm font-medium truncate">{v.name}</span>
                  {v.isShared && <Globe className="h-3 w-3 text-muted-foreground shrink-0" />}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {v.filters?.length > 0 && <span className="text-xs text-muted-foreground">{v.filters.length} filtre{v.filters.length > 1 ? "s" : ""}</span>}
                  <span className="text-xs text-muted-foreground">{DISPLAY_LABELS[v.displayType as DisplayType] ?? v.displayType}</span>
                </div>
              </div>
              {activeViewId === v.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button className="p-1 hover:bg-muted rounded" onClick={e => { e.stopPropagation(); setEditingView(v); setBuilderOpen(true); }}>
                  <Edit2 className="h-3 w-3" />
                </button>
                <button className="p-1 hover:bg-muted rounded" onClick={e => { e.stopPropagation(); duplicateMut.mutate({ id: v.id }); }}>
                  <Copy className="h-3 w-3" />
                </button>
                <button className="p-1 hover:bg-muted rounded text-destructive" onClick={e => { e.stopPropagation(); if (confirm(`Supprimer "${v.name}" ?`)) deleteMut.mutate({ id: v.id }); }}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}

          {sharedViews.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Partagées par l'organisation</p>
              </div>
              {sharedViews.map((v: any) => (
                <div key={v.id} className={`flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 rounded cursor-pointer group ${activeViewId === v.id ? "bg-primary/5" : ""}`}
                  onClick={() => applyView(v)}>
                  <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{v.name}</span>
                    {v.description && <span className="text-xs text-muted-foreground truncate block">{v.description}</span>}
                  </div>
                  {activeViewId === v.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  <button className="hidden group-hover:block p-1 hover:bg-muted rounded" onClick={e => { e.stopPropagation(); duplicateMut.mutate({ id: v.id }); }}>
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setEditingView(null); setBuilderOpen(true); }} className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            Créer une nouvelle vue
          </DropdownMenuItem>
          {activeViewId && (
            <DropdownMenuItem onClick={() => { const v = views.find((x: any) => x.id === activeViewId) as any; if (v) setDefaultMut.mutate({ id: v.id, entity }); }} className="cursor-pointer">
              <Star className="mr-2 h-4 w-4" />
              Définir comme vue par défaut
            </DropdownMenuItem>
          )}
          {hasActiveFilters && !activeViewId && (
            <DropdownMenuItem onClick={() => { setEditingView(null); setBuilderOpen(true); }} className="cursor-pointer text-primary">
              <Bookmark className="mr-2 h-4 w-4" />
              Sauvegarder la vue actuelle
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View Builder Dialog */}
      <ViewBuilderDialog
        open={builderOpen}
        onOpenChange={open => { setBuilderOpen(open); if (!open) setEditingView(null); }}
        entity={entity}
        entityLabel={entityLabel}
        columns={columns}
        currentState={value}
        defaultColumns={defaultColumns}
        editingView={editingView}
        onSave={async (def, viewId) => {
          if (viewId) {
            await updateMut.mutateAsync({ id: viewId, ...def });
            toast.success(`Vue "${def.name}" mise à jour`);
          } else {
            const r = await createMut.mutateAsync(def);
            applyView({ id: r.id, ...def }, false);
            toast.success(`Vue "${def.name}" créée et appliquée`);
          }
          setBuilderOpen(false);
          setEditingView(null);
        }}
      />
    </div>
  );
}

// ── View Builder Dialog ───────────────────────────────────────────────────────
function ViewBuilderDialog({
  open, onOpenChange, entity, entityLabel, columns, currentState, defaultColumns, editingView, onSave,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; entity: string; entityLabel: string;
  columns: ColumnDef[]; currentState: ViewState; defaultColumns?: string[];
  editingView: any; onSave: (def: any, id?: number) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filters, setFilters] = useState<ViewFilter[]>([]);
  const [visibleCols, setVisibleCols] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [displayType, setDisplayType] = useState<DisplayType>("table");
  const [isShared, setIsShared] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"filters" | "columns" | "sort" | "display">("filters");

  // Populate from editingView or currentState
  useEffect(() => {
    if (!open) return;
    if (editingView) {
      setName(editingView.name ?? "");
      setDescription(editingView.description ?? "");
      setFilters(editingView.filters ?? []);
      setVisibleCols(editingView.columns ?? defaultColumns ?? columns.map(c => c.key));
      setSortBy(editingView.sortBy ?? "");
      setSortDir(editingView.sortDir ?? "asc");
      setDisplayType(editingView.displayType ?? "table");
      setIsShared(editingView.isShared ?? false);
      setIsDefault(editingView.isDefault ?? false);
    } else {
      setName("");
      setDescription("");
      setFilters(currentState.filters ?? []);
      setVisibleCols(currentState.columns ?? defaultColumns ?? columns.map(c => c.key));
      setSortBy(currentState.sortBy ?? "");
      setSortDir(currentState.sortDir ?? "asc");
      setDisplayType(currentState.displayType ?? "table");
      setIsShared(false);
      setIsDefault(false);
    }
  }, [open, editingView]);

  const addFilter = () => {
    const col = columns.find(c => c.filterable !== false) ?? columns[0];
    if (!col) return;
    const ops = OPS_BY_TYPE[col.type ?? "string"] ?? OPS_BY_TYPE.string;
    setFilters(f => [...f, { field: col.key, operator: ops[0].op, value: "", label: col.label }]);
  };

  const updateFilter = (i: number, patch: Partial<ViewFilter>) => {
    setFilters(f => f.map((r, idx) => {
      if (idx !== i) return r;
      const updated = { ...r, ...patch };
      if (patch.field) {
        const col = columns.find(c => c.key === patch.field);
        updated.label = col?.label ?? patch.field;
        const ops = OPS_BY_TYPE[col?.type ?? "string"] ?? OPS_BY_TYPE.string;
        updated.operator = ops[0].op;
        updated.value = "";
      }
      return updated;
    }));
  };

  const getOps = (field: string) => {
    const col = columns.find(c => c.key === field);
    return OPS_BY_TYPE[col?.type ?? "string"] ?? OPS_BY_TYPE.string;
  };

  const getCol = (field: string) => columns.find(c => c.key === field);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Le nom de la vue est requis"); return; }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        entity,
        filters,
        columns: visibleCols,
        sortBy: sortBy || undefined,
        sortDir,
        displayType,
        isShared,
        isDefault,
      }, editingView?.id);
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { id: "filters", label: "Filtres", badge: filters.length || undefined },
    { id: "columns", label: "Colonnes" },
    { id: "sort",    label: "Tri" },
    { id: "display", label: "Affichage" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editingView ? `Modifier "${editingView.name}"` : `Nouvelle vue — ${entityLabel}`}</DialogTitle>
          <DialogDescription>Configurez les filtres, colonnes, tri et mode d'affichage de cette vue.</DialogDescription>
        </DialogHeader>

        {/* Name & description */}
        <div className="grid grid-cols-2 gap-3 pb-2">
          <div className="space-y-1">
            <Label className="text-xs">Nom de la vue *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Demandes urgentes Q1" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optionnel" />
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b gap-0">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {tab.label}
              {tab.badge ? <Badge className="bg-primary text-primary-foreground text-[10px] h-4 px-1">{tab.badge}</Badge> : null}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 min-h-0">

          {/* FILTERS TAB */}
          {activeTab === "filters" && (
            <div className="space-y-3">
              {filters.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <SlidersHorizontal className="mx-auto h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Aucun filtre — toutes les données seront affichées</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={addFilter}>
                    <Plus className="mr-2 h-4 w-4" />Ajouter un filtre
                  </Button>
                </div>
              ) : (
                <>
                  {filters.map((f, i) => {
                    const col = getCol(f.field);
                    const ops = getOps(f.field);
                    return (
                      <div key={i} className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg border">
                        {/* Field */}
                        <Select value={f.field} onValueChange={v => updateFilter(i, { field: v })}>
                          <SelectTrigger className="h-8 text-sm w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {columns.filter(c => c.filterable !== false).map(c => (
                              <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {/* Operator */}
                        <Select value={f.operator} onValueChange={v => updateFilter(i, { operator: v })}>
                          <SelectTrigger className="h-8 text-sm w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ops.map(op => <SelectItem key={op.op} value={op.op}>{op.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {/* Value */}
                        {col?.filterOptions ? (
                          <Select value={f.value} onValueChange={v => updateFilter(i, { value: v })}>
                            <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="Valeur…" /></SelectTrigger>
                            <SelectContent>
                              {col.filterOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input value={f.value} onChange={e => updateFilter(i, { value: e.target.value })}
                            className="h-8 text-sm flex-1"
                            type={col?.type === "date" ? "date" : col?.type === "number" || col?.type === "amount" ? "number" : "text"}
                            placeholder="Valeur…" />
                        )}
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => setFilters(f => f.filter((_, j) => j !== i))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  <Button variant="outline" size="sm" onClick={addFilter}>
                    <Plus className="mr-2 h-4 w-4" />Ajouter un filtre
                  </Button>
                </>
              )}
            </div>
          )}

          {/* COLUMNS TAB */}
          {activeTab === "columns" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2">
                <p className="text-sm text-muted-foreground">{visibleCols.length} / {columns.length} colonnes visibles</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setVisibleCols(columns.map(c => c.key))}>Tout afficher</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setVisibleCols([columns[0]?.key].filter(Boolean))}>Minimaliste</Button>
                </div>
              </div>
              {columns.map(col => {
                const visible = visibleCols.includes(col.key);
                return (
                  <div key={col.key}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${visible ? "bg-primary/5 border-primary/20" : "border-border hover:bg-muted/30"}`}
                    onClick={() => setVisibleCols(v => visible ? v.filter(k => k !== col.key) : [...v, col.key])}>
                    <div className={`shrink-0 ${visible ? "text-primary" : "text-muted-foreground"}`}>
                      {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </div>
                    <span className={`text-sm flex-1 ${visible ? "font-medium" : "text-muted-foreground"}`}>{col.label}</span>
                    <span className="text-xs text-muted-foreground">{col.type ?? "texte"}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* SORT TAB */}
          {activeTab === "sort" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Trier par</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger><SelectValue placeholder="Aucun tri par défaut" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {columns.filter(c => c.sortable !== false).map(col => (
                      <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {sortBy && (
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <div className="flex gap-3">
                    {(["asc", "desc"] as const).map(dir => (
                      <button key={dir} onClick={() => setSortDir(dir)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm transition-colors ${sortDir === dir ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/50"}`}>
                        <ArrowUpDown className="h-4 w-4" />
                        {dir === "asc" ? "Croissant (A→Z, 0→9)" : "Décroissant (Z→A, 9→0)"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DISPLAY TAB */}
          {activeTab === "display" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Mode d'affichage</Label>
                <div className="grid grid-cols-3 gap-3">
                  {(["table", "cards", "compact"] as DisplayType[]).map(mode => {
                    const Icon = DISPLAY_ICONS[mode];
                    return (
                      <button key={mode} onClick={() => setDisplayType(mode)}
                        className={`flex flex-col items-center gap-2 py-4 rounded-lg border-2 transition-colors ${displayType === mode ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                        <Icon className={`h-6 w-6 ${displayType === mode ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-medium ${displayType === mode ? "text-primary" : "text-muted-foreground"}`}>{DISPLAY_LABELS[mode]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Sharing & default */}
        <div className="flex items-center gap-6 py-2 flex-wrap">
          <div className="flex items-center gap-3">
            {isShared ? <Globe className="h-4 w-4 text-blue-600" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
            <div>
              <p className="text-sm font-medium">{isShared ? "Partagée avec l'organisation" : "Vue privée"}</p>
              <p className="text-xs text-muted-foreground">{isShared ? "Visible par tous les membres" : "Visible par vous uniquement"}</p>
            </div>
            <Switch checked={isShared} onCheckedChange={setIsShared} />
          </div>
          <div className="flex items-center gap-3">
            <Star className={`h-4 w-4 ${isDefault ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
            <div>
              <p className="text-sm font-medium">Vue par défaut</p>
              <p className="text-xs text-muted-foreground">Chargée automatiquement à l'ouverture</p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button className="btn-primary text-white" disabled={!name.trim() || saving} onClick={handleSave}>
            {saving ? "Enregistrement…" : editingView ? "Mettre à jour" : "Créer la vue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
