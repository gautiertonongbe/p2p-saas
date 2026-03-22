/**
 * PurchaseRequestPage — unified view + edit page
 * Same layout in both modes, fields become editable inline
 * Replaces PurchaseRequestDetail.tsx + PurchaseRequestForm.tsx
 */
import { trpc } from "@/lib/trpc";
import { PriceBenchmark } from "@/components/PriceBenchmark";
import CodingWidget, { type CodingValues } from "@/components/CodingWidget";
import { ApprovalChainVisualization } from "@/components/ApprovalChainVisualization";
import { EntityHistory } from "@/components/EntityHistory";
import { useLocation, useParams, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronRight, Edit2, Save, Send, Plus, Trash2,
  CheckCircle2, XCircle, Shield, ShieldCheck, Clock, AlertTriangle,
  ShoppingCart, RefreshCw, Package, User, Calendar, FileText, Zap
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ── Types & constants ──────────────────────────────────────────────────────────
type Item = { id?: number; itemName: string; description: string; quantity: string; unit: string; unitPrice: string };
const UNITS = ["pcs","kg","g","L","mL","m","cm","m²","m³","boîte","carton","palette","lot","heure","jour","mois"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; step: number }> = {
  draft:            { label:"Brouillon",         color:"text-gray-600",   bg:"bg-gray-100",   dot:"bg-gray-400",   step:1 },
  submitted:        { label:"Soumis",             color:"text-blue-700",   bg:"bg-blue-100",   dot:"bg-blue-500",   step:2 },
  pending_approval: { label:"En approbation",     color:"text-amber-700",  bg:"bg-amber-100",  dot:"bg-amber-500",  step:2 },
  approved:         { label:"Approuvée",          color:"text-emerald-700",bg:"bg-emerald-100",dot:"bg-emerald-500",step:3 },
  rejected:         { label:"Refusée",            color:"text-red-700",    bg:"bg-red-100",    dot:"bg-red-500",    step:2 },
  cancelled:        { label:"Annulée",            color:"text-gray-500",   bg:"bg-gray-100",   dot:"bg-gray-400",   step:1 },
  converted_to_po:  { label:"Convertie en BC",    color:"text-purple-700", bg:"bg-purple-100", dot:"bg-purple-500", step:4 },
};
const URGENCY = [
  { value:"low",      label:"Faible",   color:"text-gray-600",   bg:"bg-gray-100"   },
  { value:"medium",   label:"Normal",   color:"text-blue-700",   bg:"bg-blue-100"   },
  { value:"high",     label:"Élevé",    color:"text-orange-700", bg:"bg-orange-100" },
  { value:"critical", label:"Critique", color:"text-red-700",    bg:"bg-red-100"    },
];
function fmt(n: number|string) { return new Intl.NumberFormat("fr-FR").format(Number(n)); }
function parseNum(s: string) { return parseFloat(String(s).replace(/\s/g,"").replace(",",".")) || 0; }
function fmtDate(d: any) { if (!d) return "—"; return new Date(d).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}); }

// ── Field components — view vs edit mode ───────────────────────────────────────
function Field({ label, value, edit, children }: { label: string; value: React.ReactNode; edit: boolean; children?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      {edit ? children : <p className="text-sm font-medium text-gray-900">{value || "—"}</p>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PurchaseRequestPage() {
  const { id } = useParams<{ id?: string }>();
  const searchString = useSearch();
  const urlParams = searchString ? new URLSearchParams(searchString) : null;
  const copyFromId = urlParams?.get("copyFrom");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const isNew = !id || id === "new";
  const isCopy = !!copyFromId;
  const sourceId = isNew ? (copyFromId ? parseInt(copyFromId) : null) : parseInt(id!);

  const [editMode, setEditMode] = useState(isNew);
  const [prefilled, setPrefilled] = useState(false);

  // Form state
  const [title, setTitle]           = useState("");
  const [justification, setJustification] = useState("");
  const [urgency, setUrgency]       = useState<string>("medium");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [coding, setCoding]         = useState<CodingValues>({});
  const [items, setItems]           = useState<Item[]>([{ itemName:"", description:"", quantity:"1", unit:"pcs", unitPrice:"" }]);

  // Dialog state
  const [approveDialog, setApproveDialog] = useState(false);
  const [rejectDialog, setRejectDialog]   = useState(false);
  const [bypassDialog, setBypassDialog]   = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [bypassComment, setBypassComment] = useState("");

  // Queries
  const utils = trpc.useUtils();
  const { data: request, isLoading } = trpc.purchaseRequests.getById.useQuery(
    { id: sourceId! }, { enabled: !!sourceId }
  );
  const { data: existingItems = [] } = trpc.purchaseRequests.getRequestItems.useQuery(
    { requestId: sourceId! }, { enabled: !!sourceId }
  );
  const { data: approvals }  = trpc.approvals.getByRequest.useQuery(
    { requestId: parseInt(id!) }, { enabled: !isNew && !!id }
  );
  const { data: diagnosis }  = trpc.approvals.diagnoseApprovals.useQuery(
    { requestId: parseInt(id!) },
    { enabled: !isNew && !!id && !!request && request.status !== "draft" && (!approvals || approvals.length === 0) }
  );
  const { data: history, isLoading: histLoading } = trpc.settings.getEntityHistory.useQuery(
    { entityType: "purchaseRequest", entityId: parseInt(id!) }, { enabled: !isNew && !!id }
  );
  const { data: departments = [] } = trpc.settings.listDepartments.useQuery();

  // Prefill
  useEffect(() => {
    if ((request || existingItems.length) && !prefilled) {
      if (request) {
        setTitle(isCopy ? `Copie — ${request.title}` : (request.title || ""));
        setJustification((request as any).description || "");
        setUrgency((request as any).urgencyLevel || "medium");
        setDeliveryDate(request.deliveryDate ? new Date(request.deliveryDate).toISOString().split("T")[0] : "");
        setDepartmentId(request.departmentId ? String(request.departmentId) : "");
      }
      if (existingItems.length > 0) {
        setItems(existingItems.map((it: any) => ({
          id: it.id, itemName: it.itemName || "", description: it.description || "",
          quantity: String(it.quantity || 1), unit: it.unit || "pcs",
          unitPrice: String(Number(it.unitPrice) || 0),
        })));
      }
      setPrefilled(true);
    }
  }, [request, existingItems, prefilled, isCopy]);

  // Mutations
  const refresh = () => {
    utils.purchaseRequests.getById.invalidate();
    utils.purchaseRequests.list.invalidate();
    utils.approvals.getByRequest.invalidate({ requestId: parseInt(id!) });
    utils.settings.getEntityHistory.invalidate();
  };

  const createMut  = trpc.purchaseRequests.create.useMutation({
    onSuccess: (data: any) => { setEditMode(false); refresh(); setLocation(`/purchase-requests/${data.id}`); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut  = trpc.purchaseRequests.update.useMutation({
    onSuccess: () => { toast.success("Demande mise à jour"); setEditMode(false); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const submitMut  = trpc.purchaseRequests.submit.useMutation({
    onSuccess: () => { toast.success("Demande soumise pour approbation"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const approveMut = trpc.approvals.approve.useMutation({
    onSuccess: () => { toast.success("Approuvée"); setApproveDialog(false); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const rejectMut  = trpc.approvals.reject.useMutation({
    onSuccess: () => { toast.success("Refusée"); setRejectDialog(false); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const bypassMut  = trpc.purchaseRequests.adminBypassApproval?.useMutation?.({
    onSuccess: () => { toast.success("Approuvée (contournement)"); setBypassDialog(false); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const cancelMut  = trpc.purchaseRequests.cancel.useMutation({
    onSuccess: () => { toast.success("Annulée"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const resubmitMut = trpc.purchaseRequests.resubmit.useMutation({
    onSuccess: () => { toast.success("Remise en brouillon"); setEditMode(true); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Computed
  const isAdmin   = user?.role === "admin" || user?.role === "procurement_manager";
  const isOwner   = request?.requesterId === user?.id;
  const canEdit   = (isNew || (request?.status === "draft" && (isOwner || isAdmin)));
  const status    = request?.status || "draft";
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const urgCfg    = URGENCY.find(u => u.value === urgency) ?? URGENCY[1];
  const userPendingApproval = approvals?.find((a: any) => a.decision === "pending" && a.approverId === user?.id);
  const total     = items.reduce((s, it) => s + (parseFloat(String(it.quantity)) || 0) * parseNum(it.unitPrice), 0);
  const isPending = createMut.isPending || updateMut.isPending || submitMut.isPending;

  const buildPayload = () => ({
    title: title.trim(),
    description: justification.trim() || undefined,
    urgencyLevel: urgency,
    deliveryDate: deliveryDate || undefined,
    departmentId: departmentId ? parseInt(departmentId) : undefined,
    glAccountId: coding.glAccountId ? parseInt(coding.glAccountId) : undefined,
    projectId: coding.projectId ? parseInt(coding.projectId) : undefined,
    costCenterId: coding.costCenterId ? parseInt(coding.costCenterId) : undefined,
    amountEstimate: total,
    items: items.filter(it => it.itemName.trim()).map(it => ({
      itemName: it.itemName.trim(),
      description: it.description.trim() || undefined,
      quantity: parseFloat(String(it.quantity)) || 1,
      unit: it.unit || undefined,
      unitPrice: parseNum(it.unitPrice),
      totalPrice: (parseFloat(String(it.quantity)) || 1) * parseNum(it.unitPrice),
    })),
  });

  const handleSave = () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    if (isNew) createMut.mutate(buildPayload() as any);
    else if (id) updateMut.mutate({ id: parseInt(id), ...buildPayload() } as any);
  };

  const handleSubmitDirect = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    if (items.every(it => !it.itemName.trim())) { toast.error("Ajoutez au moins un article"); return; }
    if (isNew) {
      const data: any = await createMut.mutateAsync(buildPayload() as any).catch(() => null);
      if (data?.id) submitMut.mutate({ id: data.id });
    } else if (request?.status === "draft" && id) {
      await updateMut.mutateAsync({ id: parseInt(id), ...buildPayload() } as any).catch(() => {});
      submitMut.mutate({ id: parseInt(id) });
    }
  };

  if (!isNew && isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* ── Sticky topbar ── */}
      <div className="sticky top-0 z-30 bg-white border-b px-6 py-3 flex items-center gap-3">
        <button onClick={() => setLocation("/purchase-requests")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />Demandes
        </button>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
        <span className="text-sm font-medium truncate max-w-48">
          {isNew ? "Nouvelle demande" : (request?.requestNumber || "...")}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Status pill */}
          {!isNew && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
              {statusCfg.label}
            </span>
          )}

          {/* Edit mode toggle */}
          {!isNew && canEdit && !editMode && (
            <button onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm font-medium transition-colors">
              <Edit2 className="h-3.5 w-3.5" />Modifier
            </button>
          )}

          {/* Save / Cancel edit */}
          {editMode && !isNew && (
            <>
              <button onClick={() => { setEditMode(false); setPrefilled(false); }}
                className="px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition-colors">
                Annuler
              </button>
              <button onClick={handleSave} disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg btn-primary text-white text-sm font-semibold disabled:opacity-50">
                <Save className="h-3.5 w-3.5" />{isPending ? "Sauvegarde..." : "Sauvegarder"}
              </button>
            </>
          )}

          {/* New: save draft + submit */}
          {isNew && (
            <>
              <button onClick={handleSave} disabled={isPending}
                className="px-3 py-1.5 rounded-lg border text-sm hover:bg-muted disabled:opacity-50 transition-colors">
                Brouillon
              </button>
              <button onClick={handleSubmitDirect} disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg btn-primary text-white text-sm font-semibold disabled:opacity-50">
                <Send className="h-3.5 w-3.5" />{isPending ? "Envoi..." : "Soumettre"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* ── Progress ── */}
        {!isNew && (
          <div className="bg-white rounded-2xl border p-5">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 right-0 top-5 h-0.5 bg-gray-100 mx-14" />
              {[
                { n:1, label:"Création",     icon:FileText    },
                { n:2, label:"Approbation",  icon:Shield      },
                { n:3, label:"Approuvée",    icon:CheckCircle2 },
                { n:4, label:"Bon de commande", icon:Package  },
              ].map((step) => {
                const done   = statusCfg.step > step.n;
                const active = statusCfg.step === step.n;
                const failed = status === "rejected" && step.n === 2;
                const Icon   = step.icon;
                return (
                  <div key={step.n} className="flex flex-col items-center gap-2 relative z-10">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      failed  ? "bg-red-500 border-red-500" :
                      done    ? "bg-emerald-500 border-emerald-500" :
                      active  ? "bg-blue-600 border-blue-600" : "bg-white border-gray-200"
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
        )}

        {/* ── Context banners ── */}
        {userPendingApproval && status === "pending_approval" && (
          <div className="bg-blue-600 text-white rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Votre approbation est requise</p>
                <p className="text-sm text-blue-100">Étape {userPendingApproval.stepOrder}</p>
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
            <div>
              <p className="font-semibold">Demande approuvée — créez le bon de commande</p>
              <p className="text-sm text-emerald-100">Sélectionnez un fournisseur et émettez le BC</p>
            </div>
            <button onClick={() => setLocation(`/purchase-orders/new?requestId=${id}`)}
              className="px-4 py-2 rounded-xl bg-white text-emerald-700 text-sm font-semibold hover:bg-emerald-50 shrink-0 flex items-center gap-1.5">
              <ShoppingCart className="h-4 w-4" />Créer un BC
            </button>
          </div>
        )}
        {status === "rejected" && (isOwner || isAdmin) && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500 shrink-0" />
              <div>
                <p className="font-semibold text-red-800">Demande refusée</p>
                <p className="text-sm text-red-600">Modifiez et resoumettez</p>
              </div>
            </div>
            <button onClick={() => resubmitMut.mutate({ id: parseInt(id!) })}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 shrink-0 flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />Corriger & resoumettre
            </button>
          </div>
        )}
        {status === "draft" && (isOwner || isAdmin) && !editMode && (
          <div className="bg-gray-800 text-white rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Brouillon — prêt à soumettre ?</p>
              <p className="text-sm text-gray-300">Vérifiez les articles puis soumettez pour approbation</p>
            </div>
            <button onClick={() => submitMut.mutate({ id: parseInt(id!) })} disabled={submitMut.isPending}
              className="px-4 py-2 rounded-xl bg-white text-gray-900 text-sm font-semibold hover:bg-gray-100 shrink-0 flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5" />{submitMut.isPending ? "..." : "Soumettre"}
            </button>
          </div>
        )}

        {/* ── Main document card ── */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          {/* Header meta */}
          <div className={`px-6 py-5 border-b ${editMode ? "bg-blue-50/40" : ""}`}>
            {editMode ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Titre *</label>
                  <input value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="Ex: Achat de fournitures bureau Q2 2026"
                    className="w-full text-lg font-semibold border-b-2 border-blue-400 bg-transparent outline-none pb-1 focus:border-blue-600" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Urgence</label>
                    <div className="flex gap-2">
                      {URGENCY.map(u => (
                        <button key={u.value} onClick={() => setUrgency(u.value)}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                            urgency === u.value ? `${u.bg} ${u.color} border-current` : "border-gray-200 text-gray-400 hover:border-gray-300"
                          }`}>{u.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Livraison souhaitée</label>
                    <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Justification</label>
                  <textarea value={justification} onChange={e => setJustification(e.target.value)}
                    placeholder="Pourquoi cet achat est-il nécessaire ?"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {departments.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Département</label>
                    <Select value={departmentId || "none"} onValueChange={v => setDepartmentId(v === "none" ? "" : v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Aucun —</SelectItem>
                        {(departments as any[]).map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h1 className="text-xl font-bold text-gray-900">{request?.title || "—"}</h1>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{(request as any)?.requester?.name || "—"}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{fmtDate(request?.createdAt)}</span>
                  {request?.requestNumber && <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{request.requestNumber}</span>}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${urgCfg.bg} ${urgCfg.color}`}>
                    <Zap className="h-3 w-3" />{urgCfg.label}
                  </span>
                </div>
                {(request as any)?.description && (
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{(request as any).description}</p>
                )}
              </div>
            )}
          </div>

          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Article</th>
                  {editMode && <th className="px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24">Unité</th>}
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20">Qté</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-32">Prix unit.</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-32">Total</th>
                  {editMode && <th className="w-10"></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <>
                    <tr key={i} className={`border-b ${editMode ? "bg-blue-50/10" : i%2 ? "bg-gray-50/30" : ""}`}>
                      <td className="px-6 py-3">
                        {editMode ? (
                          <div className="space-y-1">
                            <input value={item.itemName} onChange={e => setItems(prev => prev.map((it,j) => j===i ? {...it, itemName: e.target.value} : it))}
                              placeholder="Nom de l'article..."
                              className="w-full border-b border-gray-300 bg-transparent text-sm font-medium outline-none focus:border-blue-500 pb-0.5" />
                            <input value={item.description} onChange={e => setItems(prev => prev.map((it,j) => j===i ? {...it, description: e.target.value} : it))}
                              placeholder="Description (optionnel)"
                              className="w-full bg-transparent text-xs text-muted-foreground outline-none" />
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium text-gray-900">{item.itemName}</p>
                            {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                          </div>
                        )}
                      </td>
                      {editMode && (
                        <td className="px-3 py-3">
                          <Select value={item.unit || "pcs"} onValueChange={v => setItems(prev => prev.map((it,j) => j===i ? {...it, unit: v} : it))}>
                            <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
                            <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        {editMode ? (
                          <input type="number" value={item.quantity} min="0.01" step="0.01"
                            onChange={e => setItems(prev => prev.map((it,j) => j===i ? {...it, quantity: e.target.value} : it))}
                            className="w-16 text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        ) : (
                          <span className="text-muted-foreground">{item.quantity} {item.unit || "pcs"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editMode ? (
                          <input type="text" inputMode="decimal" value={item.unitPrice}
                            onChange={e => setItems(prev => prev.map((it,j) => j===i ? {...it, unitPrice: e.target.value} : it))}
                            placeholder="0"
                            className="w-28 text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        ) : (
                          <span className="text-muted-foreground">{fmt(parseNum(item.unitPrice))} XOF</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold">
                        {fmt((parseFloat(String(item.quantity))||0) * parseNum(item.unitPrice))} XOF
                      </td>
                      {editMode && (
                        <td className="px-2 py-3">
                          {items.length > 1 && (
                            <button onClick={() => setItems(prev => prev.filter((_,j) => j!==i))}
                              className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                    {/* Price benchmark row */}
                    {editMode && item.itemName.trim().length >= 3 && parseNum(item.unitPrice) > 0 && (
                      <tr key={`bench-${i}`} className="bg-blue-50/20">
                        <td colSpan={6} className="px-6 py-2">
                          <PriceBenchmark itemName={item.itemName} unitPrice={parseNum(item.unitPrice)}
                            unit={item.unit} quantity={parseFloat(String(item.quantity))||1} description={item.description} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
              <tfoot>
                {editMode && (
                  <tr>
                    <td colSpan={6} className="px-6 py-3 border-t">
                      <button onClick={() => setItems(prev => [...prev, { itemName:"", description:"", quantity:"1", unit:"pcs", unitPrice:"" }])}
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
                        <Plus className="h-4 w-4" />Ajouter un article
                      </button>
                    </td>
                  </tr>
                )}
                <tr className="bg-gray-50/70 border-t">
                  <td colSpan={editMode ? 4 : 3} className="px-6 py-4 text-right font-semibold text-gray-700">Total estimé</td>
                  <td className="px-6 py-4 text-right font-bold text-xl text-gray-900">{fmt(total)} <span className="text-sm font-normal text-muted-foreground">XOF</span></td>
                  {editMode && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Coding — only in edit mode */}
          {editMode && (
            <div className="px-6 py-4 border-t bg-gray-50/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Imputation comptable</p>
              <CodingWidget value={coding} onChange={setCoding} />
            </div>
          )}
        </div>

        {/* ── Approval chain ── */}
        {!isNew && status !== "draft" && (
          approvals && approvals.length > 0
            ? <ApprovalChainVisualization approvals={approvals} />
            : <div className="bg-white rounded-2xl border overflow-hidden">
                <div className="flex items-center gap-2 px-6 py-3 border-b">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Approbateurs</span>
                </div>
                {diagnosis && !diagnosis.matched ? (
                  <div className="p-5 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm text-amber-800">Aucune politique ne correspond</p>
                      <p className="text-sm text-muted-foreground mt-1">{diagnosis.reason}</p>
                      <button onClick={() => setLocation("/workflows")} className="text-xs text-blue-600 hover:underline mt-2 block">→ Configurer les workflows</button>
                    </div>
                  </div>
                ) : (
                  <div className="px-6 py-8 text-center text-muted-foreground text-sm">
                    <Clock className="h-6 w-6 mx-auto mb-2 opacity-20" />Aucune étape d'approbation configurée
                  </div>
                )}
              </div>
        )}

        {/* ── History ── */}
        {!isNew && (
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
              <EntityHistory entries={history || []} isLoading={histLoading} />
            </div>
          </div>
        )}

        {/* ── Admin actions ── */}
        {!isNew && isAdmin && (status === "draft" || status === "pending_approval") && (
          <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-800 font-medium">Actions administrateur</span>
            </div>
            <div className="flex gap-2">
              {status !== "draft" && (
                <button onClick={() => { const r = prompt("Motif d'annulation :"); if (r !== null) cancelMut.mutate({ id: parseInt(id!), reason: r || "Annulé" }); }}
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
            <DialogDescription>Approuver la demande "{request?.title}"</DialogDescription>
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
          <DialogHeader><DialogTitle>Motif du refus</DialogTitle></DialogHeader>
          <Textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} placeholder="Motif obligatoire..." rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>Annuler</Button>
            <button onClick={() => { if (!rejectComment.trim()) { toast.error("Motif requis"); return; } rejectMut.mutate({ approvalId: userPendingApproval!.id, comment: rejectComment }); }}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50">
              Rejeter
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bypassDialog} onOpenChange={setBypassDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Contournement du workflow</DialogTitle><DialogDescription>Force l'approbation. Action journalisée.</DialogDescription></DialogHeader>
          <Textarea value={bypassComment} onChange={e => setBypassComment(e.target.value)} placeholder="Justification..." rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBypassDialog(false)}>Annuler</Button>
            <button onClick={() => bypassMut?.mutate?.({ id: parseInt(id!), comment: bypassComment })}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium">
              Forcer l'approbation
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
