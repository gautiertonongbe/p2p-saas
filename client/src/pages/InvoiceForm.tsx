import { useState, useRef, useEffect } from "react";
import { TaxSelector, type TaxLine } from "@/components/TaxSelector";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import CodingWidget, { type CodingValues } from "@/components/CodingWidget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Plus, Trash2, Scan, Loader2, CheckCircle, Package } from "lucide-react";
import { toast } from "sonner";

function fmt(n: number) { return new Intl.NumberFormat("fr-FR").format(n); }
function parseNum(s: string) { return parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0; }

type LineItem = { description: string; quantity: string; unitPrice: string };

export default function InvoiceForm() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const urlPoId = searchString ? new URLSearchParams(searchString).get("poId") : null;
  const copyFromId = searchString ? new URLSearchParams(searchString).get("copyFrom") : null;
  const editId = searchString ? new URLSearchParams(searchString).get("editId") : null;
  const isEdit = !!editId;

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [poId, setPoId] = useState(urlPoId || "");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [taxLines, setTaxLines] = useState<TaxLine[]>([]);
  const [notes, setNotes] = useState("");
  const [coding, setCoding] = useState<CodingValues>({});
  const [scanning, setScanning] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lines, setLines] = useState<LineItem[]>([{ description: "", quantity: "1", unitPrice: "" }]);

  const { data: vendors = [] } = trpc.vendors.list.useQuery();
  const { data: orders = [] } = trpc.purchaseOrders.list.useQuery();

  // Fetch PO data when poId is from URL - prefill everything
  const { data: linkedPO } = trpc.purchaseOrders.getById.useQuery(
    { id: parseInt(urlPoId!) },
    { enabled: !!urlPoId }
  );

  // Fetch invoice to copy from
  const { data: invoiceToCopy } = trpc.invoices.getById.useQuery(
    { id: parseInt(copyFromId!) },
    { enabled: !!copyFromId }
  );

  // Fetch invoice to edit
  const { data: invoiceToEdit } = trpc.invoices.getById.useQuery(
    { id: parseInt(editId!) },
    { enabled: !!editId }
  );

  // Prefill from editId
  useEffect(() => {
    if (invoiceToEdit && !prefilled && isEdit) {
      const inv = invoiceToEdit as any;
      setInvoiceNumber(inv.invoiceNumber || "");
      setVendorId(inv.vendorId ? String(inv.vendorId) : "");
      setPoId(inv.poId ? String(inv.poId) : "");
      setInvoiceDate(inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split("T")[0] : "");
      setDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().split("T")[0] : "");
      setTaxAmount(inv.taxAmount ? String(Number(inv.taxAmount)) : "");
      setNotes(inv.notes || "");
      if (inv.lineItems?.length) {
        setLines(inv.lineItems.map((l: any) => ({
          description: l.description || "",
          quantity: String(l.quantity || 1),
          unitPrice: String(l.unitPrice || 0),
        })));
      }
      setPrefilled(true);
    }
  }, [invoiceToEdit, prefilled, isEdit]);

  useEffect(() => {
    if (linkedPO && !prefilled) {
      const po = linkedPO as any;
      // Prefill vendor
      if (po.vendorId) setVendorId(String(po.vendorId));
      // Prefill PO reference
      setPoId(String(po.id));
      // Prefill amount from PO items
      if (po.items?.length > 0) {
        setLines(po.items.map((item: any) => ({
          description: item.itemName + (item.description ? ` — ${item.description}` : ""),
          quantity: String(item.quantity),
          unitPrice: String(Number(item.unitPrice)),
        })));
      } else if (po.totalAmount) {
        setLines([{ description: `Bon de commande ${po.poNumber}`, quantity: "1", unitPrice: String(Number(po.totalAmount)) }]);
      }
      // Suggest invoice number based on PO number
      setInvoiceNumber(`FAC-${po.poNumber}`);
      // Set due date based on payment terms (30 days default)
      const due = new Date();
      due.setDate(due.getDate() + 30);
      setDueDate(due.toISOString().split("T")[0]);
      setPrefilled(true);
      toast.success(`Données pré-remplies depuis le BC ${po.poNumber}`);
    }
  }, [linkedPO, prefilled]);

  // Copy from existing invoice
  useEffect(() => {
    if (invoiceToCopy && !prefilled) {
      const inv = invoiceToCopy as any;
      setInvoiceNumber(`COPIE-${inv.invoiceNumber}`);
      setVendorId(inv.vendorId ? String(inv.vendorId) : "");
      if (inv.dueDate) setDueDate(new Date(inv.dueDate).toISOString().split("T")[0]);
      if (inv.taxAmount) setTaxAmount(String(Number(inv.taxAmount)));
      if (inv.notes) setNotes(inv.notes);
      // Copy line items from invoice amount if no detailed items
      setLines([{ description: `Copie — ${inv.invoiceNumber}`, quantity: "1", unitPrice: String(Number(inv.amount)) }]);
      setPrefilled(true);
      toast.success(`Facture copiée depuis ${inv.invoiceNumber}`);
    }
  }, [invoiceToCopy, prefilled]);

  const utils = trpc.useUtils();

  const ocrMutation = trpc.ocr.extractInvoice.useMutation({
    onSuccess: (result) => {
      const d = result.data;
      if (d.invoiceNumber) setInvoiceNumber(d.invoiceNumber);
      if (d.invoiceDate) setInvoiceDate(d.invoiceDate);
      if (d.dueDate) setDueDate(d.dueDate);
      if (d.taxAmount) setTaxAmount(String(d.taxAmount));
      if (d.lineItems?.length > 0) {
        setLines(d.lineItems.map((li: any) => ({
          description: li.description || "",
          quantity: String(li.quantity || 1),
          unitPrice: String(li.unitPrice || 0),
        })));
      } else if (d.subtotal) {
        setLines([{ description: "Prestation", quantity: "1", unitPrice: String(d.subtotal) }]);
      }
      toast.success("Facture scannée ! Vérifiez les informations.");
      setScanning(false);
    },
    onError: (e) => { toast.error("Échec du scan: " + e.message); setScanning(false); },
  });

  const handleScanInvoice = async (file: File) => {
    setScanning(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      ocrMutation.mutate({ imageBase64: base64, mimeType: file.type || "image/jpeg" });
    };
    reader.readAsDataURL(file);
  };

  const updateMutation = trpc.invoices.update?.useMutation?.({
    onSuccess: () => {
      toast.success("Facture mise à jour");
      setLocation(`/invoices/${editId}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createMutation = trpc.invoices.create.useMutation({
    onSuccess: (data: any) => {
      toast.success("Facture créée avec succès");
      utils.invoices.list.invalidate();
      setLocation(`/invoices/${data.id}`);
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
      glAccountId: coding.glAccountId ? parseInt(coding.glAccountId) : undefined,
      costCenterId: coding.costCenterId ? parseInt(coding.costCenterId) : undefined,
      projectId: coding.projectId ? parseInt(coding.projectId) : undefined,
    } as any);
  };

  const vendorOrders = (orders as any[]).filter(o => !vendorId || o.vendorId === parseInt(vendorId));

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/invoices")} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Nouvelle facture</h1>
          {linkedPO && prefilled && (
            <p className="text-sm text-emerald-600 flex items-center gap-1 mt-0.5">
              <CheckCircle className="h-3.5 w-3.5" />
              Pré-rempli depuis BC {(linkedPO as any).poNumber}
            </p>
          )}
          {!linkedPO && !copyFromId && !isEdit && <p className="text-sm text-muted-foreground">Saisir une facture fournisseur</p>}
          {isEdit && <p className="text-sm text-blue-600 font-medium">Modification de la facture</p>}
          {copyFromId && <p className="text-sm text-blue-600">Copie d'une facture existante</p>}
        </div>
        <div className="ml-auto">
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden"
            onChange={e => e.target.files?.[0] && handleScanInvoice(e.target.files[0])} />
          <button onClick={() => fileInputRef.current?.click()} disabled={scanning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 text-sm font-medium disabled:opacity-50 transition-colors">
            {scanning ? <><Loader2 className="h-4 w-4 animate-spin" />Analyse...</> : <><Scan className="h-4 w-4" />Scanner (OCR)</>}
          </button>
        </div>
      </div>

      {/* Prefill banner */}
      {linkedPO && prefilled && (
        <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <Package className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-emerald-900">Données importées depuis le BC {(linkedPO as any).poNumber}</span>
            <span className="text-emerald-700 ml-2">— Vérifiez et ajustez si nécessaire</span>
          </div>
        </div>
      )}

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
              <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ex: FAC-2026-0001" />
            </div>
            <div className="space-y-1.5">
              <Label>Fournisseur *</Label>
              <select
                value={vendorId || ""}
                onChange={e => { setVendorId(e.target.value); setPoId(""); }}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Sélectionner un fournisseur...</option>
                {(vendors as any[]).filter((v: any) => v.status === "active").map((v: any) => (
                  <option key={v.id} value={v.id}>{v.legalName || v.tradeName}</option>
                ))}
              </select>
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
            <select
              value={poId || ""}
              onChange={e => setPoId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Aucun (facture directe) —</option>
              {vendorOrders.map((o: any) => (
                <option key={o.id} value={o.id}>{o.poNumber} — {fmt(Number(o.totalAmount))} XOF</option>
              ))}
            </select>
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
                  placeholder="Description..." className="border-0 bg-transparent p-0 h-8 text-sm focus-visible:ring-0" />
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
                  placeholder="0" className="h-8 text-sm text-right bg-white/80" />
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

          <div className="border-t pt-4">
            <TaxSelector
              baseAmount={subtotal}
              value={taxLines}
              onChange={(lines) => {
                setTaxLines(lines);
                const vat = lines.filter(t => !t.isWithholding).reduce((s,t) => s+t.amount, 0);
                setTaxAmount(String(vat));
              }}
            />
            {taxLines.length === 0 && (
              <div className="flex justify-between items-center pt-3 border-t mt-3">
                <span className="text-sm font-semibold">Total HT</span>
                <span className="text-xl font-bold text-blue-700">{fmt(subtotal)} XOF</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t">
            <CodingWidget value={coding} onChange={setCoding} />
          </div>

          <div className="space-y-1.5 pt-2">
            <Label>Notes <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Conditions de paiement, références, remarques..." rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pb-6 sticky bottom-4 bg-background/95 backdrop-blur py-3 px-4 rounded-xl border shadow-md">
        <button type="button" onClick={() => setLocation("/invoices")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" />Annuler
        </button>
        <button type="button" onClick={handleSave} disabled={createMutation.isPending}
          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 btn-primary">
          {createMutation.isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement...</>
            : <><Save className="h-4 w-4" />Enregistrer la facture</>}
        </button>
      </div>
    </div>
  );
}
