import { PageHeader } from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, Clock, FileText, UserCheck } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export default function ApprovalsList() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [rejectComments, setRejectComments] = useState<Record<number, string>>({});
  const [delegateDialogOpen, setDelegateDialogOpen] = useState(false);
  const [delegatingApprovalId, setDelegatingApprovalId] = useState<number | null>(null);
  const [delegateToUserId, setDelegateToUserId] = useState<string>("");
  const [delegateComment, setDelegateComment] = useState("");

  const { data: pendingApprovals, isLoading: loadingPending } = trpc.approvals.myPendingApprovals.useQuery();
  const { data: completedApprovals, isLoading: loadingCompleted } = trpc.approvals.myCompletedApprovals.useQuery();
  const { data: orgUsers } = trpc.settings.listUsers.useQuery();

  const invalidateAll = () => {
    utils.approvals.myPendingApprovals.invalidate();
    utils.approvals.myCompletedApprovals.invalidate();
    utils.purchaseRequests.list.invalidate();
  };

  const approveMutation = trpc.approvals.approve.useMutation({
    onSuccess: () => {
      toast.success("Approbation enregistrée avec succès");
      invalidateAll();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const rejectMutation = trpc.approvals.reject.useMutation({
    onSuccess: () => {
      toast.success("Demande rejetée");
      invalidateAll();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const delegateMutation = trpc.approvals.delegate.useMutation({
    onSuccess: () => {
      toast.success("Approbation déléguée avec succès");
      setDelegateDialogOpen(false);
      setDelegatingApprovalId(null);
      setDelegateToUserId("");
      setDelegateComment("");
      invalidateAll();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const handleApprove = (approvalId: number) => {
    approveMutation.mutate({ approvalId });
  };

  const handleReject = (approvalId: number) => {
    const comment = rejectComments[approvalId] || "";
    if (!comment.trim()) {
      toast.error("Veuillez fournir une raison pour le rejet");
      return;
    }
    rejectMutation.mutate({ approvalId, comment });
    setRejectComments(prev => ({ ...prev, [approvalId]: "" }));
  };

  const openDelegateDialog = (approvalId: number) => {
    setDelegatingApprovalId(approvalId);
    setDelegateDialogOpen(true);
  };

  const handleDelegate = () => {
    if (!delegatingApprovalId || !delegateToUserId) {
      toast.error("Veuillez sélectionner un utilisateur");
      return;
    }
    delegateMutation.mutate({
      approvalId: delegatingApprovalId,
      delegateToUserId: parseInt(delegateToUserId),
      comment: delegateComment || undefined,
    });
  };

  const formatCurrency = (amount: string | number) =>
    new Intl.NumberFormat("fr-FR").format(Number(amount));

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleDateString("fr-FR");

  const decisionBadge = (decision: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending:   { label: "En attente",  className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      approved:  { label: "Approuvé",    className: "bg-green-100 text-green-800 border-green-200" },
      rejected:  { label: "Rejeté",      className: "bg-red-100 text-red-800 border-red-200" },
      delegated: { label: "Délégué",     className: "bg-blue-100 text-blue-800 border-blue-200" },
    };
    const cfg = map[decision] ?? { label: decision, className: "" };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
        {cfg.label}
      </span>
    );
  };

  const PendingRow = ({ approval }: { approval: any }) => (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <Link href={`/purchase-requests/${approval.requestId}`}>
          <div className="flex items-center gap-2 cursor-pointer hover:text-primary">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="font-medium">{approval.request?.title || "—"}</div>
              <div className="text-xs text-muted-foreground">{approval.request?.requestNumber}</div>
            </div>
          </div>
        </Link>
      </TableCell>
      <TableCell className="font-medium">
        {formatCurrency(approval.request?.amountEstimate || 0)} XOF
      </TableCell>
      <TableCell>
        <Badge variant="outline">Niveau {approval.stepOrder || 1}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatDate(approval.createdAt)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-2 justify-end flex-wrap">
          {/* Delegate */}
          <Button
            size="sm"
            variant="ghost"
            className="text-blue-600 hover:bg-blue-50"
            onClick={() => openDelegateDialog(approval.id)}
            disabled={delegateMutation.isPending}
          >
            <UserCheck className="mr-1 h-3 w-3" />
            Déléguer
          </Button>

          {/* Reject */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5">
                <XCircle className="mr-1 h-3 w-3" />
                {t("approvals.reject")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rejeter la demande</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir rejeter cette demande ? Une raison est requise.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
      <PageHeader
        icon={<CheckCircle className="h-5 w-5" />}
        title="Approbations"
        description="File d'attente de vos approbations"
      />
<label className="text-sm font-medium">Raison du rejet *</label>
                <Textarea
                  value={rejectComments[approval.id] || ""}
                  onChange={(e) => setRejectComments(prev => ({ ...prev, [approval.id]: e.target.value }))}
                  placeholder="Expliquez la raison du rejet..."
                  rows={3}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleReject(approval.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? "Rejet en cours..." : "Confirmer le rejet"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Approve */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={approveMutation.isPending}>
                <CheckCircle className="mr-1 h-3 w-3" />
                {t("approvals.approve")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Approuver la demande</AlertDialogTitle>
                <AlertDialogDescription>
                  Confirmez-vous l'approbation de «{approval.request?.title}» pour{" "}
                  <strong>{formatCurrency(approval.request?.amountEstimate || 0)} XOF</strong> ?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleApprove(approval.id)}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending ? "Approbation..." : "Confirmer l'approbation"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );

  const CompletedRow = ({ approval }: { approval: any }) => (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <Link href={`/purchase-requests/${approval.requestId}`}>
          <div className="flex items-center gap-2 cursor-pointer hover:text-primary">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="font-medium">{approval.request?.title || "—"}</div>
              <div className="text-xs text-muted-foreground">{approval.request?.requestNumber}</div>
            </div>
          </div>
        </Link>
      </TableCell>
      <TableCell className="font-medium">
        {formatCurrency(approval.request?.amountEstimate || 0)} XOF
      </TableCell>
      <TableCell>
        <Badge variant="outline">Niveau {approval.stepOrder || 1}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatDate(approval.createdAt)}
      </TableCell>
      <TableCell>{decisionBadge(approval.decision)}</TableCell>
      <TableCell className="text-muted-foreground text-sm text-right">
        {approval.decidedAt ? formatDate(approval.decidedAt) : "—"}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
<div>
        <h1 className="text-3xl font-bold tracking-tight">{t("approvals.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("approvals.myApprovals")}</p>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            {t("approvals.pending")}
            {pendingApprovals && pendingApprovals.length > 0 && (
              <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {pendingApprovals.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            {t("approvals.completed")}
            {completedApprovals && completedApprovals.length > 0 && (
              <span className="ml-1 rounded-full bg-muted-foreground/20 px-2 py-0.5 text-xs">
                {completedApprovals.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Approbations en attente</CardTitle>
              <CardDescription>Demandes nécessitant votre action</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingPending ? (
                <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>
              ) : pendingApprovals && pendingApprovals.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Demande</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Niveau</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingApprovals.map((approval) => (
                      <PendingRow key={approval.id} approval={approval} />
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-12 text-center">
                  <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground font-medium">Aucune approbation en attente</p>
                  <p className="text-sm text-muted-foreground mt-1">Toutes les demandes ont été traitées</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Completed Tab */}
        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>Historique des approbations</CardTitle>
              <CardDescription>Décisions passées sur les demandes d'achat</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingCompleted ? (
                <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>
              ) : completedApprovals && completedApprovals.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Demande</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Niveau</TableHead>
                      <TableHead>Date demande</TableHead>
                      <TableHead>Décision</TableHead>
                      <TableHead className="text-right">Date décision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedApprovals.map((approval) => (
                      <CompletedRow key={approval.id} approval={approval} />
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-12 text-center">
                  <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground font-medium">Aucune approbation complétée</p>
                  <p className="text-sm text-muted-foreground mt-1">Votre historique apparaîtra ici</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delegate Dialog */}
      <Dialog open={delegateDialogOpen} onOpenChange={setDelegateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Déléguer l'approbation</DialogTitle>
            <DialogDescription>
              Transférer cette approbation à un autre utilisateur de votre organisation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Déléguer à *</label>
              <Select value={delegateToUserId} onValueChange={setDelegateToUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un utilisateur..." />
                </SelectTrigger>
                <SelectContent>
                  {orgUsers?.filter(u => u.status === "active").map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      <div className="flex flex-col">
                        <span>{u.name || u.email}</span>
                        <span className="text-xs text-muted-foreground capitalize">{u.role?.replace("_", " ")}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Commentaire (optionnel)</label>
              <Textarea
                value={delegateComment}
                onChange={(e) => setDelegateComment(e.target.value)}
                placeholder="Raison de la délégation..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelegateDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleDelegate}
              disabled={!delegateToUserId || delegateMutation.isPending}
            >
              {delegateMutation.isPending ? "Délégation en cours..." : "Déléguer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
