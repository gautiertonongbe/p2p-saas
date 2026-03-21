
// ── Create Invoice from PO panel ──────────────────────────────────────────────
function CreateInvoiceFromPOPanel({ poId, poNumber, totalAmount, onSuccess }: {
  poId: number; poNumber: string; totalAmount: string; onSuccess: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState(totalAmount);
  const [taxAmount, setTaxAmount] = useState("0");

  const mut = trpc.invoices.createFromPO.useMutation({
    onSuccess: (data) => {
      toast.success(`Facture ${data.invoiceNumber} créée avec succès`);
      setOpen(false);
      onSuccess(data.id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fmt = (n: string | number) => new Intl.NumberFormat("fr-FR").format(Number(n));

  return (
    <>
      <div className="p-4 border border-blue-200 bg-blue-50/50 rounded-lg flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-blue-900">Créer une facture depuis ce bon de commande</p>
            <p className="text-sm text-blue-700">Montant BC: {fmt(totalAmount)} XOF — saisissez les détails de la facture fournisseur</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Créer la facture
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle facture — {poNumber}</DialogTitle>
            <DialogDescription>Saisissez les informations de la facture reçue du fournisseur</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>N° de facture fournisseur *</Label>
              <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ex: FAC-2026-0042" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date de facture *</Label>
                <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date d'échéance</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Montant HT (XOF) *</Label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Montant TVA (XOF)</Label>
                <Input type="number" value={taxAmount} onChange={e => setTaxAmount(e.target.value)} />
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total TTC:</span>
                <span className="font-semibold">{fmt((parseFloat(amount) || 0) + (parseFloat(taxAmount) || 0))} XOF</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button
              disabled={!invoiceNumber || !invoiceDate || !amount || mut.isPending}
              onClick={() => mut.mutate({
                poId,
                invoiceNumber,
                invoiceDate,
                dueDate: dueDate || undefined,
                amount: parseFloat(amount),
                taxAmount: parseFloat(taxAmount) || 0,
              })}
            >
              {mut.isPending ? "Création..." : "Créer la facture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Package, CheckCircle, XCircle, Download, FileText, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { EntityHistory } from "@/components/EntityHistory";
import { useAuth } from "@/_core/hooks/useAuth";
import { Shield, AlertCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [bypassComment, setBypassComment] = useState("");;

  const { data: history, isLoading: historyLoading } = trpc.settings.getEntityHistory.useQuery(
    { entityType: "purchaseOrder", entityId: parseInt(id!) },
    { enabled: !!id }
  );

  const exportPDFMutation = trpc.purchaseOrders.exportPDF.useMutation({
    onSuccess: (data) => {
      // Convert base64 to blob and download
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('PDF téléchargé avec succès');
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const { data: po, isLoading } = trpc.purchaseOrders.getById.useQuery(
    { id: parseInt(id!) },
    { enabled: !!id }
  );

  // Items are included in the getById query
  const poItems = po?.items || [];

  const approveMutation = trpc.purchaseOrders.approve.useMutation({
    onSuccess: () => {
      toast.success("Bon de commande approuve avec succes");
      setApproveDialogOpen(false);
      setApproveComment("");
      utils.purchaseOrders.getById.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de l'approbation");
    },
  });

  const rejectMutation = trpc.purchaseOrders.reject.useMutation({
    onSuccess: () => {
      toast.success("Bon de commande rejete avec succes");
      setRejectDialogOpen(false);
      setRejectReason("");
      utils.purchaseOrders.getById.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors du rejet");
    },
  });

  const bypassMutation = trpc.purchaseOrders.adminBypassApproval.useMutation({
    onSuccess: () => {
      toast.success("Bon de commande approuve en tant qu'administrateur");
      setBypassDialogOpen(false);
      setBypassComment("");
      utils.purchaseOrders.getById.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de l'approbation");
    },
  });

  const recordReceiptMutation = trpc.purchaseOrders.recordReceipt.useMutation({
    onSuccess: () => {
      toast.success("Réception enregistrée avec succès");
      utils.purchaseOrders.getById.invalidate();
      // Items are part of getById, no separate invalidation needed
      setReceiptDialogOpen(false);
      setSelectedItemReceipts({});
      setReceiptNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const handleRecordReceipt = async () => {
    const items = Object.entries(selectedItemReceipts)
      .filter(([_, receipt]) => receipt.quantity > 0)
      .map(([itemId, receipt]) => ({
        poItemId: parseInt(itemId),
        quantityReceived: receipt.quantity,
        condition: receipt.condition as "good" | "damaged" | "partial",
      }));

    if (items.length === 0) {
      toast.error("Veuillez saisir au moins une quantité reçue");
      return;
    }

    await recordReceiptMutation.mutateAsync({
      poId: parseInt(id!),
      items,
      notes: receiptNotes || undefined,
    });
  };

  const updateItemReceipt = (itemId: number, field: 'quantity' | 'condition', value: number | string) => {
    setSelectedItemReceipts(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        quantity: prev[itemId]?.quantity || 0,
        condition: prev[itemId]?.condition || 'good',
        [field]: value
      }
    }));
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('fr-FR').format(Number(amount));
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Package className="h-16 w-16 text-muted-foreground/50" />
        <p className="text-muted-foreground">{t('errors.notFound')}</p>
        <Button onClick={() => setLocation("/purchase-orders")} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={() => setLocation("/purchase-orders")} variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bon de commande</h1>
            <p className="text-muted-foreground mt-1">{po.poNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => exportPDFMutation.mutate({ id: po.id })}
            disabled={exportPDFMutation.isPending}
            variant="outline"
          >
            <Download className="mr-2 h-4 w-4" />
            Exporter PDF
          </Button>
          <span className={`status-badge status-${po.status}`}>
            {t(`purchaseOrders.status.${po.status}`)}
          </span>
        </div>
      </div>

      {/* Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Fournisseur</p>
              <p className="text-lg font-medium mt-1">{po.vendor?.legalName || '-'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Montant total</p>
              <p className="text-lg font-bold mt-1">{formatCurrency(po.totalAmount)} XOF</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Livraison prévue</p>
              <p className="text-lg font-medium mt-1">
                {po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : '-'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Articles commandés</CardTitle>
              <CardDescription>Liste des articles dans ce bon de commande</CardDescription>
            </div>
            {po.status !== 'closed' && po.status !== 'cancelled' && (
              <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Package className="mr-2 h-4 w-4" />
                    Enregistrer une réception
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Enregistrer une réception</DialogTitle>
                    <DialogDescription>
                      Saisir les quantités reçues pour chaque article
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {poItems?.map((item: any) => (
                      <div key={item.id} className="p-4 border rounded-lg space-y-3">
                        <div>
                          <p className="font-medium">{item.itemName}</p>
                          <p className="text-sm text-muted-foreground">
                            Commandé: {item.quantity} {item.unit || 'pcs'}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Quantité reçue</Label>
                            <Input
                              type="number"
                              min="0"
                              max={Number(item.quantity)}
                              value={selectedItemReceipts[item.id]?.quantity || 0}
                              onChange={(e) => updateItemReceipt(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Condition</Label>
                            <Select
                              value={selectedItemReceipts[item.id]?.condition || 'good'}
                              onValueChange={(value) => updateItemReceipt(item.id, 'condition', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
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
                      <Textarea
                        value={receiptNotes}
                        onChange={(e) => setReceiptNotes(e.target.value)}
                        placeholder="Observations sur la réception..."
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-3 justify-end">
                      <Button variant="outline" onClick={() => setReceiptDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button onClick={handleRecordReceipt} disabled={recordReceiptMutation.isPending}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Confirmer la réception
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {poItems && poItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  <TableHead className="text-right">Prix unitaire</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poItems.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell className="text-muted-foreground">{item.description || '-'}</TableCell>
                    <TableCell className="text-right">{item.quantity} {item.unit || 'pcs'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)} XOF</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.totalPrice)} XOF
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-bold">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg">
                    {formatCurrency(po.totalAmount)} XOF
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucun article trouvé
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {po.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{po.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Approval Actions */}
      {po.status === 'issued' && user?.role === 'admin' && (
        <>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Shield className="h-5 w-5 text-amber-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-900">Privilege administrateur</p>
                  <p className="text-sm text-amber-800 mt-1">
                    Vous pouvez approuver ou rejeter ce bon de commande directement
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setApproveDialogOpen(true)}
                  disabled={approveMutation.isPending}
                  className="border-green-200 text-green-700 hover:bg-green-50"
                >
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Approuver
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={rejectMutation.isPending}
                  className="border-red-200 text-red-700 hover:bg-red-50"
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  Rejeter
                </Button>
                <Button
                  onClick={() => setBypassDialogOpen(true)}
                  disabled={bypassMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Approuver directement
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Approve Dialog */}
          <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Approuver le bon de commande?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action approuvera le bon de commande {po.poNumber}. Cette action est irreversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Commentaire (optionnel)</label>
                  <textarea
                    value={approveComment}
                    onChange={(e) => setApproveComment(e.target.value)}
                    placeholder="Ajouter un commentaire..."
                    className="w-full mt-2 p-2 border rounded text-sm"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => approveMutation.mutate({ poId: parseInt(id!), comment: approveComment })}
                  disabled={approveMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Approuver
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>

          {/* Reject Dialog */}
          <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rejeter le bon de commande?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action rejettera le bon de commande {po.poNumber}. Veuillez fournir une raison.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Raison du rejet *</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Expliquer pourquoi ce bon de commande est rejet..."
                    className="w-full mt-2 p-2 border rounded text-sm"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => rejectMutation.mutate({ poId: parseInt(id!), reason: rejectReason })}
                  disabled={rejectMutation.isPending || !rejectReason.trim()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Rejeter
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>

          {/* Bypass Dialog */}
          <AlertDialog open={bypassDialogOpen} onOpenChange={setBypassDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Approuver directement en tant qu'administrateur</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action approuvera le bon de commande immediatement en contournant toutes les etapes d'approbation restantes. Cette action sera enregistree dans l'historique.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Commentaire (optionnel)</label>
                  <textarea
                    value={bypassComment}
                    onChange={(e) => setBypassComment(e.target.value)}
                    placeholder="Raison de l'approbation directe..."
                    className="w-full mt-2 p-2 border rounded text-sm"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => bypassMutation.mutate({ poId: parseInt(id!), comment: bypassComment })}
                  disabled={bypassMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  Approuver directement
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {/* History */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Historique</h3>
          {history && history.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">{history.length} action{history.length > 1 ? "s" : ""}</span>
          )}
        </div>
        <div className="px-4 py-3">
          <EntityHistory entries={history || []} isLoading={historyLoading} />
        </div>
      </div>

      {["issued", "confirmed", "partially_received", "received"].includes(po.status) &&
        (user?.role === 'admin' || user?.role === 'procurement_manager') && (
        <CreateInvoiceFromPOPanel poId={po.id} poNumber={po.poNumber} totalAmount={po.totalAmount} onSuccess={(id) => setLocation(`/invoices/${id}`)} />
      )}
    </div>
  );
}
