/**
 * InvoicePage — unified create / edit / view
 * Same document layout in all modes — inputs turn to text in view mode
 */
import { useState, useRef, useEffect } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { TaxSelector, type TaxLine } from "@/components/TaxSelector";
import CodingWidget, { type CodingValues } from "@/components/CodingWidget";
import { ApprovalChainVisualization } from "@/components/ApprovalChainVisualization";
import { EntityHistory } from "@/components/EntityHistory";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronRight, Edit2, Save, Plus, Trash2,
  Scan, Loader2, CheckCircle, Package, Building2, Calendar,
  Hash, FileText, Banknote, Shield, ShieldCheck, ThumbsUp,
  ThumbsDown, XCircle, Clock, AlertTriangle, Download, Copy
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type LineItem = { description: string; quantity: string; unitPrice: string };

function fmt(n: number | string) { return new Intl.NumberFormat("fr-FR").format(Number(n)); }
function parseNum(s: string) { return parseFloat(String(s).replace(/\s/g, "").replace(",", ".")) || 0; }
function fmtDate(d: any) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "En attente",      color: "text-amber-700",  bg: "bg-amber-100"  },
  approved:  { label: "Approuvée",       color: "text-emerald-700",bg: "bg-emerald-100"},
  rejected:  { label: "Refusée",         color: "text-red-700",    bg: "bg-red-100"    },
  paid:      { label: "Payée",           color: "text-emerald-700",bg: "bg-emerald-100"},
  disputed:  { label: "Contestée",       color: "text-orange-700", bg: "bg-orange-100" },
  revised:   { label: "À réviser",       color: "text-purple-700", bg: "bg-purple-100" },
  cancelled: { label: "Annulée",         color: "text-gray-500",   bg: "bg-gray-100"   },
};

// ── Field helper — same spot, input vs text ────────────────────────────────────
function Field({ label, text, edit, children, className = "" }: {
  label: string; text: React.ReactNode; edit: boolean;
  children?: React.ReactNode; className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      {edit ? children : <p className="text-sm font-semibold text-gray-900">{text || "—"}</p>}
    </div>
  );
}

export default function InvoicePage() {
  const { id } = useParams<{ id?: string }>();
  const searchString = useSearch();
  const urlParams   = searchString ? new URLSearchParams(searchString) : null;
  const urlPoId     = urlParams?.get("poId");
  const copyFromId  = urlParams?.get("copyFrom");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNew  = !id || id === "new";
  const isAdmin = user?.role === "admin" || user?.role === "procurement_manager";
  const isApprover = user?.role === "approver";

  // Edit mode: true when creating, false when viewing existing
  const [editMode, setEditMode]       = useState(isNew);
  const [prefilled, setPrefilled]     = useState(false);
  const [scanning, setScanning]       = useState(false);

  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [vendorId, setVendorId]           = useState("");
  const [poId, setPoId]                   = useState(urlPoId || "");
  const [invoiceDate, setInvoiceDate]     = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate]             = useState("");
  const [notes, setNotes]                 = useState("");
  const [coding, setCoding]               = useState<CodingValues>({});
  const [taxLines, setTaxLines]           = useState<TaxLine[]>([]);
  const [taxAmount, setTaxAmount]         = useState("");
  const [lines, setLines]                 = useState<LineItem[]>([{ description: "", quantity: "1", unitPrice: "" }]);

  // Dialog state
  const [approveDialog, setApproveDialog]   = useState(false);
  const [rejectDialog, setRejectDialog]     = useState(false);
  const [approveComment, setApproveComment] = useState("");
  const [rejectReason, setRejectReason]     = useState("");

  // Queries
  const { data: invoice, isLoading } = trpc.invoices.getById.useQuery(
    { id: parseInt(id!) }, { enabled: !isNew && !!id }
  );
  const { data: approvals = [] }  = trpc.approvals.getByEntity.useQuery(
    { entityType: "invoice", entityId: parseInt(id!) }, { enabled: !isNew && !!id }
  );
  const { data: history, isLoading: histLoading } = trpc.settings.getEntityHistory.useQuery(
    { entityType: "invoice", entityId: parseInt(id!) }, { enabled: !isNew && !!id }
  );
  const { data: vendors = [] }  = trpc.vendors.list.useQuery();
  const { data: orders  = [] }  = trpc.purchaseOrders.list.useQuery();
  const { data: linkedPO }      = trpc.purchaseOrders.getById.useQuery(
    { id: parseInt(urlPoId!) }, { enabled: !!urlPoId }
  );
  const { data: invoiceToCopy } = trpc.invoices.getById.useQuery(
    { id: parseInt(copyFromId!) }, { enabled: !!copyFromId }
  );

  // Prefill
  useEffect(() => {
    if (prefilled) return;
    const src = invoice || invoiceToCopy;
    if (src) {
      setInvoiceNumber(invoiceToCopy ? "" : (src.invoiceNumber || ""));
      setVendorId(src.vendorId ? String(src.vendorId) : "");
      setPoId((src as any).poId ? String((src as any).poId) : "");
      setInvoiceDate(src.invoiceDate ? new Date(src.invoiceDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
      setDueDate((src as any).dueDate ? new Date((src as any).dueDate).toISOString().split("T")[0] : "");
      setTaxAmount((src as any).taxAmount ? String(Number((src as any).taxAmount)) : "");
      setNotes((src as any).notes || "");
      if ((src as any).lineItems?.length) {
        setLines((src as any).lineItems.map((l: any) => ({
          description: l.description || "", quantity: String(l.quantity || 1), unitPrice: String(l.unitPrice || 0)
        })));
      }
      setPrefilled(true);
    }
    if (linkedPO && !prefilled) {
      const po = linkedPO as any;
      if (po.vendorId) setVendorId(String(po.vendorId));
      setPoId(String(po.id));
      if (po.items?.length > 0) {
        setLines(po.items.map((item: any) => ({
          description: item.itemName + (item.description ? ` — ${item.description}` : ""),
          quantity: String(item.quantity), unitPrice: String(Number(item.unitPrice)),
        })));
      }
      setPrefilled(true);
    }
  }, [invoice, invoiceToCopy, linkedPO, prefilled]);

  // Mutations
  const invalidate = () => {
    utils.invoices.getById.invalidate();
    utils.invoices.list.invalidate();
    utils.approvals.getByEntity.invalidate();
    utils.settings.getEntityHistory.invalidate();
  };

  const createMut = trpc.invoices.create.useMutation({
    onSuccess: (data: any) => {
      toast.success("Facture enregistrée");
      setEditMode(false);
      setLocation(`/invoices/${data.id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const exportPDF = trpc.invoices.exportPDF.useMutation({
    onSuccess: (data) => {
      const bytes = atob(data.pdf);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = data.filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approveMut = trpc.invoices.approve.useMutation({
    onSuccess: () => { toast.success("Facture approuvée"); setApproveDialog(false); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const rejectMut = trpc.invoices.reject.useMutation({
    onSuccess: () => { toast.success("Facture refusée"); setRejectDialog(false); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const markPaidMut = trpc.invoices.markAsPaid.useMutation({
    onSuccess: () => { toast.success("Facture marquée comme payée"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Computed
  const subtotal = lines.reduce((s, l) => s + parseNum(l.quantity) * parseNum(l.unitPrice), 0);
  const tax = parseNum(taxAmount);
  const totalTTC = subtotal + tax;
  const isPending = createMut.isPending;
  const canEdit = isNew || (invoice && ["pending", "revised"].includes(invoice.status) && isAdmin);
  const status = (invoice as any)?.status || "pending";
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const selectedVendor = (vendors as any[]).find((v: any) => v.id === parseInt(vendorId));
  const vendorOrders = (orders as any[]).filter(o => !vendorId || o.vendorId === parseInt(vendorId));

  const handleSave = () => {
    if (!invoiceNumber.trim()) { toast.error("Numéro de facture requis"); return; }
    if (!vendorId) { toast.error("Fournisseur requis"); return; }
    if (!invoiceDate) { toast.error("Date requise"); return; }
    if (subtotal === 0) { toast.error("Montant doit être supérieur à 0"); return; }
    createMut.mutate({
      invoiceNumber: invoiceNumber.trim(),
      vendorId: parseInt(vendorId),
      poId: poId && poId !== "none" ? parseInt(poId) : undefined,
      invoiceDate, dueDate: dueDate || undefined,
      amount: subtotal, taxAmount: tax || undefined,
      glAccountId: coding.glAccountId ? parseInt(coding.glAccountId) : undefined,
      costCenterId: coding.costCenterId ? parseInt(coding.costCenterId) : undefined,
      projectId: coding.projectId ? parseInt(coding.projectId) : undefined,
    } as any);
  };

  if (!isNew && isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!isNew && !invoice) return (
    <div className="min-h-screen bg-gray-50/40 flex items-center justify-center">
      <div className="text-center">
        <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="font-semibold text-gray-700">Facture introuvable</p>
        <button onClick={() => setLocation("/invoices")} className="mt-3 text-sm text-blue-600 hover:underline">← Retour</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* ── Sticky topbar ── */}
      <div className="sticky top-0 z-30 bg-white border-b px-6 py-3 flex items-center gap-3">
        <button onClick={() => setLocation("/invoices")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />Factures
        </button>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
        <span className="text-sm font-medium truncate max-w-48">
          {isNew ? "Nouvelle facture" : (invoice?.invoiceNumber || "...")}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {!isNew && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          )}

          {/* OCR button — only when creating */}
          {(isNew || editMode) && (
            <>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={scanning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 text-sm font-medium disabled:opacity-50 transition-colors">
                {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scan className="h-3.5 w-3.5" />}
                Scanner
              </button>
            </>
          )}

          {/* View mode actions */}
          {!isNew && !editMode && (
            <>
              {canEdit && (
                <button onClick={() => setEditMode(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm font-medium transition-colors">
                  <Edit2 className="h-3.5 w-3.5" />Modifier
                </button>
              )}
              <button onClick={() => setLocation(`/invoices/new?copyFrom=${id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition-colors">
                <Copy className="h-3.5 w-3.5" />Copier
              </button>
              <button onClick={() => exportPDF.mutate({ id: parseInt(id!) })} disabled={exportPDF.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition-colors">
                <Download className="h-3.5 w-3.5" />{exportPDF.isPending ? "..." : "PDF"}
              </button>
            </>
          )}

          {/* Edit mode save/cancel */}
          {editMode && !isNew && (
            <>
              <button onClick={() => { setEditMode(false); setPrefilled(false); }}
                className="px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition-colors">
                Annuler
              </button>
            </>
          )}

          {/* Save — new or edit mode */}
          {(isNew || editMode) && (
            <button onClick={handleSave} disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg btn-primary text-white text-sm font-semibold disabled:opacity-50">
              <Save className="h-3.5 w-3.5" />{isPending ? "Sauvegarde..." : "Enregistrer"}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* PO prefill banner */}
        {linkedPO && prefilled && isNew && (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <Package className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-medium text-emerald-800">
              Données importées depuis BC {(linkedPO as any).poNumber} — vérifiez et ajustez si nécessaire
            </span>
          </div>
        )}

        {/* ── INVOICE DOCUMENT — identical in edit and view ── */}
        <div className={`bg-white rounded-2xl border overflow-hidden shadow-sm ${editMode ? "ring-2 ring-blue-200" : ""}`}>

          {/* Edit mode indicator */}
          {editMode && (
            <div className="bg-blue-50 border-b border-blue-100 px-6 py-2 flex items-center gap-2">
              <Edit2 className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Mode édition — les champs sont modifiables</span>
            </div>
          )}

          {/* ── Header: FROM (vendor) + invoice meta ── */}
          <div className="grid grid-cols-2 divide-x border-b">
            {/* Left: Vendor */}
            <div className="p-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Fournisseur</p>
              {editMode ? (
                <select value={vendorId || ""}
                  onChange={e => { setVendorId(e.target.value); setPoId(""); }}
                  className="w-full h-10 px-3 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Sélectionner un fournisseur…</option>
                  {(vendors as any[]).filter((v: any) => v.status === "active").map((v: any) => (
                    <option key={v.id} value={v.id}>{v.legalName || v.tradeName}</option>
                  ))}
                </select>
              ) : (
                <div>
                  <p className="text-lg font-bold text-gray-900">{(invoice as any)?.vendor?.legalName ?? "—"}</p>
                  {(invoice as any)?.vendor?.taxId && (
                    <p className="text-xs text-muted-foreground mt-1">IFU: {(invoice as any).vendor.taxId}</p>
                  )}
                </div>
              )}

              {/* PO link */}
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Bon de commande</p>
                {editMode ? (
                  <select value={poId || ""}
                    onChange={e => setPoId(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Facture directe (sans BC) —</option>
                    {vendorOrders.map((o: any) => (
                      <option key={o.id} value={o.id}>{o.poNumber} — {fmt(Number(o.totalAmount))} XOF</option>
                    ))}
                  </select>
                ) : (
                  (invoice as any)?.purchaseOrder
                    ? <button onClick={() => setLocation(`/purchase-orders/${(invoice as any).purchaseOrder.id}`)}
                        className="text-sm font-semibold text-blue-600 hover:underline">
                        {(invoice as any).purchaseOrder.poNumber}
                      </button>
                    : <p className="text-sm text-muted-foreground">Facture directe</p>
                )}
              </div>
            </div>

            {/* Right: Invoice meta */}
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Numéro de facture</p>
                  {editMode ? (
                    <input value={invoiceNumber}
                      onChange={e => setInvoiceNumber(e.target.value)}
                      placeholder="Ex: FAC-2026-0001"
                      className="text-2xl font-bold border-b-2 border-blue-400 bg-transparent outline-none w-full focus:border-blue-600 pb-0.5" />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">{invoice?.invoiceNumber || "—"}</p>
                  )}
                </div>
                {!isNew && !editMode && (
                  <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${statusCfg.bg} ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Date d'émission"
                  text={fmtDate(invoice?.invoiceDate)}
                  edit={editMode}>
                  <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </Field>
                <Field label="Date d'échéance"
                  text={fmtDate((invoice as any)?.dueDate)}
                  edit={editMode}>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </Field>
              </div>
            </div>
          </div>

          {/* ── Line items table ── */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20">Qté</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36">Prix unit. XOF</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36">Total XOF</th>
                  {editMode && <th className="w-10"></th>}
                </tr>
              </thead>
              <tbody>
                {(editMode ? lines : ((invoice as any)?.lineItems?.length
                  ? (invoice as any).lineItems
                  : [{ description: `Services / Fournitures${(invoice as any)?.purchaseOrder ? ` — ${(invoice as any).purchaseOrder.poNumber}` : ""}`, quantity: 1, unitPrice: Number((invoice as any)?.amount || 0), total: Number((invoice as any)?.amount || 0) }]
                )).map((line: any, i: number) => (
                  <tr key={i} className={`border-b last:border-0 ${editMode ? "bg-blue-50/10" : i%2 ? "bg-gray-50/30" : ""}`}>
                    <td className="px-6 py-3">
                      {editMode ? (
                        <input value={line.description}
                          onChange={e => setLines(prev => prev.map((l, j) => j===i ? {...l, description: e.target.value} : l))}
                          placeholder="Description de la prestation…"
                          className="w-full border-b border-gray-300 bg-transparent outline-none focus:border-blue-500 text-sm pb-0.5" />
                      ) : (
                        <span className="font-medium">{line.description}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editMode ? (
                        <input type="text" inputMode="decimal" value={line.quantity}
                          onChange={e => setLines(prev => prev.map((l, j) => j===i ? {...l, quantity: e.target.value} : l))}
                          className="w-16 text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      ) : <span className="text-muted-foreground">{line.quantity}</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editMode ? (
                        <input type="text" inputMode="decimal" value={line.unitPrice}
                          onChange={e => setLines(prev => prev.map((l, j) => j===i ? {...l, unitPrice: e.target.value} : l))}
                          placeholder="0"
                          className="w-28 text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      ) : <span className="text-muted-foreground">{fmt(line.unitPrice || line.unit_price || 0)}</span>}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold">
                      {fmt(editMode
                        ? parseNum(line.quantity) * parseNum(line.unitPrice)
                        : (line.total || line.unitPrice || 0))} XOF
                    </td>
                    {editMode && (
                      <td className="px-2 py-3">
                        {lines.length > 1 && (
                          <button onClick={() => setLines(prev => prev.filter((_, j) => j!==i))}
                            className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add line button */}
          {editMode && (
            <div className="px-6 py-3 border-t">
              <button onClick={() => setLines(prev => [...prev, { description: "", quantity: "1", unitPrice: "" }])}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
                <Plus className="h-4 w-4" />Ajouter une ligne
              </button>
            </div>
          )}

          {/* ── Taxes & totals ── */}
          <div className="px-6 py-5 border-t bg-gray-50/40">
            {editMode && (
              <div className="mb-4">
                <TaxSelector baseAmount={subtotal} value={taxLines}
                  onChange={(tl) => { setTaxLines(tl); setTaxAmount(String(tl.filter(t => !t.isWithholding).reduce((s,t) => s+t.amount, 0))); }} />
              </div>
            )}

            {/* Totals — right-aligned, same in both modes */}
            <div className="ml-auto max-w-xs space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Montant HT</span>
                <span className="font-medium">{fmt(editMode ? subtotal : Number((invoice as any)?.amount || 0))} XOF</span>
              </div>
              {(editMode ? tax > 0 : Number((invoice as any)?.taxAmount || 0) > 0) && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA (18%)</span>
                  <span className="font-medium text-blue-700">
                    +{fmt(editMode ? tax : Number((invoice as any)?.taxAmount || 0))} XOF
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>Total TTC</span>
                <span className="text-lg text-gray-900">
                  {fmt(editMode ? totalTTC : Number((invoice as any)?.amount || 0) + Number((invoice as any)?.taxAmount || 0))} XOF
                </span>
              </div>
              {status === "paid" && !editMode && (
                <div className="flex justify-between text-sm text-emerald-700 bg-emerald-50 -mx-2 px-2 py-1.5 rounded-lg">
                  <span className="font-semibold">✓ Payée</span>
                  <span className="font-semibold">{fmt(Number((invoice as any)?.amount || 0) + Number((invoice as any)?.taxAmount || 0))} XOF</span>
                </div>
              )}
            </div>
          </div>

          {/* Coding — only in edit mode */}
          {editMode && (
            <div className="px-6 py-4 border-t bg-gray-50/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Imputation comptable</p>
              <CodingWidget value={coding} onChange={setCoding} />
            </div>
          )}

          {/* Notes */}
          {editMode ? (
            <div className="px-6 py-4 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Conditions de paiement, références, remarques…"
                className="w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ) : (invoice as any)?.notes ? (
            <div className="px-6 py-4 border-t text-sm text-muted-foreground">
              <span className="font-medium text-gray-700">Notes : </span>{(invoice as any).notes}
            </div>
          ) : null}
        </div>

        {/* ── Context action banners (view only) ── */}
        {!isNew && !editMode && (
          <>
            {status === "pending" && (isAdmin || isApprover) && (
              <div className="bg-blue-600 text-white rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Approbation requise</p>
                    <p className="text-sm text-blue-100">Cette facture attend votre validation</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setRejectDialog(true)}
                    className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-medium">Rejeter</button>
                  <button onClick={() => setApproveDialog(true)}
                    className="px-4 py-2 rounded-xl bg-white text-blue-700 text-sm font-semibold hover:bg-blue-50">✓ Approuver</button>
                </div>
              </div>
            )}
            {status === "approved" && isAdmin && (
              <div className="bg-emerald-600 text-white rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Banknote className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Facture approuvée — en attente de paiement</p>
                    <p className="text-sm text-emerald-100">Enregistrez le paiement une fois effectué</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-medium">Contester</button>
                  <button
                    onClick={() => markPaidMut.mutate({ invoiceId: parseInt(id!), valueDate: new Date().toISOString().split("T")[0], paymentMethod: "bank_transfer" })}
                    disabled={markPaidMut.isPending}
                    className="px-4 py-2 rounded-xl bg-white text-emerald-700 text-sm font-semibold hover:bg-emerald-50 flex items-center gap-1.5">
                    <Banknote className="h-4 w-4" />Marquer comme payée
                  </button>
                </div>
              </div>
            )}
            {status === "pending" && isAdmin && (
              <div className="flex justify-end gap-2">
                <button className="text-xs px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />Contournement workflow
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Approval chain ── */}
        {!isNew && !editMode && approvals && approvals.length > 0 && (
          <ApprovalChainVisualization approvals={approvals} />
        )}

        {/* ── History ── */}
        {!isNew && !editMode && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 border-b">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Historique</span>
              </div>
              {history && <span className="text-xs text-muted-foreground">{history.length} action{history.length > 1 ? "s" : ""}</span>}
            </div>
            <div className="px-4 py-3">
              <EntityHistory entries={history || []} isLoading={histLoading} />
            </div>
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approuver la facture</DialogTitle>
            <DialogDescription>{invoice?.invoiceNumber}</DialogDescription>
          </DialogHeader>
          <textarea value={approveComment} onChange={e => setApproveComment(e.target.value)}
            placeholder="Commentaire (optionnel)" rows={2}
            className="w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(false)}>Annuler</Button>
            <button onClick={() => approveMut.mutate({ invoiceId: parseInt(id!), comment: approveComment })}
              disabled={approveMut.isPending}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              {approveMut.isPending ? "..." : "✓ Approuver"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Motif du refus</DialogTitle></DialogHeader>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            placeholder="Motif obligatoire…" rows={3}
            className="w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>Annuler</Button>
            <button onClick={() => { if (!rejectReason.trim()) { toast.error("Motif requis"); return; } rejectMut.mutate({ invoiceId: parseInt(id!), reason: rejectReason }); }}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">
              Rejeter
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
