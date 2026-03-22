import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  TrendingDown, Plus, Target, Award, BarChart2, Zap,
  ShoppingCart, FileText, Settings, ChevronRight, X, Save
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const TYPE_LABELS: Record<string, string> = {
  price_negotiation:    "Négociation prix",
  volume_discount:      "Remise volume",
  alternative_vendor:   "Fournisseur alternatif",
  process_improvement:  "Amélioration processus",
  contract_renegotiation: "Renégociation contrat",
  other:                "Autre",
};
const TYPE_COLORS: Record<string, string> = {
  price_negotiation:    "bg-blue-100 text-blue-700",
  volume_discount:      "bg-purple-100 text-purple-700",
  alternative_vendor:   "bg-emerald-100 text-emerald-700",
  process_improvement:  "bg-amber-100 text-amber-700",
  contract_renegotiation:"bg-cyan-100 text-cyan-700",
  other:                "bg-gray-100 text-gray-700",
};
const SOURCE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  auto_po:    { label: "BC vs DA", icon: ShoppingCart, color: "text-emerald-600" },
  auto_rfq:   { label: "Appel d'offres", icon: BarChart2, color: "text-blue-600" },
  manual:     { label: "Saisie manuelle", icon: Settings, color: "text-gray-500" },
};
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtPct = (n: number) => n.toFixed(1) + "%";

export default function SavingsTracker() {
  const utils = trpc.useUtils();
  const year = new Date().getFullYear();
  const [showManual, setShowManual] = useState(false);

  // Form state for manual entry
  const [title, setTitle]           = useState("");
  const [savingsType, setSavingsType] = useState("price_negotiation");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [actualAmount, setActualAmount] = useState("");
  const [notes, setNotes]           = useState("");
  const [vendorId, setVendorId]     = useState("");

  const { data: records = [] } = trpc.savings.list.useQuery();
  const { data: stats }        = trpc.savings.getStats.useQuery({ year });
  const { data: vendors = [] } = trpc.vendors.list.useQuery();

  const createMut = trpc.savings.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Économie enregistrée : ${fmt(data.savingsAmount)} XOF (${data.savingsPercent.toFixed(1)}%)`);
      utils.savings.list.invalidate();
      utils.savings.getStats.invalidate();
      setShowManual(false);
      setTitle(""); setBudgetAmount(""); setActualAmount(""); setNotes(""); setVendorId("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    const budget = parseFloat(budgetAmount);
    const actual = parseFloat(actualAmount);
    if (!budget || !actual) { toast.error("Montants requis"); return; }
    if (actual >= budget) { toast.error("Le montant réel doit être inférieur au budget"); return; }
    createMut.mutate({
      title: title.trim(), savingsType: savingsType as any,
      budgetAmount: budget, actualAmount: actual,
      notes: notes || undefined,
      vendorId: vendorId ? parseInt(vendorId) : undefined,
    });
  };

  const totalSavings = Number((stats as any)?.totalSavings || 0);
  const count        = Number((stats as any)?.savingsCount || 0);
  const avgPct       = Number((stats as any)?.avgSavingsPct || 0);
  const byMonth: any[] = (stats as any)?.byMonth || [];
  const byType: any[]  = (stats as any)?.byType  || [];
  const maxMonth = Math.max(...byMonth.map((m: any) => Number(m.total)), 1);
  const estimatedSavings = parseFloat(budgetAmount) && parseFloat(actualAmount)
    ? parseFloat(budgetAmount) - parseFloat(actualAmount) : 0;

  // Split auto vs manual
  const autoRecords   = (records as any[]).filter(r => r.notes?.includes("Calculé automatiquement") || r.source === "auto_po" || r.source === "auto_rfq");
  const manualRecords = (records as any[]).filter(r => !r.notes?.includes("Calculé automatiquement") && r.source !== "auto_po" && r.source !== "auto_rfq");

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<TrendingDown className="h-5 w-5" />}
        title="Suivi des économies"
        description={`Économies réalisées en ${year} — calculées automatiquement depuis vos achats`}
        action={
          <button onClick={() => setShowManual(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Plus className="h-4 w-4" />Saisie manuelle
          </button>
        }
      />

      {/* How it works banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-4">
        <Zap className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Économies calculées automatiquement</p>
          <p className="text-sm text-blue-600 mt-0.5">
            Chaque fois qu'un BC est créé à un prix inférieur à l'estimation de la DA, l'économie est enregistrée automatiquement.
            Les AOs calculent aussi l'économie vs l'offre la plus haute.
            La saisie manuelle est disponible pour les économies hors-système (renégociations de contrats, etc.).
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-blue-700">
            <span className="flex items-center gap-1"><ShoppingCart className="h-3.5 w-3.5" />BC créé &lt; estimation DA → économie auto</span>
            <span className="flex items-center gap-1"><BarChart2 className="h-3.5 w-3.5" />AO attribué → économie vs offre la plus haute</span>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Économies totales", value: `${fmt(totalSavings)} XOF`, sub: `${count} opération${count > 1 ? "s" : ""}`, icon: TrendingDown, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Économie moyenne", value: fmtPct(avgPct), sub: "par opération", icon: Target, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Objectif annuel", value: "—", sub: "à configurer", icon: Award, color: "text-purple-600", bg: "bg-purple-50" },
        ].map(({ label, value, sub, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />Économies par mois — {year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byMonth.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <TrendingDown className="h-8 w-8 mx-auto mb-2 opacity-20" />
                Aucune économie encore — créez votre premier BC à prix négocié
              </div>
            ) : (
              <div className="flex items-end gap-1 h-28">
                {MONTHS.map((m, i) => {
                  const row = byMonth.find((b: any) => Number(b.month) === i + 1);
                  const val = row ? Number(row.total) : 0;
                  const h = (val / maxMonth) * 100;
                  return (
                    <div key={m} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-emerald-100 rounded-t relative" style={{ height: `${Math.max(h, 2)}%` }}>
                        {val > 0 && <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-emerald-700 font-medium whitespace-nowrap">{fmt(val)}</div>}
                      </div>
                      <span className="text-[9px] text-muted-foreground">{m}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
              <Target className="h-4 w-4" />Par type d'économie
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byType.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Aucune donnée encore</p>
            ) : (
              <div className="space-y-2">
                {byType.map((t: any) => {
                  const pct = totalSavings > 0 ? (Number(t.total) / totalSavings) * 100 : 0;
                  return (
                    <div key={t.savingsType}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[t.savingsType] || "bg-gray-100 text-gray-700"}`}>
                          {TYPE_LABELS[t.savingsType] || t.savingsType}
                        </span>
                        <span className="font-semibold">{fmt(Number(t.total))} XOF</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Records list */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />Détail des économies
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(records as any[]).length === 0 ? (
            <div className="text-center py-12">
              <TrendingDown className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">Aucune économie enregistrée</p>
              <p className="text-sm text-muted-foreground mt-1">
                Les économies apparaîtront automatiquement lors de la création de BCs à prix négociés.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Auto-calculated first */}
              {autoRecords.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Zap className="h-3 w-3 text-emerald-500" />Calculées automatiquement ({autoRecords.length})
                  </p>
                  {autoRecords.map((r: any) => <SavingsRow key={r.id} r={r} />)}
                </div>
              )}
              {manualRecords.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Settings className="h-3 w-3" />Saisie manuelle ({manualRecords.length})
                  </p>
                  {manualRecords.map((r: any) => <SavingsRow key={r.id} r={r} />)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual entry dialog */}
      <Dialog open={showManual} onOpenChange={setShowManual}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Saisie manuelle d'une économie</DialogTitle>
            <DialogDescription>
              Pour les économies non capturées automatiquement (renégociations de contrats, optimisations processus, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Titre *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Renégociation contrat fournitures bureau" />
            </div>
            <div className="space-y-1.5">
              <Label>Type d'économie</Label>
              <select value={savingsType} onChange={e => setSavingsType(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input text-sm">
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Budget initial (XOF) *</Label>
                <Input type="number" value={budgetAmount} onChange={e => setBudgetAmount(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Montant réel payé (XOF) *</Label>
                <Input type="number" value={actualAmount} onChange={e => setActualAmount(e.target.value)} placeholder="0" />
              </div>
            </div>
            {estimatedSavings > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 flex justify-between items-center">
                <span className="text-sm text-emerald-700">Économie calculée</span>
                <span className="font-bold text-emerald-700">
                  {fmt(estimatedSavings)} XOF ({((estimatedSavings / parseFloat(budgetAmount)) * 100).toFixed(1)}%)
                </span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Fournisseur <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <select value={vendorId} onChange={e => setVendorId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input text-sm">
                <option value="">— Sélectionner —</option>
                {(vendors as any[]).map((v: any) => (
                  <option key={v.id} value={v.id}>{v.legalName}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Contexte, méthode, résultat de la négociation..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManual(false)}>Annuler</Button>
            <button onClick={handleSave} disabled={createMut.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg btn-primary text-white text-sm font-semibold disabled:opacity-50">
              <Save className="h-4 w-4" />{createMut.isPending ? "Enregistrement..." : "Enregistrer"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SavingsRow({ r }: { r: any }) {
  const isAuto = r.notes?.includes("Calculé automatiquement") || r.source === "auto_po";
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {isAuto
          ? <Zap className="h-4 w-4 text-emerald-500 shrink-0" />
          : <Settings className="h-4 w-4 text-gray-400 shrink-0" />}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{r.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[r.savingsType] || "bg-gray-100 text-gray-600"}`}>
              {TYPE_LABELS[r.savingsType] || r.savingsType}
            </span>
            {r.vendorName && <span className="text-xs text-muted-foreground">· {r.vendorName}</span>}
            <span className="text-xs text-muted-foreground">
              · {new Date(r.createdAt).toLocaleDateString("fr-FR")}
            </span>
          </div>
        </div>
      </div>
      <div className="text-right shrink-0 ml-4">
        <p className="text-sm font-bold text-emerald-600">+{new Intl.NumberFormat("fr-FR").format(Math.round(r.savingsAmount))} XOF</p>
        <p className="text-xs text-muted-foreground">{Number(r.savingsPercent).toFixed(1)}% économisé</p>
      </div>
    </div>
  );
}
