import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { toast } from "sonner";
import { ApprovalChainVisualization } from "@/components/ApprovalChainVisualization";
import { EntityHistory } from "@/components/EntityHistory";
import { useAuth } from "@/_core/hooks/useAuth";
import { Shield, ThumbsUp, ThumbsDown, ArrowLeft, CreditCard, Smartphone, Building2, Banknote, CheckCircle2, AlertCircle, Clock, Send, XCircle, ShieldCheck, FileText, AlertTriangle, Download, Copy, Edit2, ChevronRight, Package, User, Calendar, DollarSign} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Three-Way Match Panel ─────────────────────────────────────────────────────
function ThreeWayMatchPanel({
  invoiceId, matchStatus, canManage, onMatchComplete,
}: { invoiceId: number; matchStatus: string | null; canManage: boolean; onMatchComplete: () => void }) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const matchMutation = trpc.invoices.performThreeWayMatch.useMutation({
    onSuccess: (data) => {
      setResult(data);
      onMatchComplete();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusConfig: Record<string, { label: string; icon: React.FC<any>; cls: string }> = {
    matched:       { label: "Rapproché ✓",        icon: CheckCircle2, cls: "border-green-200 bg-green-50/50" },
    partial_match: { label: "Rapprochement partiel", icon: AlertCircle, cls: "border-yellow-200 bg-yellow-50/50" },
    unmatched:     { label: "Non rapproché",       icon: AlertCircle, cls: "border-gray-200 bg-muted/30" },
    exception:     { label: "Exception",           icon: AlertCircle, cls: "border-red-200 bg-red-50/50" },
  };

  const current = matchStatus ? statusConfig[matchStatus] : null;
  const matchResult = result ?? (matchStatus !== "unmatched" ? { matched: matchStatus === "matched" } : null);

  const CheckLeg = ({ label, passed, detail }: { label: string; passed: boolean; detail?: string }) => (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${passed ? "border-green-200 bg-green-50/40" : "border-red-200 bg-red-50/40"}`}>
      <div className={`mt-0.5 shrink-0 ${passed ? "text-green-600" : "text-red-600"}`}>
        {passed ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      </div>
      <div>
        <p className={`text-sm font-medium ${passed ? "text-green-800" : "text-red-800"}`}>{label}</p>
        {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
      </div>
    </div>
  );

  return (
    <Card className={current ? current.cls : "border-muted"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Rapprochement 3 voies</CardTitle>
            <CardDescription className="mt-0.5">
              Bon de commande · Réception · Facture
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {current && (
              <span className={`text-sm font-medium ${matchStatus === "matched" ? "text-green-700" : matchStatus === "exception" ? "text-red-700" : "text-yellow-700"}`}>
                {current.label}
              </span>
            )}
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                disabled={matchMutation.isPending}
                onClick={() => matchMutation.mutate({ invoiceId })}
              >
                {matchMutation.isPending ? "Vérification..." : "Lancer le rapprochement"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {(result || (matchStatus && matchStatus !== "unmatched")) && (
        <CardContent className="pt-0">
          <div className="grid gap-2 sm:grid-cols-3">
            <CheckLeg
              label="Fournisseur"
              passed={result?.details?.vendorMatch ?? matchStatus === "matched"}
              detail="Fournisseur identique sur BC et facture"
            />
            <CheckLeg
              label="Montant (±5%)"
              passed={result?.details?.amountMatch ?? matchStatus === "matched"}
              detail={result?.details
                ? `BC: ${new Intl.NumberFormat("fr-FR").format(result.details.poAmount)} XOF · Facture: ${new Intl.NumberFormat("fr-FR").format(result.details.invoiceAmount)} XOF`
                : "Comparaison montant BC vs facture"}
            />
            <CheckLeg
              label="Réception des marchandises"
              passed={result ? result.matched || result.status !== "exception" || result.details?.vendorMatch : matchStatus === "matched"}
              detail={result?.reason ?? "Bon de réception enregistré"}
            />
          </div>
          {result && (
            <p className={`mt-3 text-sm font-medium text-center ${result.matched ? "text-green-700" : "text-red-700"}`}>
              {result.matched
                ? "✓ Rapprochement réussi — prêt pour approbation"
                : `✗ Rapprochement échoué${result.reason ? ` : ${result.reason}` : ""}`}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Dispute Panel ─────────────────────────────────────────────────────────────
function DisputePanel({ invoiceId, onSuccess, externalOpen, onExternalClose }: { invoiceId: number; onSuccess: () => void; externalOpen?: boolean; onExternalClose?: () => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => { setInternalOpen(v); if (!v && onExternalClose) onExternalClose(); };
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  const mut = trpc.invoices.dispute.useMutation({
    onSuccess: () => { toast.success("Litige signalé — les responsables achats ont été notifiés"); setOpen(false); setReason(""); setDetails(""); onSuccess(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <div className="p-4 border border-orange-200 bg-orange-50/40 rounded-lg flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><AlertCircle className="h-4 w-4 text-orange-600" /></div>
          <div>
            <p className="font-medium text-orange-900 text-sm">Problème avec cette facture ?</p>
            <p className="text-xs text-orange-700">Signalez un litige pour investigation avant paiement</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="border-orange-300 text-orange-700 hover:bg-orange-100" onClick={() => setOpen(true)}>
          <AlertCircle className="mr-2 h-4 w-4" />Signaler un litige
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-orange-700">Signaler un litige</DialogTitle>
            <DialogDescription>Expliquez le problème avec cette facture. Les responsables achats seront notifiés immédiatement.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Motif du litige *</Label>
              <Select onValueChange={setReason} value={reason}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un motif..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Montant incorrect">Montant incorrect</SelectItem>
                  <SelectItem value="Articles non reçus">Articles non reçus ou incomplets</SelectItem>
                  <SelectItem value="Prix différent du BC">Prix différent du bon de commande</SelectItem>
                  <SelectItem value="Facture en double">Facture en double</SelectItem>
                  <SelectItem value="Fournisseur incorrect">Fournisseur incorrect</SelectItem>
                  <SelectItem value="Date incorrecte">Date incorrecte</SelectItem>
                  <SelectItem value="Autre">Autre (préciser ci-dessous)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Détails supplémentaires</Label>
              <Textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Décrivez précisément le problème..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="bg-orange-600 hover:bg-orange-700" disabled={!reason || mut.isPending}
              onClick={() => mut.mutate({ invoiceId, reason, details: details || undefined })}>
              {mut.isPending ? "Envoi..." : "Signaler le litige"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Resolve Dispute Panel ─────────────────────────────────────────────────────
function ResolveDisputePanel({ invoiceId, disputeReason, onSuccess }: { invoiceId: number; disputeReason?: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<"approve" | "reject" | "request_revision">("approve");
  const [notes, setNotes] = useState("");

  const mut = trpc.invoices.resolveDispute.useMutation({
    onSuccess: (d) => {
      const msgs: Record<string, string> = { approve: "Litige résolu — facture approuvée", reject: "Litige résolu — facture rejetée", request_revision: "Révision demandée au fournisseur" };
      toast.success(msgs[resolution] || "Litige résolu");
      setOpen(false); setNotes(""); onSuccess();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <div className="p-4 border-2 border-orange-300 bg-orange-50 rounded-lg space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-orange-100 rounded-lg mt-0.5"><AlertCircle className="h-5 w-5 text-orange-600" /></div>
          <div className="flex-1">
            <p className="font-semibold text-orange-900">Cette facture est en litige</p>
            {disputeReason && <p className="text-sm text-orange-800 mt-1 bg-orange-100 rounded p-2">Motif : {disputeReason}</p>}
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => { setResolution("approve"); setOpen(true); }}>
            <CheckCircle2 className="mr-2 h-4 w-4" />Approuver malgré le litige
          </Button>
          <Button size="sm" variant="outline" className="border-purple-300 text-purple-700" onClick={() => { setResolution("request_revision"); setOpen(true); }}>
            Demander une révision
          </Button>
          <Button size="sm" variant="outline" className="border-red-300 text-red-700" onClick={() => { setResolution("reject"); setOpen(true); }}>
            Rejeter la facture
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{resolution === "approve" ? "Approuver malgré le litige" : resolution === "reject" ? "Rejeter la facture" : "Demander une révision"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Note de résolution *</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={resolution === "approve" ? "Ex: Litige vérifié, montant correct selon avenant..." : resolution === "reject" ? "Ex: Facture ne correspond pas au BC..." : "Ex: Corriger le montant ligne 3..."}
                rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button
              className={`${resolution === "approve" ? "bg-green-600 hover:bg-green-700" : resolution === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"} text-white disabled:opacity-40 disabled:cursor-not-allowed`}
              disabled={notes.length < 3 || mut.isPending}
              onClick={() => mut.mutate({ invoiceId, resolution, notes })}>
              {mut.isPending ? "Enregistrement..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Request Revision Panel ────────────────────────────────────────────────────
function RequestRevisionPanel({ invoiceId, onSuccess }: { invoiceId: number; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const mut = trpc.invoices.requestRevision.useMutation({
    onSuccess: () => { toast.success("Révision demandée — le fournisseur doit soumettre une facture corrigée"); setOpen(false); setReason(""); onSuccess(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Button variant="outline" size="sm" className="text-purple-700 border-purple-300 hover:bg-purple-50"
        onClick={() => setOpen(true)}>
        Demander une révision
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Demander une révision</DialogTitle>
            <DialogDescription>La facture sera retournée pour correction. Le fournisseur devra soumettre une facture révisée.</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label>Instructions de révision *</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Ex: Le montant HT doit être 850 000 XOF (pas 950 000). Corriger et soumettre une nouvelle facture." rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" disabled={reason.length < 10 || mut.isPending}
              onClick={() => mut.mutate({ invoiceId, reason })}>
              {mut.isPending ? "Envoi..." : "Envoyer la demande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Submit Revision Panel ─────────────────────────────────────────────────────
function SubmitRevisionPanel({ originalInvoiceId, revisionNote, onSuccess }: { originalInvoiceId: number; revisionNote?: string; onSuccess: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("0");
  const [note, setNote] = useState("");

  const mut = trpc.invoices.submitRevision.useMutation({
    onSuccess: (d) => { toast.success(`Révision #${d.revisionNumber} soumise avec succès`); setOpen(false); onSuccess(d.id); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <div className="p-4 border-2 border-purple-300 bg-purple-50 rounded-lg space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-100 rounded-lg"><AlertCircle className="h-5 w-5 text-purple-600" /></div>
          <div>
            <p className="font-semibold text-purple-900">Révision demandée</p>
            {revisionNote && <p className="text-sm text-purple-800 mt-1 bg-purple-100 rounded p-2">Instructions : {revisionNote}</p>}
          </div>
        </div>
        <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => setOpen(true)}>
          Soumettre la facture révisée
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Soumettre la facture révisée</DialogTitle>
            <DialogDescription>La facture originale sera annulée et remplacée par cette révision.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nouveau numéro de facture *</Label>
              <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ex: FAC-2026-0043-REV" />
            </div>
            <div className="space-y-2">
              <Label>Date de la facture révisée *</Label>
              <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Montant HT (XOF) *</Label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>TVA (XOF)</Label>
                <Input type="number" value={taxAmount} onChange={e => setTaxAmount(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note de révision *</Label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Décrivez les corrections apportées..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="bg-purple-600 hover:bg-purple-700"
              disabled={!invoiceNumber || !amount || note.length < 5 || mut.isPending}
              onClick={() => mut.mutate({ originalInvoiceId, invoiceNumber, invoiceDate, amount: parseFloat(amount), taxAmount: parseFloat(taxAmount) || 0, revisionNote: note })}>
              {mut.isPending ? "Soumission..." : "Soumettre la révision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Mark as Paid inline section ───────────────────────────────────────────────
function MarkAsPaidSection({ invoiceId, onSuccess }: { invoiceId: number; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [reference, setReference] = useState("");
  const [valueDate, setValueDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const mutation = trpc.invoices.markAsPaid.useMutation({
    onSuccess: () => {
      toast.success("Facture marquée comme payée");
      setOpen(false);
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const methodIcons: Record<string, (props: any) => React.ReactElement | null> = {
    bank_transfer: Building2,
    mobile_money: Smartphone,
    check: CreditCard,
    cash: Banknote,
  };

  const methodLabels: Record<string, string> = {
    bank_transfer: "Virement bancaire",
    mobile_money: "Mobile Money",
    check: "Chèque",
    cash: "Espèces",
  };

  return (
    <>
      <div className="p-4 border border-emerald-200 bg-emerald-50/50 rounded-lg flex items-center justify-between">
        <div>
          <p className="font-medium text-emerald-900">Facture approuvée — prête pour le paiement</p>
          <p className="text-sm text-emerald-700 mt-0.5">Enregistrez le paiement pour clôturer cette facture</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <CreditCard className="mr-2 h-4 w-4" />
          Enregistrer le paiement
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enregistrer le paiement</DialogTitle>
            <DialogDescription>Confirmer le règlement de cette facture</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Mode de paiement *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(methodLabels).map(([v, label]) => {
                    const Icon = methodIcons[v];
                    return (
                      <SelectItem key={v} value={v}>
                        <div className="flex items-center gap-2"><Icon className="h-4 w-4" />{label}</div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date de valeur *</Label>
                <Input type="date" value={valueDate} onChange={e => setValueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Référence</Label>
                <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="N° de virement…" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes optionnelles" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="btn-primary text-white"
              disabled={!paymentMethod || !valueDate || mutation.isPending}
              onClick={() => mutation.mutate({
                invoiceId,
                paymentMethod: paymentMethod as any,
                reference: reference || undefined,
                valueDate,
                notes: notes || undefined,
              })}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {mutation.isPending ? "Enregistrement…" : "Confirmer le paiement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Helper functions
const formatCurrency = (amount: string | number) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
};

const formatDate = (date: string | Date | null) => {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function InvoiceDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const exportPDFMutation = trpc.invoices.exportPDF.useMutation({
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
  const { user } = useAuth();

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [bypassDialogOpen, setBypassDialogOpen] = useState(false);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [approveComment, setApproveComment] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [bypassComment, setBypassComment] = useState("");

  const { data: history, isLoading: historyLoading } = trpc.settings.getEntityHistory.useQuery(
    { entityType: "invoice", entityId: parseInt(id!) },
    { enabled: !!id }
  );

  const { data: invoice, isLoading } = trpc.invoices.getById.useQuery(
    { id: parseInt(id!) },
    { enabled: !!id }
  );
  const { data: approvals = [] } = trpc.approvals.getByEntity.useQuery(
    { entityType: "invoice", entityId: parseInt(id!) },
    { enabled: !!id }
  );

  const approveMutation = trpc.invoices.approve.useMutation({
    onSuccess: () => {
      toast.success("Facture approuvée avec succès");
      setApproveDialogOpen(false);
      setApproveComment("");
      utils.invoices.getById.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de l'approbation");
    },
  });

  const rejectMutation = trpc.invoices.reject.useMutation({
    onSuccess: () => {
      toast.success("Facture rejetée avec succès");
      setRejectDialogOpen(false);
      setRejectReason("");
      utils.invoices.getById.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors du rejet");
    },
  });

  const bypassMutation = trpc.invoices.adminBypassApproval.useMutation({
    onSuccess: () => {
      toast.success("Facture approuvée en tant qu'administrateur");
      setBypassDialogOpen(false);
      setBypassComment("");
      utils.invoices.getById.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de l'approbation");
    },
  })

  const markAsPaidMutation = trpc.invoices.markAsPaid.useMutation({
    onSuccess: () => { toast.success("Facture marquée comme payée"); utils.invoices.getById.invalidate(); setMarkPaidDialogOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });;

  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  if (!invoice) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Facture non trouvée</p>
        <Button onClick={() => setLocation("/invoices")} className="mt-4">
          Retour aux factures
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: any; cls?: string }> = {
      pending:   { label: "En attente",       variant: "default" },
      approved:  { label: "Approuvée",        variant: "secondary" },
      rejected:  { label: "Rejetée",          variant: "destructive" },
      disputed:  { label: "En litige",        variant: "outline",     cls: "border-orange-300 text-orange-700 bg-orange-50" },
      revised:   { label: "À réviser",        variant: "outline",     cls: "border-purple-300 text-purple-700 bg-purple-50" },
      paid:      { label: "Payée",            variant: "secondary" },
      cancelled: { label: "Annulée",          variant: "outline" },
    };
    const config = statusMap[status] || { label: status, variant: "default" };
    return <Badge variant={config.variant} className={config.cls}>{config.label}</Badge>;
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'procurement_manager';
  const isApproverRole = user?.role === 'approver';
  const isTerminalStatus = ['paid','cancelled','rejected'].includes(invoice.status);
  const canEdit = ['pending', 'revised'].includes(invoice.status) && isAdmin;

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 bg-white border-b px-6 py-3 flex items-center gap-4">
        <button onClick={() => setLocation("/invoices")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /><span>Factures</span>
        </button>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
        <span className="text-sm font-medium truncate max-w-48">{invoice.invoiceNumber}</span>
        <div className="ml-auto flex items-center gap-2">
          {getStatusBadge(invoice.status)}
          {canEdit && (
            <button onClick={() => setLocation(`/invoices/new?editId=${invoice.id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition-colors font-medium">
              <Edit2 className="h-3.5 w-3.5" />Modifier
            </button>
          )}
          <button onClick={() => setLocation(`/invoices/new?copyFrom=${invoice.id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition-colors">
            <Copy className="h-3.5 w-3.5" />Copier
          </button>
          <button onClick={() => exportPDFMutation.mutate({ id: invoice.id })} disabled={exportPDFMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition-colors">
            <Download className="h-3.5 w-3.5" />{exportPDFMutation.isPending ? "..." : "PDF"}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

      {/* Main info card */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x border-b">
          <div className="px-5 py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Montant HT</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(invoice.amount)} XOF</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">TVA</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(invoice.taxAmount || 0)} XOF</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Date facture</p>
            <p className="text-base font-semibold mt-1">{formatDate(invoice.invoiceDate)}</p>
          </div>
          <div className="px-5 py-4">
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Date d'échéance</p>
              <p className="text-lg font-medium mt-1">
                {formatDate(invoice.dueDate)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vendor Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informations du fournisseur</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Nom du fournisseur</p>
              <p className="font-medium mt-1">
                {invoice.vendor?.legalName ?? `Fournisseur #${invoice.vendorId}`}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Numéro de facture</p>
              <p className="font-medium mt-1">{invoice.invoiceNumber}</p>
            </div>
            {invoice.purchaseOrder && (
              <div>
                <p className="text-sm text-muted-foreground">Bon de commande associé</p>
                <p className="font-medium mt-1">{invoice.purchaseOrder.poNumber}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Three-Way Match Panel */}
      {invoice.poId && (
        <ThreeWayMatchPanel
          invoiceId={parseInt(id!)}
          matchStatus={(invoice as any).matchStatus}
          canManage={user?.role === 'admin' || user?.role === 'procurement_manager'}
          onMatchComplete={() => utils.invoices.getById.invalidate()}
        />
      )}

      
      {/* Context action banner */}
      {invoice.status === 'pending' && (isAdmin || isApproverRole) && (
        <div className="bg-blue-600 text-white rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold">Approbation requise</p>
              <p className="text-sm text-blue-100">Cette facture attend votre validation</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setRejectDialogOpen(true)}
              className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors">
              Rejeter
            </button>
            <button onClick={() => setApproveDialogOpen(true)}
              className="px-4 py-2 rounded-xl bg-white text-blue-700 hover:bg-blue-50 text-sm font-semibold transition-colors">
              ✓ Approuver
            </button>
          </div>
        </div>
      )}
      {invoice.status === 'approved' && isAdmin && (
        <div className="bg-emerald-600 text-white rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Banknote className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold">Facture approuvée — en attente de paiement</p>
              <p className="text-sm text-emerald-100">Enregistrez le paiement une fois effectué</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setDisputeDialogOpen(true)}
              className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors">
              Contester
            </button>
            <button onClick={() => markAsPaidMutation.mutate({ invoiceId: invoice.id, valueDate: new Date().toISOString().split("T")[0], paymentMethod: "bank_transfer" })}
              disabled={markAsPaidMutation?.isPending}
              className="px-4 py-2 rounded-xl bg-white text-emerald-700 hover:bg-emerald-50 text-sm font-semibold transition-colors">
              <Banknote className="h-4 w-4 inline mr-1.5" />Marquer comme payée
            </button>
          </div>
        </div>
      )}
      {invoice.status === 'paid' && (
        <div className="bg-gray-100 border border-gray-200 rounded-2xl p-5 flex items-center gap-4">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
          <div>
            <p className="font-semibold text-gray-800">Facture payée</p>
            <p className="text-sm text-gray-500">Aucune action requise</p>
          </div>
        </div>
      )}
      {['disputed','revised'].includes(invoice.status) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-500 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800">
                {invoice.status === 'disputed' ? 'Facture contestée' : 'Révision demandée'}
              </p>
              <p className="text-sm text-amber-600">En attente de traitement</p>
            </div>
          </div>
        </div>
      )}
      {/* Admin secondary actions */}
      {invoice.status === 'pending' && isAdmin && (
        <div className="flex items-center justify-end gap-2 px-1">
          <button onClick={() => setRevisionDialogOpen(true)}
            className="text-xs px-3 py-1.5 rounded-lg border text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />Demander révision
          </button>
          <button onClick={() => setBypassDialogOpen(true)}
            className="text-xs px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />Contournement workflow
          </button>
        </div>
      )}

      </div>{/* end max-w-4xl */}

      {/* Approve Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Approuver la facture ?</AlertDialogTitle><AlertDialogDescription>Facture {invoice.invoiceNumber}</AlertDialogDescription></AlertDialogHeader>
          <Textarea value={approveComment} onChange={(e) => setApproveComment(e.target.value)} placeholder="Commentaire (optionnel)" rows={2} className="mt-2" />
          <div className="flex gap-3 justify-end mt-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => approveMutation.mutate({ invoiceId: invoice.id, comment: approveComment })} disabled={approveMutation?.isPending} className="bg-green-600 hover:bg-green-700">Approuver</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Rejeter la facture ?</AlertDialogTitle></AlertDialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motif du rejet *" rows={2} className="mt-2" />
          <div className="flex gap-3 justify-end mt-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => rejectMutation.mutate({ invoiceId: invoice.id, reason: rejectReason })} disabled={rejectMutation?.isPending || !rejectReason.trim()} className="bg-red-600 hover:bg-red-700">Rejeter</AlertDialogAction>
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
            <AlertDialogAction onClick={() => bypassMutation.mutate({ invoiceId: invoice.id, comment: bypassComment })} disabled={bypassMutation?.isPending} className="bg-amber-600 hover:bg-amber-700">Approuver directement</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approval chain */}
      </div>{/* end main info card */}

      {approvals && approvals.length > 0
  ? <ApprovalChainVisualization approvals={approvals} />
  : <div className="bg-white rounded-2xl border overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b bg-gray-50/60">
        <span className="font-semibold text-sm">Approbateurs</span>
      </div>
      <div className="px-5 py-6 text-center text-muted-foreground text-sm">
        Aucune étape d'approbation pour cette facture
      </div>
    </div>
}

      {/* Pending banner */}
      {invoice.status === "pending" && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="h-8 w-8 rounded-full bg-blue-100 border-2 border-blue-400 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900">En attente d'approbation</p>
            <p className="text-xs text-blue-700 mt-0.5">Les approbateurs ont été notifiés.</p>
          </div>
        </div>
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

      {["pending", "approved"].includes(invoice.status) && (
        <DisputePanel invoiceId={parseInt(id!)} onSuccess={() => utils.invoices.getById.invalidate()} externalOpen={disputeDialogOpen} onExternalClose={() => setDisputeDialogOpen(false)} />
      )}

      {/* Resolve Dispute panel — admin/manager on disputed invoices */}
      {invoice.status === 'disputed' && (user?.role === 'admin' || user?.role === 'procurement_manager') && (
        <ResolveDisputePanel
          invoiceId={parseInt(id!)}
          disputeReason={(invoice as any).disputeReason}
          onSuccess={() => utils.invoices.getById.invalidate()}
        />
      )}

      {/* Request Revision panel — admin/manager on pending invoices */}
      {invoice.status === 'pending' && (user?.role === 'admin' || user?.role === 'procurement_manager') && (
        <RequestRevisionPanel invoiceId={parseInt(id!)} onSuccess={() => utils.invoices.getById.invalidate()} />
      )}

      {/* Submit Revision panel — shown on revised/rejected invoices */}
      {["revised", "rejected"].includes(invoice.status) && (user?.role === 'admin' || user?.role === 'procurement_manager') && (
        <SubmitRevisionPanel
          originalInvoiceId={parseInt(id!)}
          revisionNote={(invoice as any).revisionNote}
          onSuccess={(newId) => { utils.invoices.list.invalidate(); setLocation(`/invoices/${newId}`); }}
        />
      )}

      {/* Revision history — show if this is a revised invoice */}
      {(invoice as any).originalInvoiceId && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-purple-900">Révision {(invoice as any).revisionNumber}</p>
            <p className="text-xs text-purple-700 mt-0.5">
              Cette facture est une révision de la facture #{(invoice as any).originalInvoiceId}.
              {(invoice as any).revisionNote && ` Motif : ${(invoice as any).revisionNote}`}
            </p>
            <Button variant="link" size="sm" className="text-purple-700 p-0 h-auto mt-1"
              onClick={() => setLocation(`/invoices/${(invoice as any).originalInvoiceId}`)}>
              Voir la facture originale →
            </Button>
          </div>
        </div>
      )}

      {/* Mark as Paid — shown for approved invoices to admin/procurement_manager */}
      {invoice.status === 'approved' && (user?.role === 'admin' || user?.role === 'procurement_manager') && (
        <MarkAsPaidSection invoiceId={parseInt(id!)} onSuccess={() => utils.invoices.getById.invalidate()} />
      )}
    </div>
  );
}
