import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import { ApprovalChainVisualization } from "@/components/ApprovalChainVisualization";
import { EntityHistory } from "@/components/EntityHistory";
import {
  ArrowLeft, Edit, Send, ShoppingCart, ShieldCheck, CheckCircle2, XCircle,
  Clock, AlertTriangle, Shield, RefreshCw, Package, User, Calendar,
  DollarSign, FileText, ChevronRight, MoreHorizontal, Zap
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; step: number }> = {
  draft:            { label: "Brouillon",          color: "text-gray-600",   bg: "bg-gray-100",   dot: "bg-gray-400",   step: 1 },
  submitted:        { label: "Soumis",              color: "text-blue-700",   bg: "bg-blue-100",   dot: "bg-blue-500",   step: 2 },
  pending_approval: { label: "En approbation",      color: "text-amber-700",  bg: "bg-amber-100",  dot: "bg-amber-500",  step: 2 },
  approved:         { label: "Approuvée",           color: "text-emerald-700",bg: "bg-emerald-100",dot: "bg-emerald-500",step: 3 },
  rejected:         { label: "Refusée",             color: "text-red-700",    bg: "bg-red-100",    dot: "bg-red-500",    step: 2 },
  cancelled:        { label: "Annulée",             color: "text-gray-500",   bg: "bg-gray-100",   dot: "bg-gray-400",   step: 1 },
  converted_to_po:  { label: "Convertie en BC",     color: "text-purple-700", bg: "bg-purple-100", dot: "bg-purple-500", step: 4 },
};

const URGENCY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low:      { label: "Faible",    color: "text-gray-600",   bg: "bg-gray-100"   },
  normal:   { label: "Normal",    color: "text-blue-700",   bg: "bg-blue-100"   },
  medium:   { label: "Modérée",   color: "text-amber-700",  bg: "bg-amber-100"  },
  high:     { label: "Élevée",    color: "text-orange-700", bg: "bg-orange-100" },
  critical: { label: "Critique",  color: "text-red-700",    bg: "bg-red-100"    },
};

function fmt(n: string | number) {
  return new Intl.NumberFormat("fr-FR").format(Number(n));
}
function fmtDate(d: any) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function PurchaseRequestDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [approveDialog, setApproveDialog] = useState(false);
  const [rejectDialog, setRejectDialog]   = useState(false);
  const [bypassDialog, setBypassDialog]   = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [bypassComment, setBypassComment] = useState("");
  const [justifDialog, setJustifDialog]   = useState(false);
  const [justifText, setJustifText]       = useState("");

  const { data: request, isLoading } = trpc.purchaseRequests.getById.useQuery({ id: parseInt(id!) }, { enabled: !!id });
  const { data: items = [] }         = trpc.purchaseRequests.getRequestItems.useQuery({ requestId: parseInt(id!) }, { enabled: !!id });
  const { data: approvals }          = trpc.approvals.getByRequest.useQuery({ requestId: parseInt(id!) }, { enabled: !!id });
  const { data: diagnosis }          = trpc.approvals.diagnoseApprovals.useQuery({ requestId: parseInt(id!) }, { enabled: !!id && !!request && request.status !== "draft" && (!approvals || approvals.length === 0) });
  const { data: history, isLoading: historyLoading } = trpc.settings.getEntityHistory.useQuery({ entityType: "purchaseRequest", entityId: parseInt(id!) }, { enabled: !!id });

  const utils = trpc.useUtils();
  const refresh = () => {
    utils.purchaseRequests.getById.invalidate();
    utils.approvals.getByRequest.invalidate({ requestId: parseInt(id!) });
    utils.settings.getEntityHistory.invalidate();
  };

  const updateMut  = trpc.purchaseRequests.update.useMutation({ onSuccess: refresh, onError: (e: any) => toast.error(e.message) });
  const submitMut  = trpc.purchaseRequests.submit.useMutation({ onSuccess: () => { toast.success("Demande soumise pour approbation"); refresh(); }, onError: (e: any) => toast.error(e.message) });
  const approveMut = trpc.approvals.approve.useMutation({ onSuccess: () => { toast.success("Approuvée"); setApproveDialog(false); refresh(); }, onError: (e: any) => toast.error(e.message) });
  const rejectMut  = trpc.approvals.reject.useMutation({ onSuccess: () => { toast.success("Refusée"); setRejectDialog(false); refresh(); }, onError: (e: any) => toast.error(e.message) });
  const bypassMut  = trpc.purchaseRequests.adminBypassApproval?.useMutation?.({ onSuccess: () => { toast.success("Approuvée (contournement)"); setBypassDialog(false); refresh(); }, onError: (e: any) => toast.error(e.message) });
  const cancelMut  = trpc.purchaseRequests.cancel.useMutation({ onSuccess: () => { toast.success("Annulée"); refresh(); }, onError: (e: any) => toast.error(e.message) });
  const resubmitMut = trpc.purchaseRequests.resubmit.useMutation({ onSuccess: () => { toast.success("Remise en brouillon"); refresh(); }, onError: (e: any) => toast.error(e.message) });

  const userPendingApproval = approvals?.find(a => a.decision === "pending" && (a as any).approverId === user?.id);
  const isAdmin   = user?.role === "admin" || user?.role === "procurement_manager";
  const isOwner   = request?.requesterId === user?.id;

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );
  if (!request) return <div className="p-8 text-center text-muted-foreground">Demande introuvable</div>;

  const statusCfg  = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.draft;
  const urgencyCfg = URGENCY_CONFIG[request.urgencyLevel ?? "normal"] ?? URGENCY_CONFIG.normal;
  const total      = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0) || Number(request.amountEstimate);
  const isPending  = request.status === "pending_approval";
  const isDraft    = request.status === "draft";
  const isApproved = request.status === "approved";
  const isRejected = request.status === "rejected";

  // ── Progress steps ────────────────────────────────────────────────────────
  const STEPS = [
    { n: 1, label: "Création",    icon: FileText   },
    { n: 2, label: "Approbation", icon: Shield     },
    { n: 3, label: "Approuvée",   icon: CheckCircle2 },
    { n: 4, label: "Bon de commande", icon: Package },
  ];
  const currentStep = statusCfg.step;

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 bg-white border-b px-6 py-3 flex items-center gap-4">
        <button onClick={() => setLocation("/purchase-requests")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /><span>Demandes</span>
        </button>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
        <span className="text-sm font-medium truncate max-w-48">{request.requestNumber}</span>

        <div className="ml-auto flex items-center gap-2">
          {/* Status pill */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </span>
          {/* Urgency pill */}
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${urgencyCfg.bg} ${urgencyCfg.color}`}>
            {urgencyCfg.label}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* ── Progress tracker ── */}
        <div className="bg-white rounded-2xl border p-5">
          <div className="flex items-center justify-between relative">
            {/* connector line */}
            <div className="absolute left-0 right-0 top-5 h-0.5 bg-gray-100 mx-14" />
            {STEPS.map((step, i) => {
              const done   = currentStep > step.n || (currentStep === step.n && isApproved && step.n === 3);
              const active = currentStep === step.n && !isRejected;
              const failed = isRejected && step.n === 2;
              const Icon   = step.icon;
              return (
                <div key={step.n} className="flex flex-col items-center gap-2 relative z-10">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    failed  ? "bg-red-500 border-red-500" :
                    done    ? "bg-emerald-500 border-emerald-500" :
                    active  ? "bg-blue-600 border-blue-600" :
                              "bg-white border-gray-200"
                  }`}>
                    {failed ? <XCircle className="h-5 w-5 text-white" /> :
                     done   ? <CheckCircle2 className="h-5 w-5 text-white" /> :
                              <Icon className={`h-5 w-5 ${active ? "text-white" : "text-gray-300"}`} />}
                  </div>
                  <span className={`text-xs font-medium ${
                    failed ? "text-red-600" : done ? "text-emerald-700" : active ? "text-blue-700" : "text-gray-400"
                  }`}>{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Action banner — context-aware ── */}
        {userPendingApproval && isPending && (
          <div className="bg-blue-600 text-white rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold">Votre approbation est requise</p>
                <p className="text-sm text-blue-100">Étape {userPendingApproval.stepOrder} · {request.title}</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setRejectDialog(true)}
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors">
                Rejeter
              </button>
              <button onClick={() => setApproveDialog(true)}
                className="px-4 py-2 rounded-xl bg-white text-blue-700 hover:bg-blue-50 text-sm font-semibold transition-colors">
                ✓ Approuver
              </button>
            </div>
          </div>
        )}

        {isDraft && (isOwner || isAdmin) && (
          <div className="bg-gradient-to-r from-gray-800 to-gray-700 text-white rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold">Brouillon — prêt à soumettre ?</p>
                <p className="text-sm text-gray-300">Vérifiez les articles puis soumettez pour approbation</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setLocation(`/purchase-requests/${request.id}/edit`)}
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors flex items-center gap-1.5">
                <Edit className="h-3.5 w-3.5" />Modifier
              </button>
              <button onClick={() => {
                if (!request.description?.trim()) { setJustifDialog(true); return; }
                submitMut.mutate({ id: request.id });
              }} disabled={submitMut.isPending}
                className="px-4 py-2 rounded-xl bg-white text-gray-900 hover:bg-gray-100 text-sm font-semibold transition-colors flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5" />
                {submitMut.isPending ? "Envoi..." : "Soumettre"}
              </button>
            </div>
          </div>
        )}

        {isApproved && (
          <div className="bg-emerald-600 text-white rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold">Demande approuvée !</p>
                <p className="text-sm text-emerald-100">Vous pouvez maintenant créer un bon de commande</p>
              </div>
            </div>
            {isAdmin && (
              <button onClick={() => setLocation(`/purchase-orders/new?requestId=${request.id}`)}
                className="px-4 py-2 rounded-xl bg-white text-emerald-700 hover:bg-emerald-50 text-sm font-semibold transition-colors flex items-center gap-1.5 shrink-0">
                <ShoppingCart className="h-3.5 w-3.5" />Créer un BC
              </button>
            )}
          </div>
        )}

        {request.status === "submitted" && isAdmin && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-amber-800">Aucun workflow d'approbation configuré</p>
                <p className="text-sm text-amber-600">Cette demande est en attente. Configurez un workflow ou approuvez manuellement via le contournement.</p>
              </div>
            </div>
            <button onClick={() => setLocation("/workflow-builder")}
              className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 shrink-0">
              Configurer un workflow →
            </button>
          </div>
        )}

        {request.status === "converted_to_po" && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
              <ShoppingCart className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-purple-800">Demande convertie en bon de commande</p>
              <p className="text-sm text-purple-600">Cette demande est verrouillée — un BC a été créé. Consultez le BC pour toute modification.</p>
            </div>
          </div>
        )}

        {isRejected && (isOwner || isAdmin) && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-red-800">Demande refusée</p>
                <p className="text-sm text-red-600">Vous pouvez la corriger et resoumettre</p>
              </div>
            </div>
            <button onClick={() => resubmitMut.mutate({ id: request.id })}
              className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-sm font-semibold transition-colors flex items-center gap-1.5 shrink-0">
              <RefreshCw className="h-3.5 w-3.5" />Corriger & resoumettre
            </button>
          </div>
        )}

        {/* ── Main info card ── */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50/50">
            <h1 className="font-semibold text-lg text-gray-900">{request.title}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{(request as any).requester?.name ?? "—"}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{fmtDate(request.createdAt)}</span>
              <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{request.requestNumber}</span>
              {request.departmentId && <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />Dép. {request.departmentId}</span>}
            </div>
          </div>

          {request.description && (
            <div className="px-6 py-4 border-b">
              <p className="text-sm text-muted-foreground leading-relaxed">{request.description}</p>
            </div>
          )}

          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Article</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qté</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prix unit.</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total ligne</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-gray-50/30"}`}>
                    <td className="px-6 py-3.5">
                      <p className="font-medium text-gray-900">{item.itemName}</p>
                      {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                    </td>
                    <td className="px-6 py-3.5 text-right text-muted-foreground">{item.quantity} {item.unit || "pcs"}</td>
                    <td className="px-6 py-3.5 text-right text-muted-foreground">{fmt(item.unitPrice)} XOF</td>
                    <td className="px-6 py-3.5 text-right font-semibold">{fmt(Number(item.quantity) * Number(item.unitPrice))} XOF</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50/70">
                  <td colSpan={3} className="px-6 py-4 text-right font-semibold text-gray-700">Total estimé</td>
                  <td className="px-6 py-4 text-right font-bold text-xl text-gray-900">{fmt(total)} <span className="text-sm font-normal text-muted-foreground">XOF</span></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Approval chain ── */}
        {request.status !== "draft" && (
          approvals && approvals.length > 0
            ? <ApprovalChainVisualization approvals={approvals} />
            : <div className="bg-white rounded-2xl border overflow-hidden">
                <div className="flex items-center gap-2 px-6 py-3 border-b">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Approbateurs</span>
                </div>
                {diagnosis && !diagnosis.matched ? (
                  <div className="p-6 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm text-amber-800">Aucune politique d'approbation ne correspond</p>
                      <p className="text-sm text-muted-foreground mt-1">{diagnosis.reason}</p>
                      <button onClick={() => setLocation("/settings")}
                        className="text-xs text-blue-600 hover:underline mt-2 inline-block">
                        → Configurer les workflows d'approbation
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-6 py-8 text-center text-muted-foreground text-sm">
                    <Clock className="h-6 w-6 mx-auto mb-2 opacity-20" />
                    Aucune étape d'approbation pour cette demande
                  </div>
                )}
              </div>
        )}

        {/* ── History ── */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Historique</span>
            </div>
            {history && history.length > 0 && (
              <span className="text-xs text-muted-foreground">{history.length} action{history.length > 1 ? "s" : ""}</span>
            )}
          </div>
          <div className="px-4 py-3">
            <EntityHistory entries={history || []} isLoading={historyLoading} />
          </div>
        </div>

        {/* ── Admin actions (secondary) ── */}
        {isAdmin && (isDraft || isPending) && (
          <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-800 font-medium">Actions administrateur</span>
            </div>
            <div className="flex gap-2">
              {!isDraft && (
                <button onClick={() => { const r = prompt("Motif d'annulation :"); if (r !== null) cancelMut.mutate({ id: request.id, reason: r || "Annulé" }); }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors">
                  Annuler
                </button>
              )}
              <button onClick={() => setBypassDialog(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />Contournement workflow
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'approbation</DialogTitle>
            <DialogDescription>Vous approuvez la demande "{request.title}" pour {fmt(total)} XOF.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(false)}>Annuler</Button>
            <button onClick={() => approveMut.mutate({ approvalId: userPendingApproval!.id })}
              disabled={approveMut.isPending}
              className="px-4 py-2 rounded-lg btn-primary text-white text-sm font-medium disabled:opacity-50">
              {approveMut.isPending ? "..." : "✓ Approuver"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motif du refus</DialogTitle>
            <DialogDescription>Expliquez pourquoi cette demande est refusée.</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} placeholder="Motif du refus (obligatoire)..." rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>Annuler</Button>
            <button onClick={() => { if (!rejectComment.trim()) { toast.error("Le motif est obligatoire"); return; } rejectMut.mutate({ approvalId: userPendingApproval!.id, comment: rejectComment }); }}
              disabled={rejectMut.isPending}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50">
              Rejeter
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bypassDialog} onOpenChange={setBypassDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contournement du workflow</DialogTitle>
            <DialogDescription>Force l'approbation sans passer par les étapes configurées. Cette action est journalisée.</DialogDescription>
          </DialogHeader>
          <Textarea value={bypassComment} onChange={e => setBypassComment(e.target.value)} placeholder="Justification du contournement..." rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBypassDialog(false)}>Annuler</Button>
            <button onClick={() => bypassMut?.mutate?.({ id: request.id, comment: bypassComment })}
              disabled={bypassMut?.isPending}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium disabled:opacity-50">
              Forcer l'approbation
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={justifDialog} onOpenChange={setJustifDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justification requise</DialogTitle>
            <DialogDescription>Expliquez brièvement pourquoi cet achat est nécessaire.</DialogDescription>
          </DialogHeader>
          <Textarea value={justifText} onChange={e => setJustifText(e.target.value)} placeholder="Justification..." rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setJustifDialog(false)}>Annuler</Button>
            <button onClick={() => { updateMut.mutate({ id: request.id, description: justifText }, { onSuccess: () => { setJustifDialog(false); submitMut.mutate({ id: request.id }); } }); }}
              className="px-4 py-2 rounded-lg btn-primary text-white text-sm font-medium">
              Sauvegarder et soumettre
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
