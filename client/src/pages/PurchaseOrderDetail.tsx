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
  const poItems = (po as any)?.items || [];

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
  const isTerminal = ["closed","cancelled","rejected"].includes(p.status);
  const STATUS_LABEL: Record<string,string> = {
    draft:"Brouillon — bon non encore émis", issued:"Émis — en attente d'approbation",
    approved:"Approuvé — en attente de réception", confirmed:"Confirmé — en attente de réception",
    partially_received:"Partiellement reçu", received:"Totalement reçu — prêt pour facturation",
    closed:"Clôturé", cancelled:"Annulé", rejected:"Refusé",
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={() => setLocation("/purchase-orders")} variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bon de commande</h1>
            <p className="text-muted-foreground mt-1">{p.poNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => exportPDFMutation.mutate({ id: p.id })} disabled={exportPDFMutation.isPending} variant="outline">
            <Download className="mr-2 h-4 w-4" />PDF
          </Button>
          <span className={`status-badge status-${p.status}`}>{t(`purchaseOrders.status.${p.status}`)}</span>
        </div>
      </div>

      {/* Approval chain */}
      {approvals && approvals.length > 0 && <ApprovalChainVisualization approvals={approvals} />}

      {/* Pending banner */}
      {p.status === "issued" && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="h-8 w-8 rounded-full bg-blue-100 border-2 border-blue-400 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900">En attente d'approbation</p>
            <p className="text-xs text-blue-700 mt-0.5">Les approbateurs désignés ont été notifiés.</p>
          </div>
        </div>
      )}

      {/* Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Fournisseur</p><p className="text-lg font-medium mt-1">{p.vendor?.legalName || "-"}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Montant total</p><p className="text-lg font-bold mt-1">{fmt(p.totalAmount)} XOF</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Livraison prévue</p><p className="text-lg font-medium mt-1">{p.expectedDeliveryDate ? fmtDate(p.expectedDeliveryDate) : "-"}</p></CardContent></Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader><CardTitle>Articles commandés</CardTitle><CardDescription>Liste des articles dans ce bon de commande</CardDescription></CardHeader>
        <CardContent>
          {poItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead><TableHead>Description</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  <TableHead className="text-right">Prix unitaire</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poItems.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell className="text-muted-foreground">{item.description || "-"}</TableCell>
                    <TableCell className="text-right">{item.quantity} {item.unit || "pcs"}</TableCell>
                    <TableCell className="text-right">{fmt(item.unitPrice)} XOF</TableCell>
                    <TableCell className="text-right font-medium">{fmt(item.totalPrice)} XOF</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold text-lg">{fmt(p.totalAmount)} XOF</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : <p className="text-center py-8 text-muted-foreground">Aucun article</p>}
        </CardContent>
      </Card>

      {/* Notes */}
      {p.notes && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">{p.notes}</p></CardContent>
        </Card>
      )}

      {/* History */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Historique</h3>
          {history && history.length > 0 && <span className="ml-auto text-xs text-muted-foreground">{history.length} action{history.length > 1 ? "s" : ""}</span>}
        </div>
        <div className="px-4 py-3">
          <EntityHistory entries={history || []} isLoading={historyLoading} />
        </div>
      </div>

      {/* Sticky Action Bar */}
      <Card className="sticky bottom-4 shadow-md border-2">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">{STATUS_LABEL[p.status] || p.status}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {p.status === "draft" && isAdmin && (
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => issueMutation.mutate({ id: p.id })} disabled={issueMutation.isPending}>
                  <Send className="mr-2 h-4 w-4" />Émettre le bon
                </Button>
              )}
              {p.status === "issued" && (isAdmin || isApproverRole) && (
                <>
                  <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setRejectDialogOpen(true)} disabled={rejectMutation.isPending}>
                    <ThumbsDown className="mr-2 h-4 w-4" />Rejeter
                  </Button>
                  <Button variant="outline" className="border-green-200 text-green-700 hover:bg-green-50" onClick={() => setApproveDialogOpen(true)} disabled={approveMutation.isPending}>
                    <ThumbsUp className="mr-2 h-4 w-4" />Approuver
                  </Button>
                </>
              )}
              {p.status === "issued" && isAdmin && (
                <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setBypassDialogOpen(true)} disabled={bypassMutation.isPending}>
                  <ShieldCheck className="mr-2 h-4 w-4" />Approuver directement
                </Button>
              )}
              {["approved","confirmed","partially_received"].includes(p.status) && (
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setReceiptDialogOpen(true)}>
                  <Package className="mr-2 h-4 w-4" />Enregistrer réception
                </Button>
              )}
              {["approved","confirmed","partially_received","received"].includes(p.status) && isAdmin && (
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setLocation(`/invoices/new?poId=${p.id}`)}>
                  <FileText className="mr-2 h-4 w-4" />Créer une facture
                </Button>
              )}
              {!isTerminal && isAdmin && (
                <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => cancelMutation.mutate({ id: p.id })}>
                  <XCircle className="mr-2 h-4 w-4" />Annuler
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enregistrer une réception</DialogTitle>
            <DialogDescription>Saisir les quantités reçues</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {poItems.map((item: any) => (
              <div key={item.id} className="p-4 border rounded-lg space-y-3">
                <p className="font-medium">{item.itemName}</p>
                <p className="text-sm text-muted-foreground">Commandé: {item.quantity} {item.unit || "pcs"}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Quantité reçue</Label>
                    <Input type="number" min="0" max={Number(item.quantity)} value={selectedItemReceipts[item.id]?.quantity || 0} onChange={(e) => updateItemReceipt(item.id, "quantity", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select value={selectedItemReceipts[item.id]?.condition || "good"} onValueChange={(v) => updateItemReceipt(item.id, "condition", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">Bon état</SelectItem>
                        <SelectItem value="damaged">Endommagé</SelectItem>
                        <SelectItem value="partial">Partiel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={receiptNotes} onChange={(e) => setReceiptNotes(e.target.value)} rows={3} placeholder="Observations..." />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setReceiptDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleRecordReceipt} disabled={recordReceiptMutation.isPending}>
                <CheckCircle className="mr-2 h-4 w-4" />Confirmer
              </Button>
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
