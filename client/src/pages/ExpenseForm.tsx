import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, Send, Loader2, Receipt } from "lucide-react";
import { ExpenseScore } from "@/components/ExpenseScore";

const CATEGORIES = [
  "Transport / Déplacement",
  "Hébergement / Hôtel",
  "Repas / Restauration",
  "Carburant",
  "Fournitures de bureau",
  "Communication / Téléphone",
  "Formation / Conférence",
  "Représentation client",
  "Frais médicaux",
  "Autre",
];

function fmt(n: number) { return new Intl.NumberFormat("fr-FR").format(n); }
function parseNum(s: string) { return parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0; }

type Line = {
  expenseDate: string;
  category: string;
  description: string;
  amount: string;
  vendorName: string;
  isBillable: boolean;
};

export default function ExpenseForm() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [lines, setLines] = useState<Line[]>([{
    expenseDate: new Date().toISOString().split("T")[0],
    category: "Transport / Déplacement",
    description: "",
    amount: "",
    vendorName: "",
    isBillable: false,
  }]);

  const createMut = trpc.expenses.create.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const submitMut = trpc.expenses.submit.useMutation({
    onSuccess: () => {
      toast.success("Note de frais soumise pour approbation !");
      utils.expenses.list.invalidate();
      setLocation("/expenses");
    },
    onError: (e) => toast.error(e.message),
  });

  const addLine = () => setLines(p => [...p, {
    expenseDate: new Date().toISOString().split("T")[0],
    category: "Transport / Déplacement",
    description: "", amount: "", vendorName: "", isBillable: false,
  }]);
  const removeLine = (i: number) => setLines(p => p.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof Line, val: any) =>
    setLines(p => p.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const total = lines.reduce((s, l) => s + parseNum(l.amount), 0);

  const payload = {
    title: title.trim(),
    description: description.trim() || undefined,
    periodStart: periodStart || undefined,
    periodEnd: periodEnd || undefined,
    lines: lines.filter(l => l.amount).map(l => ({
      expenseDate: l.expenseDate,
      category: l.category,
      description: l.description || undefined,
      amount: parseNum(l.amount),
      vendorName: l.vendorName || undefined,
      isBillable: l.isBillable,
    })),
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    const data = await createMut.mutateAsync(payload).catch(() => null);
    if (data) { toast.success("Brouillon sauvegardé"); utils.expenses.list.invalidate(); setLocation("/expenses"); }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    if (lines.every(l => !l.amount)) { toast.error("Ajoutez au moins une dépense"); return; }
    const data = await createMut.mutateAsync(payload).catch(() => null);
    if (data?.id) submitMut.mutate({ id: data.id });
  };

  const isPending = createMut.isPending || submitMut.isPending;

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/expenses")} className="p-2 rounded-lg hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Nouvelle note de frais</h1>
          <p className="text-sm text-muted-foreground">Soumettez vos dépenses pour remboursement</p>
        </div>
      </div>

      {/* General info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</div>
            Informations générales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Titre de la note de frais *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Déplacement client Abidjan - Mars 2026" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Période du</Label>
              <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Période au</Label>
              <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description / Objet <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Contexte du déplacement, mission concernée..." rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Expense lines */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2</div>
              Détail des dépenses
            </CardTitle>
            <button onClick={addLine}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-300 text-blue-700 hover:bg-blue-50">
              <Plus className="h-4 w-4" />Ajouter une ligne
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Header row */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            <div className="col-span-2">Date</div>
            <div className="col-span-3">Catégorie</div>
            <div className="col-span-3">Description / Fournisseur</div>
            <div className="col-span-2 text-right">Montant (XOF)</div>
            <div className="col-span-1 text-center">Fact.</div>
            <div className="col-span-1"></div>
          </div>

          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start p-3 rounded-xl border bg-muted/20">
              {/* Date */}
              <div className="col-span-12 sm:col-span-2">
                <Input type="date" value={line.expenseDate}
                  onChange={e => updateLine(i, "expenseDate", e.target.value)}
                  className="h-8 text-xs" />
              </div>
              {/* Category */}
              <div className="col-span-12 sm:col-span-3">
                <select value={line.category} onChange={e => updateLine(i, "category", e.target.value)}
                  className="w-full h-8 text-xs border rounded-lg px-2 bg-white">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Description + vendor */}
              <div className="col-span-12 sm:col-span-3 space-y-1">
                <Input value={line.description} onChange={e => updateLine(i, "description", e.target.value)}
                  placeholder="Description" className="h-8 text-xs" />
                <Input value={line.vendorName} onChange={e => updateLine(i, "vendorName", e.target.value)}
                  placeholder="Fournisseur (opt.)" className="h-7 text-xs" />
              </div>
              {/* Amount */}
              <div className="col-span-8 sm:col-span-2">
                <Input type="text" inputMode="decimal" value={line.amount}
                  onChange={e => updateLine(i, "amount", e.target.value)}
                  onFocus={e => { if (line.amount === "0") updateLine(i, "amount", ""); }}
                  placeholder="0" className="h-8 text-sm text-right" />
              </div>
              {/* Billable */}
              <div className="col-span-2 sm:col-span-1 flex justify-center items-start pt-1">
                <input type="checkbox" checked={line.isBillable}
                  onChange={e => updateLine(i, "isBillable", e.target.checked)}
                  className="h-4 w-4 rounded" title="Refacturable au client" />
              </div>
              {/* Remove */}
              <div className="col-span-2 sm:col-span-1 flex justify-end">
                {lines.length > 1 && (
                  <button onClick={() => removeLine(i)}
                    className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="flex justify-end pt-3 border-t">
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Montant total</p>
              <p className="text-2xl font-bold text-blue-700">{fmt(total)} <span className="text-base font-normal text-muted-foreground">XOF</span></p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            💡 <strong>Fact.</strong> = Dépense refacturable au client
          </p>
        </CardContent>
      </Card>

      {/* Compliance Score — live feedback */}
      {lines.some(l => l.amount) && (
        <ExpenseScore lines={lines.map(l => ({ ...l, amount: l.amount }))} title={title} />
      )}

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
        <button onClick={() => setLocation("/expenses")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" />Annuler
        </button>
        <div className="flex gap-3">
          <button onClick={handleSaveDraft} disabled={isPending || !title.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Save className="h-4 w-4" />Brouillon
          </button>
          <button onClick={handleSubmit} disabled={isPending || !title.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 btn-primary">
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />En cours...</> : <><Send className="h-4 w-4" />Soumettre pour approbation</>}
          </button>
        </div>
      </div>
    </div>
  );
}
