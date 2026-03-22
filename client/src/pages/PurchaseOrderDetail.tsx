import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Package, CheckCircle, XCircle, Download, FileText, Clock, Send, ShieldCheck, ThumbsUp, ThumbsDown, Shield } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ApprovalChainVisualization } from "@/components/ApprovalChainVisualization";
import { EntityHistory } from "@/components/EntityHistory";
import { useAuth } from "@/_core/hooks/useAuth";

export default function PurchaseOrderDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { user } = useAuth();

  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptNotes, setReceiptNotes] = useState("");
  const [selectedItemReceipts, setSelectedItemReceipts] = useState<Record<number, { quantity: number; condition: string }>>({});
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [bypassDialogOpen, setBypassDialogOpen] = useState(false);
  const [approveComment, setApproveComment] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [bypassComment, setBypassComment] = useState("");

  const { data: po, isLoading } = trpc.purchaseOrders.getById.useQuery({ id: parseInt(id!) }, { enabled: !!id });
  const { data: approvals = [] } = trpc.approvals.getByEntity.useQuery({ entityType: "purchaseOrder", entityId: parseInt(id!) }, { enabled: !!id });
  const { data: history, isLoading: historyLoading } = trpc.settings.getEntityHistory.useQuery({ entityType: "purchaseOrder", entityId: parseInt(id!) }, { enabled: !!id });

  const invalidate = () => utils.purchaseOrders.getById.invalidate();

  const exportPDFMutation = trpc.purchaseOrders.exportPDF.useMutation({
    onSuccess: (data) => {
      const bytes = atob(data.pdf);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = data.filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      toast.success("PDF téléchargé");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const issueMutation = trpc.purchaseOrders.issue.useMutation({
    onSuccess: () => { toast.success("Bon de commande émis"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const approveMutation = trpc.purchaseOrders.approve.useMutation({
    onSuccess: () => { toast.success("Approuvé"); setApproveDialogOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const rejectMutation = trpc.purchaseOrders.reject.useMutation({
    onSuccess: () => { toast.success("Refusé"); setRejectDialogOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const bypassMutation = trpc.purchaseOrders.adminBypassApproval.useMutation({
    onSuccess: () => { toast.success("Approuvé directement"); setBypassDialogOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const cancelMutation = trpc.purchaseOrders.cancel.useMutation({
    onSuccess: () => { toast.success("Annulé"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const recordReceiptMutation = trpc.purchaseOrders.recordReceipt.useMutation({
    onSuccess: () => { toast.success("Réception enregistrée"); invalidate(); setReceiptDialogOpen(false); setSelectedItemReceipts({}); setReceiptNotes(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleRecordReceipt = async () => {
    const items = Object.entries(selectedItemReceipts)
      .filter(([, r]) => r.quantity > 0)
      .map(([itemId, r]) => ({ poItemId: parseInt(itemId), quantityReceived: r.quantity, condition: r.condition as any }));
    if (!items.length) { toast.error("Saisissez au moins une quantité"); return; }
    await recordReceiptMutation.mutateAsync({ poId: parseInt(id!), items, notes: receiptNotes || undefined });
  };

  const updateItemReceipt = (itemId: number, field: "quantity" | "condition", value: number | string) =>
    setSelectedItemReceipts(prev => ({ ...prev, [itemId]: { quantity: prev[itemId]?.quantity || 0, condition: prev[itemId]?.condition || "good", [field]: value } }));

  const fmt = (n: string | number) => new Intl.NumberFormat("fr-FR").format(Number(n));
  const fmtDate = (d: Date) => new Date(d).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });

  if (isLoading) return <div className="flex items-center justify-center min-h-[400px]"><p className="text-muted-foreground">{t("common.loading")}</p></div>;
  if (!po) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Package className="h-16 w-16 text-muted-foreground/50" />
      <p className="text-muted-foreground">{t("errors.notFound")}</p>
      <Button onClick={() => setLocation("/purchase-orders")} variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />{t("common.back")}</Button>
    </div>
  );

  const p = po as any;
  const isAdmin = user?.role === "admin" || user?.role === "procurement_manager";
  const isApproverRole = user?.role === "approver";
  const poItems = p.items || [];

  const PO_STEPS = [
    { n:1, label:"Brouillon",   icon:"📝", done: true },
    { n:2, label:"Émis",        icon:"📤", done: ["issued","approved","confirmed","partially_received","received","closed"].includes(p.status) },
    { n:3, label:"Approuvé",    icon:"✅", done: ["approved","confirmed","partially_received","received","closed"].includes(p.status) },
    { n:4, label:"Réceptionné", icon:"📦", done: ["partially_received","received","closed"].includes(p.status) },
    { n:5, label:"Facturé",     icon:"🧾", done: p.status === "closed" },
  ];
  const activeStep = p.status === "draft" ? 1 : p.status === "issued" ? 2 : p.status === "approved" ? 3 : ["partially_received","received"].includes(p.status) ? 4 : 5;

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white border-b px-6 py-3 flex items-center gap-4">
        <button onClick={() => setLocation("/purchase-orders")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /><span>Bons de commande</span>
        </button>
        <span className="text-muted-foreground/40">›</span>
        <span className="text-sm font-medium">{p.poNumber}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className={`status-badge status-${p.status}`}>{t(`purchaseOrders.status.${p.status}`)}</span>
          <button onClick={() => exportPDFMutation.mutate({ id: p.id })} disabled={exportPDFMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition-colors">
            <Download className="h-3.5 w-3.5" />PDF
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Progress */}
        <div className="bg-white rounded-2xl border p-5">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-5 h-0.5 bg-gray-100 mx-10" />
            {PO_STEPS.map((step) => (
              <div key={step.n} className="flex flex-col items-center gap-2 relative z-10">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 text-base transition-all ${
                  step.done && step.n < activeStep ? "bg-emerald-500 border-emerald-500" :
                  step.n === activeStep ? "bg-blue-600 border-blue-600" :
                  "bg-white border-gray-200"
                }`}>
                  {step.done && step.n < activeStep
                    ? <CheckCircle className="h-5 w-5 text-white" />
                    : <span className={step.n === activeStep ? "text-white text-sm" : "text-gray-300 text-sm"}>{step.icon}</span>}
                </div>
                <span className={`text-xs font-medium ${step.n === activeStep ? "text-blue-700" : step.done && step.n < activeStep ? "text-emerald-700" : "text-gray-400"}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Context banner */}
        {p.status === "draft" && isAdmin && (
          <div className="bg-gray-800 text-white rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Brouillon — prêt à émettre ?</p>
              <p className="text-sm text-gray-300">Vérifiez les articles puis émettez le BC au fournisseur</p>
            </div>
            <button onClick={() => { if(confirm("Émettre ce BC ?")) issueMutation.mutate({ id: p.id }); }}
              disabled={issueMutation.isPending}
              className="px-4 py-2 rounded-xl bg-white text-gray-900 text-sm font-semibold hover:bg-gray-100 transition-colors flex items-center gap-1.5 shrink-0">
              <Send className="h-3.5 w-3.5" />Émettre le BC
            </button>
          </div>
        )}
        {p.status === "issued" && (isAdmin || isApproverRole) && (
          <div className="bg-blue-600 text-white rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Approbation requise</p>
              <p className="text-sm text-blue-100">Ce BC attend votre approbation</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setRejectDialogOpen(true)}
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors">Rejeter</button>
              <button onClick={() => setApproveDialogOpen(true)}
                className="px-4 py-2 rounded-xl bg-white text-blue-700 text-sm font-semibold hover:bg-blue-50 transition-colors">✓ Approuver</button>
            </div>
          </div>
        )}
        {["approved","confirmed","partially_received"].includes(p.status) && isAdmin && (
          <div className="bg-emerald-600 text-white rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">
                {p.status === "partially_received" ? "Réception partielle enregistrée" : "BC approuvé — en attente de réception"}
              </p>
              <p className="text-sm text-emerald-100">
                {p.status === "partially_received" ? "Enregistrez la réception du reste des marchandises" : "Enregistrez la réception quand les marchandises arrivent"}
              </p>
            </div>
            <button onClick={() => { setSelectedItemReceipts({}); setReceiptNotes(""); setReceiptDialogOpen(true); }}
              className="px-4 py-2 rounded-xl bg-white text-emerald-700 text-sm font-semibold hover:bg-emerald-50 transition-colors flex items-center gap-1.5 shrink-0">
              <Package className="h-3.5 w-3.5" />Enregistrer réception
            </button>
          </div>
        )}
        {p.status === "received" && isAdmin && (
          <div className="bg-purple-600 text-white rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Marchandises reçues — créez la facture</p>
              <p className="text-sm text-purple-100">Toutes les marchandises ont été réceptionnées</p>
            </div>
            <button onClick={() => setLocation(`/invoices/new?poId=${p.id}`)}
              className="px-4 py-2 rounded-xl bg-white text-purple-700 text-sm font-semibold hover:bg-purple-50 transition-colors flex items-center gap-1.5 shrink-0">
              <FileText className="h-3.5 w-3.5" />Créer une facture
            </button>
          </div>
        )}

        {/* Main card */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="grid grid-cols-3 divide-x border-b">
            {[
              { label: "Fournisseur", value: p.vendor?.legalName || "—" },
              { label: "Montant total", value: `${fmt(p.totalAmount)} XOF`, bold: true },
              { label: "Livraison prévue", value: p.expectedDeliveryDate ? fmtDate(p.expectedDeliveryDate) : "—" },
            ].map((kpi, i) => (
              <div key={i} className="px-6 py-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{kpi.label}</p>
                <p className={`mt-1 ${kpi.bold ? "text-xl font-bold" : "text-base font-semibold"}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Items */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Article</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qté</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prix unit.</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {poItems.map((item: any, i: number) => (
                <tr key={item.id} className={`border-b last:border-0 ${i%2===0?"":"bg-gray-50/30"}`}>
                  <td className="px-6 py-3.5 font-medium">{item.itemName}</td>
                  <td className="px-6 py-3.5 text-right text-muted-foreground">{item.quantity} {item.unit||"pcs"}</td>
                  <td className="px-6 py-3.5 text-right text-muted-foreground">{fmt(item.unitPrice)} XOF</td>
                  <td className="px-6 py-3.5 text-right font-semibold">{fmt(item.totalPrice)} XOF</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50/70">
                <td colSpan={3} className="px-6 py-4 text-right font-semibold text-gray-700">Total</td>
                <td className="px-6 py-4 text-right font-bold text-xl">{fmt(p.totalAmount)} <span className="text-sm font-normal text-muted-foreground">XOF</span></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Approval chain */}
        {approvals && approvals.length > 0 && <ApprovalChainVisualization approvals={approvals} />}

        {/* History */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Historique</span>
            </div>
            {history && history.length > 0 && <span className="text-xs text-muted-foreground">{history.length} actions</span>}
          </div>
          <div className="px-4 py-3">
            <EntityHistory entries={history || []} isLoading={historyLoading} />
          </div>
        </div>
      </div>

      {/* Receipt Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enregistrer une réception</DialogTitle>
            <DialogDescription>Saisir les quantités reçues pour chaque article</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {poItems.map((item: any) => (
              <div key={item.id} className="p-4 border rounded-lg space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{item.itemName}</p>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    Commandé: {item.quantity} {item.unit || "pcs"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Quantité reçue</Label>
                    <Input
                      type="number"
                      min="0"
                      max={Number(item.quantity)}
                      placeholder="0"
                      value={selectedItemReceipts[item.id]?.quantity ?? ""}
                      placeholder={String(Math.max(0, Number(item.quantity) - Number(item.receivedQuantity || 0)))}
                      onChange={(e) => {
                        const val = e.target.value === "" ? 0 : parseFloat(e.target.value) || 0;
                        updateItemReceipt(item.id, "quantity", val);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Max: {item.quantity} {item.unit || "pcs"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select value={selectedItemReceipts[item.id]?.condition || "good"} onValueChange={(v) => updateItemReceipt(item.id, "condition", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">✅ Bon état</SelectItem>
                        <SelectItem value="damaged">⚠️ Endommagé</SelectItem>
                        <SelectItem value="partial">📦 Partiel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
            <div className="space-y-2">
              <Label>Notes de réception</Label>
              <Textarea value={receiptNotes} onChange={(e) => setReceiptNotes(e.target.value)} rows={3} placeholder="Observations, écarts, remarques..." />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setReceiptDialogOpen(false); setSelectedItemReceipts({}); }}>Annuler</Button>
              <button
                onClick={handleRecordReceipt}
                disabled={recordReceiptMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold btn-primary text-white disabled:opacity-50">
                <CheckCircle className="h-4 w-4" />
                {recordReceiptMutation.isPending ? "Enregistrement..." : "Confirmer la réception"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Approuver le bon de commande ?</AlertDialogTitle><AlertDialogDescription>BC {p.poNumber}</AlertDialogDescription></AlertDialogHeader>
          <Textarea value={approveComment} onChange={(e) => setApproveComment(e.target.value)} placeholder="Commentaire (optionnel)" rows={2} className="mt-2" />
          <div className="flex gap-3 justify-end mt-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => approveMutation.mutate({ poId: p.id, comment: approveComment })} disabled={approveMutation.isPending} className="bg-green-600 hover:bg-green-700">Approuver</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Rejeter le bon de commande ?</AlertDialogTitle></AlertDialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motif du rejet *" rows={2} className="mt-2" />
          <div className="flex gap-3 justify-end mt-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => rejectMutation.mutate({ poId: p.id, reason: rejectReason })} disabled={rejectMutation.isPending || !rejectReason.trim()} className="bg-red-600 hover:bg-red-700">Rejeter</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bypass Dialog */}
      <AlertDialog open={bypassDialogOpen} onOpenChange={setBypassDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Approuver directement (Admin)</AlertDialogTitle><AlertDialogDescription>Bypasse la chaîne d'approbation.</AlertDialogDescription></AlertDialogHeader>
          <Textarea value={bypassComment} onChange={(e) => setBypassComment(e.target.value)} placeholder="Motif (optionnel)" rows={2} className="mt-2" />
          <div className="flex gap-3 justify-end mt-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => bypassMutation.mutate({ poId: p.id, comment: bypassComment })} disabled={bypassMutation.isPending} className="bg-amber-600 hover:bg-amber-700">Approuver directement</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
