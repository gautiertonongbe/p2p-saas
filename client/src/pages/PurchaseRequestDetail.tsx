import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileText, Calendar, User, DollarSign, ShieldCheck, ShoppingCart, Edit, Send, Clock, Copy, RefreshCw} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ApprovalChainVisualization } from "@/components/ApprovalChainVisualization";
import { EntityHistory } from "@/components/EntityHistory";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PurchaseRequestDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [bypassDialogOpen, setBypassDialogOpen] = useState(false);
  const [bypassComment, setBypassComment] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);

  const { data: request, isLoading } = trpc.purchaseRequests.getById.useQuery(
    { id: parseInt(id!) },
    { enabled: !!id }
  );

  const { data: items } = trpc.purchaseRequests.getRequestItems.useQuery(
    { requestId: parseInt(id!) },
    { enabled: !!id }
  );

  const { data: approvals } = trpc.approvals.getByRequest.useQuery(
    { requestId: parseInt(id!) },
    { enabled: !!id && request?.status !== "draft" }
  );

  const { data: history, isLoading: historyLoading } = trpc.settings.getEntityHistory.useQuery(
    { entityType: "purchaseRequest", entityId: parseInt(id!) },
    { enabled: !!id }
  );

  const utils = trpc.useUtils();
  const [justifDialogOpen, setJustifDialogOpen] = useState(false);
  const [justifText, setJustifText] = useState("");
  const updateMutation = trpc.purchaseRequests.update.useMutation({
    onSuccess: () => submitMutation.mutate({ id: request!.id }),
    onError: (e: any) => toast.error(e.message),
  });
  const resubmitMutation = trpc.purchaseRequests.resubmit.useMutation({
    onSuccess: () => {
      toast.success("Demande remise en brouillon — modifiez et soumettez à nouveau");
      utils.purchaseRequests.getById.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submitMutation = trpc.purchaseRequests.submit.useMutation({
    onSuccess: (data) => {
      toast.success(
        <div>
          <p className="font-semibold">Demande soumise avec succès!</p>
          <p className="text-sm mt-1">La demande a été envoyée aux approbateurs. Vous pouvez suivre son statut dans la section "Demandes d'achat".</p>
        </div>,
        { duration: 4000 }
      );
      utils.purchaseRequests.getById.invalidate({ id: parseInt(id!) });
      utils.approvals.getByRequest.invalidate({ requestId: parseInt(id!) });
      // Navigate back to purchase requests list
      setTimeout(() => {
        setLocation("/purchase-requests");
      }, 2000);
    },
    onError: (error) => {
      toast.error(`Erreur lors de la soumission: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!request) return;
    // If no description/justification, prompt the user
    if (!request.description?.trim()) {
      setJustifDialogOpen(true);
      return;
    }
    submitMutation.mutate({ id: request.id });
  };

  const handleJustifSubmit = () => {
    if (!justifText.trim() || justifText.trim().length < 10) {
      toast.error("La justification doit contenir au moins 10 caractères");
      return;
    }
    setJustifDialogOpen(false);
    updateMutation.mutate({ id: request!.id, description: justifText.trim() });
  };

  const bypassMutation = trpc.purchaseRequests.adminBypassApproval.useMutation({
    onSuccess: () => {
      toast.success(
        <div>
          <p className="font-semibold">Demande approuvée directement!</p>
          <p className="text-sm mt-1">La demande a été approuvée en tant qu'administrateur, en contournant la chaîne d'approbation.</p>
        </div>,
        { duration: 4000 }
      );
      utils.purchaseRequests.getById.invalidate({ id: parseInt(id!) });
      utils.approvals.getByRequest.invalidate({ requestId: parseInt(id!) });
      utils.settings.getEntityHistory.invalidate({ entityType: "purchaseRequest", entityId: parseInt(id!) });
      setBypassDialogOpen(false);
      setBypassComment("");
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleBypassApproval = () => {
    if (!request) return;
    bypassMutation.mutate({ 
      id: request.id,
      comment: bypassComment || undefined,
    });
  };

  const approveMutation = trpc.approvals.approve.useMutation({
    onSuccess: () => {
      toast.success(
        <div>
          <p className="font-semibold">Demande approuvée!</p>
          <p className="text-sm mt-1">Votre approbation a été enregistrée.</p>
        </div>,
        { duration: 4000 }
      );
      utils.purchaseRequests.getById.invalidate({ id: parseInt(id!) });
      utils.approvals.getByRequest.invalidate({ requestId: parseInt(id!) });
      utils.settings.getEntityHistory.invalidate({ entityType: "purchaseRequest", entityId: parseInt(id!) });
      setApproveDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const rejectMutation = trpc.approvals.reject.useMutation({
    onSuccess: () => {
      toast.success(
        <div>
          <p className="font-semibold">Demande rejetée!</p>
          <p className="text-sm mt-1">Votre rejet a été enregistré.</p>
        </div>,
        { duration: 4000 }
      );
      utils.purchaseRequests.getById.invalidate({ id: parseInt(id!) });
      utils.approvals.getByRequest.invalidate({ requestId: parseInt(id!) });
      utils.settings.getEntityHistory.invalidate({ entityType: "purchaseRequest", entityId: parseInt(id!) });
      setRejectDialogOpen(false);
      setRejectComment("");
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Find pending approval for current user
  const userPendingApproval = approvals?.find(
    (approval) => approval.decision === "pending" && approval.approverId === user?.id
  );

  const handleApprove = () => {
    if (!userPendingApproval) return;
    approveMutation.mutate({ approvalId: userPendingApproval.id });
  };

  const handleReject = () => {
    if (!userPendingApproval) return;
    rejectMutation.mutate({ 
      approvalId: userPendingApproval.id,
      comment: rejectComment || "",
    });
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

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <FileText className="h-16 w-16 text-muted-foreground/50" />
        <p className="text-muted-foreground">{t('errors.notFound')}</p>
        <Button onClick={() => setLocation("/purchase-requests")} variant="outline">
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
          <Button onClick={() => setLocation("/purchase-requests")} variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{request.title}</h1>
            <p className="text-muted-foreground mt-1">{request.requestNumber}</p>
          </div>
        </div>
        <span className={`status-badge status-${request.status}`}>
          {t(`purchaseRequests.status.${request.status}`)}
        </span>
      </div>

      {/* Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Montant estimé</p>
                <p className="text-xl font-bold">{formatCurrency(request.amountEstimate)} XOF</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date de création</p>
                <p className="text-sm font-medium">{formatDate(request.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <User className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Demandeur</p>
                <p className="text-sm font-medium">{(request as any).requester?.name ?? "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                request.urgencyLevel === 'critical' ? 'bg-red-100' :
                request.urgencyLevel === 'high' ? 'bg-orange-100' :
                request.urgencyLevel === 'medium' ? 'bg-yellow-100' :
                'bg-gray-100'
              }`}>
                <FileText className={`h-5 w-5 ${
                  request.urgencyLevel === 'critical' ? 'text-red-600' :
                  request.urgencyLevel === 'high' ? 'text-orange-600' :
                  request.urgencyLevel === 'medium' ? 'text-yellow-600' :
                  'text-gray-600'
                }`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Urgence</p>
                <p className="text-sm font-medium">{t(`purchaseRequests.urgency.${request.urgencyLevel}`)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      {request.description && (
        <Card>
          <CardHeader>
            <CardTitle>{t('common.description')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{request.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Items */
      <Card>
        <CardHeader>
          <CardTitle>{t('purchaseRequests.items')}</CardTitle>
          <CardDescription>Articles demandés dans cette demande</CardDescription>
        </CardHeader>
        <CardContent>
          {items && items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('purchaseRequests.itemName')}</TableHead>
                  <TableHead>{t('common.description')}</TableHead>
                  <TableHead className="text-right">{t('purchaseRequests.quantity')}</TableHead>
                  <TableHead className="text-right">{t('purchaseRequests.unitPrice')}</TableHead>
                  <TableHead className="text-right">{t('purchaseRequests.lineTotal')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell className="text-muted-foreground">{item.description || '-'}</TableCell>
                    <TableCell className="text-right">{item.quantity} {item.unit || 'pcs'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)} XOF</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(item.quantity) * Number(item.unitPrice))} XOF
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-bold">
                    {t('common.total')}
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg">
                    {formatCurrency(request.amountEstimate)} XOF
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

      {/* History */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Approbateurs</h3>
          </div>
        </div>
        {approvals && approvals.length > 0 && (
          <ApprovalChainVisualization approvals={approvals} />
        )}
        <Card>
          <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Historique</h3>
          {history && history.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">{history.length} action{history.length > 1 ? "s" : ""}</span>
          )}
        </div>
        <div className="px-4 py-3">
          <EntityHistory entries={history || []} isLoading={historyLoading} />
        </div>
      </div>
      {/* ── Action Bar — visible to all based on status + role ── */}
      {(() => {
        const isAdmin = user?.role === 'admin' || user?.role === 'procurement_manager';
        const isDraft = request.status === 'draft';
        const isPending = request.status === 'pending_approval';
        const isApproved = request.status === 'approved';
        const canActOnDoc = isAdmin || request.requesterId === user?.id;

        return (
          <Card className="sticky bottom-4 shadow-md border-2">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Left: context label */}
                <div className="text-sm text-muted-foreground">
                  {isDraft && "Brouillon — choisissez une action"}
                  {isPending && "En attente d'approbation"}
                  {isApproved && "Approuvée — prête pour commande"}
                  {request.status === 'rejected' && "Demande refusée"}
                  {request.status === 'cancelled' && "Demande annulée"}
                  {request.status === 'converted_to_po' && "Convertie en bon de commande"}
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Edit — always on draft */}
                  {isDraft && canActOnDoc && (
                    <Button variant="outline" onClick={() => setLocation(`/purchase-requests/${request.id}/edit`)}>
                      <Edit className="mr-2 h-4 w-4" />{t('common.edit')}
                    </Button>
                  )}

                  {/* Submit for approval */}
                  {isDraft && canActOnDoc && (
                    <Button variant="outline" onClick={handleSubmit} disabled={submitMutation.isPending}>
                      <Send className="mr-2 h-4 w-4" />
                      {submitMutation.isPending ? "Envoi..." : "Soumettre"}
                    </Button>
                  )}

                  {/* Admin: approve directly from draft OR pending */}
                  {isAdmin && (isDraft || isPending) && (
                    <Button
                      onClick={() => setBypassDialogOpen(true)}
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Approuver directement
                    </Button>
                  )}

                  {/* Admin: create PO from draft OR approved */}
                  {isAdmin && (isDraft || isApproved) && (
                    <Button
                      onClick={() => setLocation(`/purchase-orders/new?requestId=${request.id}`)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Créer un bon de commande
                    </Button>
                  )}

                  {/* Approver: approve/reject on pending */}
                  {userPendingApproval && isPending && (
                    <>
                      <Button
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => setRejectDialogOpen(true)}
                      >
                        <XCircle className="mr-2 h-4 w-4" />Rejeter
                      </Button>
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => setApproveDialogOpen(true)}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />Approuver
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Approve/Reject Buttons for Approvers */}
      {userPendingApproval && request.status === 'pending_approval' && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-green-900">Approbation requise</p>
                <p className="text-sm text-green-700">Cette demande attend votre approbation (Étape {userPendingApproval.stepOrder})</p>
              </div>
              <div className="flex gap-3">
                <Button 
                  onClick={() => setRejectDialogOpen(true)}
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Rejeter
                </Button>
                <Button 
                  onClick={() => setApproveDialogOpen(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approuver
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approve Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approuver cette demande?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous allez approuver cette demande d'achat. Cette action sera enregistrée dans l'historique.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending ? "Approbation en cours..." : "Approuver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter cette demande</DialogTitle>
            <DialogDescription>
              Veuillez fournir une raison pour le rejet de cette demande d'achat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Raison du rejet (optionnel)</label>
              <Textarea
                placeholder="Expliquez pourquoi vous rejetez cette demande..."
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectComment("");
              }}
            >
              Annuler
            </Button>
            <Button 
              onClick={handleReject}
              disabled={rejectMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {rejectMutation.isPending ? "Rejet en cours..." : "Rejeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bypass Approval Dialog */}
      <Dialog open={bypassDialogOpen} onOpenChange={setBypassDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approuver directement en tant qu'administrateur</DialogTitle>
            <DialogDescription>
              Cette action approuvera la demande immédiatement en contournant toutes les étapes d'approbation restantes.
              Cette action sera enregistrée dans l'historique.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Commentaire (optionnel)</label>
              <Textarea
                placeholder="Raison de l'approbation directe..."
                value={bypassComment}
                onChange={(e) => setBypassComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setBypassDialogOpen(false);
                setBypassComment("");
              }}
            >
              Annuler
            </Button>
            <Button 
              onClick={handleBypassApproval}
              disabled={bypassMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {bypassMutation.isPending ? "Approbation en cours..." : "Approuver directement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Justification required dialog */}
      <Dialog open={justifDialogOpen} onOpenChange={setJustifDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Justification requise</DialogTitle>
            <DialogDescription>
              La politique de votre organisation exige une justification avant de soumettre une demande d'achat.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={justifText}
              onChange={e => setJustifText(e.target.value)}
              placeholder="Expliquez pourquoi cet achat est nécessaire, pour quel projet, et l'impact si non satisfait..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">{justifText.length}/10 caractères minimum</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJustifDialogOpen(false)}>Annuler</Button>
            <button
              onClick={handleJustifSubmit}
              disabled={justifText.trim().length < 10 || updateMutation.isPending || submitMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold btn-primary text-white disabled:opacity-50">
              {(updateMutation.isPending || submitMutation.isPending) ? "Envoi..." : "Soumettre la demande"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
