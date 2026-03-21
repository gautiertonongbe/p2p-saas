import { PageHeader } from "@/components/PageHeader";
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  BarChart2, Download, Save, Play, Plus, Trash2, X,
  FileText, ChevronRight, LayoutGrid, Table2, LineChartIcon,
  BookOpen, RefreshCw, ChevronDown, ChevronUp, Share2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type FilterOp = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "in";
type FilterRow = { id: string; field: string; operator: FilterOp; value: string };
type SortDir = "asc" | "desc";
type ViewMode = "table" | "bar" | "line" | "pie";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
const fmtAmt = (n: number) => `${fmt(n)} XOF`;
const fmtDate = (d: string | Date | null) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";

const CHART_COLORS = ["#2563eb","#16a34a","#d97706","#dc2626","#7c3aed","#0891b2","#be185d","#065f46"];

const OP_LABELS: Record<FilterOp, string> = {
  eq: "égal à", ne: "différent de", gt: "supérieur à", gte: "supérieur ou égal à",
  lt: "inférieur à", lte: "inférieur ou égal à", contains: "contient", in: "dans la liste",
};

// ── Cell renderer ─────────────────────────────────────────────────────────────
function CellValue({ value, type }: { value: any; type: string }) {
  if (value == null || value === "") return <span className="text-muted-foreground">—</span>;
  if (type === "amount" || type === "number") {
    const n = parseFloat(value);
    return isNaN(n) ? <span>{value}</span> : <span className="font-mono text-right">{fmt(n)}</span>;
  }
  if (type === "date") return <span className="whitespace-nowrap">{fmtDate(value)}</span>;
  if (type === "status") return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border status-badge status-${String(value).toLowerCase().replace(/ /g, "_")}`}>
      {value}
    </span>
  );
  return <span>{String(value)}</span>;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReportBuilder() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Read deep-link params from Analytics quick-links
  const searchParams = useSearch();
  const urlParams = useMemo(() => searchParams ? new URLSearchParams(searchParams) : null, [searchParams]);

  // Builder state
  const [entity, setEntity] = useState<string>(() => urlParams?.get("entity") ?? "");
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [groupBy, setGroupBy] = useState<string>(() => urlParams?.get("groupBy") ?? "");
  const [sortBy, setSortBy] = useState<string>(() => urlParams?.get("sortBy") ?? "");
  const [sortDir, setSortDir] = useState<SortDir>(() => (urlParams?.get("sortDir") as SortDir) ?? "desc");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [chartX, setChartX] = useState<string>("");
  const [chartY, setChartY] = useState<string>("");
  const [limit, setLimit] = useState(500);

  // UI state
  const [reportName, setReportName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [runTrigger, setRunTrigger] = useState(0);

  // Data
  const { data: schema } = trpc.reports.getSchema.useQuery();
  const { data: savedReports, isLoading: savedLoading } = trpc.reports.listReports.useQuery();

  const entityDef = schema?.find(e => e.key === entity);
  const colDefs = entityDef?.columns ?? [];

  const queryInput = useMemo(() => ({
    entity,
    columns: selectedCols.length > 0 ? selectedCols : colDefs.map(c => c.key),
    filters: filters
      .filter(f => f.field && f.value)
      .map(f => ({ field: f.field, operator: f.operator, value: f.value })),
    groupBy: groupBy || undefined,
    sortBy: sortBy || undefined,
    sortDir,
    limit,
  }), [entity, selectedCols, filters, groupBy, sortBy, sortDir, limit, runTrigger]);

  const {
    data: result, isLoading: running, refetch,
  } = trpc.reports.runQuery.useQuery(queryInput as any, {
    enabled: hasRun && !!entity,
    staleTime: 0,
  });

  const saveMutation = trpc.reports.saveReport.useMutation({
    onSuccess: () => {
      toast.success(`Rapport "${reportName}" sauvegardé`);
      setSaveOpen(false);
      setReportName("");
      utils.reports.listReports.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = trpc.reports.deleteReport.useMutation({
    onSuccess: () => { toast.success("Rapport supprimé"); utils.reports.listReports.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleRun = () => {
    if (!entity) { toast.error("Sélectionnez une source de données"); return; }
    setHasRun(true);
    setRunTrigger(t => t + 1);
    setTimeout(() => refetch(), 50);
  };

  const loadReport = (r: any) => {
    const def = r.definition;
    if (!def) return;
    setEntity(def.entity || "");
    setSelectedCols(def.columns || []);
    setFilters((def.filters || []).map((f: any, i: number) => ({ id: `f${i}`, ...f })));
    setGroupBy(def.groupBy || "");
    setSortBy(def.sortBy || "");
    setSortDir(def.sortDir || "desc");
    setLimit(def.limit || 500);
    setSavedOpen(false);
    setHasRun(false);
    toast.success(`Rapport "${r.name}" chargé`);
  };

  const exportCSV = () => {
    if (!result?.rows?.length) return;
    const cols = selectedCols.length > 0 ? selectedCols : colDefs.map(c => c.key);
    const header = cols.map(c => getColLabel(c)).join(",");
    const rows = result.rows.map((r: any) =>
      cols.map(c => {
        const v = r[c] ?? "";
        return typeof v === "string" && v.includes(",") ? `"${v}"` : v;
      }).join(",")
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + "\n" + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `rapport_${entity}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const addFilter = () => setFilters(f => [...f, { id: `f${Date.now()}`, field: colDefs[0]?.key || "", operator: "eq", value: "" }]);
  const removeFilter = (id: string) => setFilters(f => f.filter(r => r.id !== id));
  const updateFilter = (id: string, patch: Partial<FilterRow>) =>
    setFilters(f => f.map(r => r.id === id ? { ...r, ...patch } : r));
  const toggleCol = (key: string) =>
    setSelectedCols(c => c.includes(key) ? c.filter(k => k !== key) : [...c, key]);

  const rows = result?.rows ?? [];
  const displayCols = groupBy
    ? Object.keys(rows[0] ?? {})
    : (selectedCols.length > 0 ? selectedCols : colDefs.map(c => c.key));

  const getColType = (key: string) => colDefs.find(c => c.key === key)?.type ?? "string";

  const getColLabel = (key: string): string => {
    if (key === "count") return "Nombre";
    if (key.endsWith("_sum")) return `${colDefs.find(c => c.key === key.replace("_sum",""))?.label ?? key.replace("_sum","")} (somme)`;
    if (key.endsWith("_avg")) return `${colDefs.find(c => c.key === key.replace("_avg",""))?.label ?? key.replace("_avg","")} (moyenne)`;
    return colDefs.find(c => c.key === key)?.label ?? key;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<BarChart2 className="h-5 w-5" />}
        title="Rapports"
        description="Créez des rapports personnalisés"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="h-7 w-7 text-primary" />
            Générateur de rapports
          </h1>
          <p className="text-muted-foreground mt-1">Créez des rapports personnalisés avec filtres, regroupements et graphiques</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSavedOpen(true)}>
            <BookOpen className="mr-2 h-4 w-4" />
            Rapports sauvegardés
            {(savedReports?.length ?? 0) > 0 && (
              <Badge className="ml-2 bg-primary/10 text-primary border-0">{savedReports?.length}</Badge>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">

        {/* ── LEFT: Builder panel ─────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Entity selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">1. Source de données</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={entity} onValueChange={v => { setEntity(v); setSelectedCols([]); setGroupBy(""); setSortBy(""); setFilters([]); setHasRun(false); }}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une source…" /></SelectTrigger>
                <SelectContent>
                  {schema?.map(e => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Column picker */}
          {entity && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">2. Colonnes</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedCols(colDefs.map(c => c.key))}>Tout</Button>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedCols([])}>Aucun</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 max-h-52 overflow-y-auto">
                {colDefs.map(col => (
                  <label key={col.key} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted/50 transition-colors ${selectedCols.includes(col.key) || selectedCols.length === 0 ? "bg-primary/5" : ""}`}>
                    <input type="checkbox"
                      checked={selectedCols.length === 0 || selectedCols.includes(col.key)}
                      onChange={() => toggleCol(col.key)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    <span className="text-sm">{col.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{col.type}</span>
                  </label>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          {entity && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">3. Filtres</CardTitle>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={addFilter}>
                    <Plus className="mr-1 h-3 w-3" />Ajouter
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {filters.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Aucun filtre — toutes les lignes</p>
                )}
                {filters.map(f => (
                  <div key={f.id} className="space-y-1.5 p-2.5 bg-muted/30 rounded-lg border">
                    <div className="flex gap-1.5">
                      <Select value={f.field} onValueChange={v => updateFilter(f.id, { field: v })}>
                        <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{colDefs.map(c => <SelectItem key={c.key} value={c.key} className="text-xs">{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeFilter(f.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Select value={f.operator} onValueChange={v => updateFilter(f.id, { operator: v as FilterOp })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(OP_LABELS).map(([k, l]) => <SelectItem key={k} value={k} className="text-xs">{l}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input value={f.value} onChange={e => updateFilter(f.id, { value: e.target.value })}
                      placeholder="Valeur…" className="h-7 text-xs" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* GroupBy + Sort */}
          {entity && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">4. Regroupement & Tri</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Regrouper par</Label>
                  <Select value={groupBy} onValueChange={setGroupBy}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Aucun regroupement" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {colDefs.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Trier par</Label>
                  <div className="flex gap-1.5">
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="Aucun tri" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {colDefs.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}>
                      {sortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Limite de lignes</Label>
                  <Select value={String(limit)} onValueChange={v => setLimit(Number(v))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[100, 250, 500, 1000, 2500, 5000].map(n => <SelectItem key={n} value={String(n)}>{n} lignes</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Run button */}
          {entity && (
            <Button onClick={handleRun} disabled={running} className="w-full">
              {running ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Exécution…</> : <><Play className="mr-2 h-4 w-4" />Exécuter le rapport</>}
            </Button>
          )}
        </div>

        {/* ── RIGHT: Results panel ────────────────────────────────────────── */}
        <div className="space-y-4 min-w-0">
          {!hasRun ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <BarChart2 className="h-14 w-14 text-muted-foreground/30 mb-4" />
                <p className="font-medium text-muted-foreground">Configurez votre rapport à gauche</p>
                <p className="text-sm text-muted-foreground mt-1">Choisissez une source, des colonnes, des filtres puis cliquez sur Exécuter</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {running ? "Chargement…" : `${result?.totalRows ?? 0} ligne${(result?.totalRows ?? 0) > 1 ? "s" : ""}`}
                  </span>
                  {result?.groupBy && (
                    <Badge variant="outline" className="text-xs">
                      Groupé par {colDefs.find(c => c.key === result.groupBy)?.label ?? result.groupBy}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* View mode */}
                  <div className="flex border rounded-lg overflow-hidden">
                    {([
                      { mode: "table", icon: Table2 },
                      { mode: "bar",   icon: BarChart2 },
                      { mode: "line",  icon: LineChartIcon },
                      { mode: "pie",   icon: LayoutGrid },
                    ] as { mode: ViewMode; icon: React.FC<any> }[]).map(({ mode, icon: Icon }) => (
                      <button key={mode} onClick={() => setViewMode(mode)}
                        className={`px-2.5 py-1.5 transition-colors ${viewMode === mode ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={exportCSV} disabled={!rows.length}>
                    <Download className="mr-2 h-4 w-4" />CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)} disabled={!entity}>
                    <Save className="mr-2 h-4 w-4" />Sauvegarder
                  </Button>
                </div>
              </div>

              {/* Chart axis selectors */}
              {viewMode !== "table" && rows.length > 0 && (
                <div className="flex gap-4 p-3 bg-muted/30 rounded-lg items-end flex-wrap">
                  <div className="space-y-1">
                    <Label className="text-xs">Axe X (catégorie)</Label>
                    <Select value={chartX} onValueChange={setChartX}>
                      <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                      <SelectContent>{displayCols.map(c => <SelectItem key={c} value={c}>{colDefs.find(d => d.key === c)?.label ?? c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Axe Y (valeur)</Label>
                    <Select value={chartY} onValueChange={setChartY}>
                      <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                      <SelectContent>
                        {displayCols.filter(c => {
                          const t = getColType(c);
                          return t === "amount" || t === "number" || c === "count" || c.endsWith("_sum") || c.endsWith("_avg");
                        }).map(c => <SelectItem key={c} value={c}>{colDefs.find(d => d.key === c)?.label ?? c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Results */}
              <Card>
                <CardContent className="p-0">
                  {running ? (
                    <div className="flex items-center justify-center py-16">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <FileText className="h-10 w-10 mb-3 opacity-30" />
                      <p>Aucune donnée pour ces critères</p>
                    </div>
                  ) : viewMode === "table" ? (
                    <div className="overflow-auto max-h-[600px]">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            {displayCols.map(col => (
                              <TableHead key={col}
                                className={`cursor-pointer hover:bg-muted/50 select-none whitespace-nowrap ${sortBy === col ? "text-primary" : ""}`}
                                onClick={() => { if (!groupBy) { setSortBy(col); setSortDir(d => sortBy === col && d === "desc" ? "asc" : "desc"); } }}>
                                <div className="flex items-center gap-1">
                                  {getColLabel(col)}
                                  {sortBy === col && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row: any, i: number) => (
                            <TableRow key={i} className="hover:bg-muted/30">
                              {displayCols.map(col => (
                                <TableCell key={col} className="whitespace-nowrap py-2">
                                  <CellValue value={row[col]} type={getColType(col)} />
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : viewMode === "bar" ? (
                    <div className="p-4">
                      <ResponsiveContainer width="100%" height={380}>
                        <BarChart data={rows.slice(0, 50)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
                          <XAxis dataKey={chartX || displayCols[0]} tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v)} />
                          <Tooltip formatter={(v: any) => fmt(Number(v))} />
                          <Bar dataKey={chartY || displayCols[1]} fill="#2563eb" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : viewMode === "line" ? (
                    <div className="p-4">
                      <ResponsiveContainer width="100%" height={380}>
                        <LineChart data={rows.slice(0, 50)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
                          <XAxis dataKey={chartX || displayCols[0]} tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v)} />
                          <Tooltip formatter={(v: any) => fmt(Number(v))} />
                          <Line dataKey={chartY || displayCols[1]} stroke="#2563eb" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="p-4">
                      <ResponsiveContainer width="100%" height={380}>
                        <PieChart>
                          <Pie data={rows.slice(0, 12)} dataKey={chartY || displayCols[1]} nameKey={chartX || displayCols[0]}
                            cx="50%" cy="50%" outerRadius={140} label={({ name, percent }) => `${String(name).slice(0,15)} ${(percent * 100).toFixed(0)}%`}>
                            {rows.slice(0, 12).map((_: any, i: number) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: any) => fmt(Number(v))} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Summary row for amounts */}
              {viewMode === "table" && rows.length > 0 && !groupBy && (() => {
                const amountCols = displayCols.filter(c => getColType(c) === "amount" || getColType(c) === "number");
                if (!amountCols.length) return null;
                const totals: Record<string, number> = {};
                for (const col of amountCols) {
                  totals[col] = rows.reduce((s: number, r: any) => s + (parseFloat(r[col]) || 0), 0);
                }
                return (
                  <div className="flex items-center gap-6 px-4 py-3 bg-muted/30 border-t text-sm flex-wrap">
                    <span className="font-medium text-muted-foreground">Totaux:</span>
                    {amountCols.map(col => (
                      <div key={col} className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{colDefs.find(c => c.key === col)?.label ?? col}:</span>
                        <span className="font-semibold">{fmt(totals[col])}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {/* Save Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Sauvegarder le rapport</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2">
            <Label>Nom du rapport *</Label>
            <Input value={reportName} onChange={e => setReportName(e.target.value)} placeholder="Ex: Dépenses par fournisseur Q1 2026" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Annuler</Button>
            <Button disabled={!reportName.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate({
                name: reportName.trim(),
                definition: {
                  entity,
                  columns: selectedCols.length > 0 ? selectedCols : colDefs.map(c => c.key),
                  filters: filters.filter(f => f.field && f.value).map(f => ({ field: f.field, operator: f.operator, value: f.value })),
                  groupBy: groupBy || undefined,
                  sortBy: sortBy || undefined,
                  sortDir,
                  limit,
                },
              })}>
              {saveMutation.isPending ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saved Reports Dialog */}
      <Dialog open={savedOpen} onOpenChange={setSavedOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Rapports sauvegardés</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2 py-2">
            {savedLoading ? (
              <p className="text-center text-muted-foreground py-8">Chargement…</p>
            ) : !savedReports?.length ? (
              <div className="text-center text-muted-foreground py-10">
                <BookOpen className="mx-auto h-10 w-10 mb-3 opacity-30" />
                <p>Aucun rapport sauvegardé</p>
                <p className="text-xs mt-1">Créez et sauvegardez un rapport pour le retrouver ici</p>
              </div>
            ) : savedReports.map(r => {
              const entityLabel = schema?.find(e => e.key === r.entity)?.label ?? r.entity;
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="p-2 bg-primary/10 rounded-lg shrink-0"><FileText className="h-4 w-4 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{entityLabel} · {new Date(r.createdAt).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => loadReport(r)}>
                      <ChevronRight className="mr-1 h-3.5 w-3.5" />Charger
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm("Supprimer ce rapport ?")) deleteMutation.mutate({ id: r.id }); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
