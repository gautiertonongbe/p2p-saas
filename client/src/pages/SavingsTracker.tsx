import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TrendingDown, Plus, Target, Award, BarChart2, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  price_negotiation: "Négociation prix", volume_discount: "Remise volume",
  alternative_vendor: "Fournisseur alternatif", process_improvement: "Amélioration processus",
  contract_renegotiation: "Renégociation contrat", other: "Autre",
};

const TYPE_COLORS: Record<string, string> = {
  price_negotiation: "bg-blue-100 text-blue-700", volume_discount: "bg-purple-100 text-purple-700",
  alternative_vendor: "bg-emerald-100 text-emerald-700", process_improvement: "bg-amber-100 text-amber-700",
  contract_renegotiation: "bg-cyan-100 text-cyan-700", other: "bg-gray-100 text-gray-700",
};

const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

export default function SavingsTracker() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const year = new Date().getFullYear();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [savingsType, setSavingsType] = useState("price_negotiation");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [actualAmount, setActualAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [vendorId, setVendorId] = useState("");

  const { data: records = [] } = trpc.savings.list.useQuery();
  const { data: stats } = trpc.savings.getStats.useQuery({ year });
  const { data: vendors = [] } = trpc.vendors.list.useQuery();

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

  const createMutation = trpc.savings.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Économie enregistrée : ${fmt(data.savingsAmount)} XOF (${data.savingsPercent.toFixed(1)}%)`);
      utils.savings.list.invalidate();
      utils.savings.getStats.invalidate();
      setShowForm(false);
      setTitle(""); setBudgetAmount(""); setActualAmount(""); setNotes(""); setVendorId("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    const budget = parseFloat(budgetAmount);
    const actual = parseFloat(actualAmount);
    if (!budget || !actual) { toast.error("Montants requis"); return; }
    if (actual >= budget) { toast.error("Le montant réel doit être inférieur au budget pour enregistrer une économie"); return; }
    createMutation.mutate({ title: title.trim(), savingsType: savingsType as any, budgetAmount: budget, actualAmount: actual, notes: notes || undefined, vendorId: vendorId ? parseInt(vendorId) : undefined });
  };

  const savings = (stats as any)?.totalSavings || 0;
  const count = (stats as any)?.savingsCount || 0;
  const avgPct = (stats as any)?.avgSavingsPct || 0;
  const byMonth: any[] = (stats as any)?.byMonth || [];
  const byType: any[] = (stats as any)?.byType || [];
  const maxMonth = Math.max(...byMonth.map((m: any) => Number(m.total)), 1);

  const estimatedSavings = parseFloat(budgetAmount) && parseFloat(actualAmount) ? parseFloat(budgetAmount) - parseFloat(actualAmount) : 0;

  return (
    <div className="space-y-6">
      <PageHeader icon={<TrendingDown className="h-5 w-5" />} title="Suivi des économies" description={`Économies réalisées en ${year} — démontrez la valeur des achats`}
        action={<button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold btn-primary"><Plus className="h-4 w-4" />Enregistrer une économie</button>} />

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Target className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{fmt(savings)} XOF</p>
                <p className="text-xs text-muted-foreground">Total économisé {year}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Award className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{Number(avgPct).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Économie moyenne par achat</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <BarChart2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">{count}</p>
                <p className="text-xs text-muted-foreground">Opportunités saisies</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Monthly chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />Économies par mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-36">
              {MONTHS.map((m, i) => {
                const monthData = byMonth.find((b: any) => Number(b.month) === i + 1);
                const h = monthData ? (Number(monthData.total) / maxMonth) * 100 : 0;
                return (
                  <div key={m} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-sm bg-emerald-100 relative" style={{ height: "128px" }}>
                      <div className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-t-sm transition-all"
                        style={{ height: `${h}%` }} title={monthData ? `${fmt(Number(monthData.total))} XOF` : "0"} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{m}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* By type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />Par source d'économie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byType.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Aucune donnée encore</p>
            ) : byType.map((b: any) => (
              <div key={b.savingsType}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${TYPE_COLORS[b.savingsType] || "bg-gray-100 text-gray-700"}`}>
                    {TYPE_LABELS[b.savingsType] || b.savingsType}
                  </span>
                  <span className="font-medium text-emerald-700">{fmt(Number(b.total))} XOF</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((Number(b.total) / savings) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent records */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Économies enregistrées
          </CardTitle>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-xs text-blue-700 hover:underline">
            <Plus className="h-3 w-3" />Enregistrer
          </button>
        </CardHeader>
        <CardContent>
          {(records as any[]).length === 0 ? (
            <div className="text-center py-10">
              <TrendingDown className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune économie enregistrée</p>
              <p className="text-xs text-muted-foreground mt-1">Chaque négociation réussie mérite d'être tracée</p>
              <button onClick={() => setShowForm(true)} className="mt-3 text-sm btn-primary px-4 py-1.5 rounded-lg text-white">
                + Enregistrer une économie
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {(records as any[]).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{r.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_COLORS[r.savingsType]}`}>{TYPE_LABELS[r.savingsType]}</span>
                      {r.vendorName && <span className="text-xs text-muted-foreground">{r.vendorName}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-700">-{fmt(r.savingsAmount)} XOF</p>
                    <p className="text-xs text-muted-foreground">{Number(r.savingsPercent).toFixed(1)}% d'économie</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-background rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Enregistrer une économie</h3>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Description *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Renégociation contrat maintenance" />
              </div>
              <div className="space-y-1.5">
                <Label>Type d'économie</Label>
                <select value={savingsType} onChange={e => setSavingsType(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Montant budget (XOF) *</Label>
                  <Input type="number" value={budgetAmount} onChange={e => setBudgetAmount(e.target.value)} placeholder="800 000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Montant réel (XOF) *</Label>
                  <Input type="number" value={actualAmount} onChange={e => setActualAmount(e.target.value)} placeholder="650 000" />
                </div>
              </div>
              {estimatedSavings > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm text-emerald-700">Économie calculée</span>
                  <span className="font-bold text-emerald-700">{fmt(estimatedSavings)} XOF ({((estimatedSavings / parseFloat(budgetAmount)) * 100).toFixed(1)}%)</span>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Fournisseur (optionnel)</Label>
                <select value={vendorId} onChange={e => setVendorId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                  <option value="">— Aucun —</option>
                  {(vendors as any[]).map((v: any) => <option key={v.id} value={v.id}>{v.legalName}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Contexte de la négociation..." />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg border text-sm font-medium">Annuler</button>
              <button onClick={handleSave} disabled={createMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold btn-primary text-white disabled:opacity-50">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
