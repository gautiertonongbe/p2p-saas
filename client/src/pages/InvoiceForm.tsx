import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function parseNum(s: string) {
  return parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0;
}

type LineItem = { description: string; quantity: string; unitPrice: string };

export default function InvoiceForm() {
  const [, setLocation] = useLocation();

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [poId, setPoId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "" }
  ]);

  const { data: vendors = [] } = trpc.vendors.list.useQuery();
  const { data: orders = [] } = trpc.purchaseOrders.list.useQuery();

  const utils = trpc.useUtils();
  const createMutation = trpc.invoices.create.useMutation({
    onSuccess: () => {
      toast.success("Facture créée avec succès");
      utils.invoices.list.invalidate();
      setLocation("/invoices");
    },
    onError: (e) => toast.error(e.message),
  });

  const addLine = () => setLines(p => [...p, { description: "", quantity: "1", unitPrice: "" }]);
  const removeLine = (i: number) => setLines(p => p.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof LineItem, val: string) =>
    setLines(p => p.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const subtotal = lines.reduce((s, l) => s + parseNum(l.quantity) * parseNum(l.unitPrice), 0);
  const tax = parseNum(taxAmount);
  const total = subtotal + tax;

  const handleSave = () => {
    if (!invoiceNumber.trim()) { toast.error("Numéro de facture requis"); return; }
    if (!vendorId) { toast.error("Fournisseur requis"); return; }
    if (!invoiceDate) { toast.error("Date de facture requise"); return; }
    if (subtotal === 0) { toast.error("Montant total doit être supérieur à 0"); return; }

    createMutation.mutate({
      invoiceNumber: invoiceNumber.trim(),
      vendorId: parseInt(vendorId),
      poId: poId && poId !== "none" ? parseInt(poId) : undefined,
      invoiceDate,
      dueDate: dueDate || undefined,
      amount: subtotal,
      taxAmount: tax || undefined,
    });
  };

  // Filter POs by selected vendor
  const vendorOrders = (orders as any[]).filter(o =>
    !vendorId || o.vendorId === parseInt(vendorId)
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/invoices")} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Nouvelle facture</h1>
          <p className="text-sm text-muted-foreground">Saisir une facture fournisseur</p>
        </div>
      </div>

      {/* Step 1 - Invoice info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</div>
            Informations de la facture
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Numéro de facture *</Label>
              <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="Ex: FAC-2026-0001" />
            </div>
            <div className="space-y-1.5">
              <Label>Fournisseur *</Label>
              <Select value={vendorId || "none"} onValueChange={v => { setVendorId(v === "none" ? "" : v); setPoId(""); }}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un fournisseur..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sélectionner —</SelectItem>
                  {(vendors as any[]).filter((v: any) => v.status === "active").map((v: any) => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.legalName || v.tradeName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date de facture *</Label>
              <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date d'échéance</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Bon de commande associé <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
            <Select value={poId || "none"} onValueChange={v => setPoId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Lier à un bon de commande..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Aucun (facture directe) —</SelectItem>
                {vendorOrders.map((o: any) => (
                  <SelectItem key={o.id} value={String(o.id)}>
                    {o.orderNumber} — {fmt(Number(o.totalAmount))} XOF
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!poId && (
              <p className="text-xs text-blue-600">💡 Vous pouvez créer une facture sans bon de commande associé</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2 - Line items */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2</div>
              Lignes de facturation
            </CardTitle>
            <button type="button" onClick={addLine}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors">
              <Plus className="h-4 w-4" />Ajouter une ligne
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Header */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            <div className="col-span-6">Description</div>
            <div className="col-span-2 text-center">Qté</div>
            <div className="col-span-2 text-right">Prix unit. (XOF)</div>
            <div className="col-span-1 text-right">Total</div>
            <div className="col-span-1"></div>
          </div>

          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl border bg-muted/20">
              <div className="col-span-12 sm:col-span-6">
                <Input value={line.description} onChange={e => updateLine(i, "description", e.target.value)}
                  placeholder="Description de la prestation / article..."
                  className="border-0 bg-transparent p-0 h-8 text-sm focus-visible:ring-0" />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Input type="text" inputMode="decimal" value={line.quantity}
                  onChange={e => updateLine(i, "quantity", e.target.value)}
                  className="h-8 text-sm text-center bg-white/80" placeholder="1" />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Input type="text" inputMode="decimal" value={line.unitPrice}
                  onChange={e => updateLine(i, "unitPrice", e.target.value)}
                  onFocus={e => { if (line.unitPrice === "0") updateLine(i, "unitPrice", ""); }}
                  placeholder="0"
                  className="h-8 text-sm text-right bg-white/80" />
              </div>
              <div className="col-span-3 sm:col-span-1 text-right">
                <span className="text-sm font-semibold text-blue-700">
                  {fmt(parseNum(line.quantity) * parseNum(line.unitPrice))}
                </span>
              </div>
              <div className="col-span-1 flex justify-end">
                {lines.length > 1 && (
                  <button type="button" onClick={() => removeLine(i)}
                    className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Tax and totals */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-end items-center gap-4">
              <span className="text-sm text-muted-foreground">Sous-total HT</span>
              <span className="text-sm font-medium w-36 text-right">{fmt(subtotal)} XOF</span>
            </div>
            <div className="flex justify-end items-center gap-4">
              <Label className="text-sm text-muted-foreground">TVA / Taxes (XOF)</Label>
              <Input type="text" inputMode="decimal" value={taxAmount}
                onChange={e => setTaxAmount(e.target.value)}
                placeholder="0"
                className="h-8 text-sm text-right w-36" />
            </div>
            <div className="flex justify-end items-center gap-4 pt-2 border-t">
              <span className="text-sm font-semibold">Total TTC</span>
              <span className="text-xl font-bold text-blue-700 w-36 text-right">{fmt(total)} XOF</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5 pt-2">
            <Label>Notes / Commentaires <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Conditions de paiement, références, remarques..." rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
        <button type="button" onClick={() => setLocation("/invoices")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" />Annuler
        </button>
        <button type="button" onClick={handleSave} disabled={createMutation.isPending}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: "#2563eb" }}>
          <Save className="h-4 w-4" />
          {createMutation.isPending ? "Enregistrement..." : "Enregistrer la facture"}
        </button>
      </div>
    </div>
  );
}
