import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { toast } from "sonner";
import { EntityHistory } from "@/components/EntityHistory";
import { useAuth } from "@/_core/hooks/useAuth";
import { Shield, ThumbsUp, ThumbsDown, ArrowLeft, CreditCard, Smartphone, Building2, Banknote, CheckCircle2, AlertCircle } from "lucide-react";
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
function DisputePanel({ invoiceId, onSuccess }: { invoiceId: number; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
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
              className={resolution === "approve" ? "bg-green-600 hover:bg-green-700" : resolution === "reject" ? "bg-red-600 hover:bg-red-700" : ""}
              disabled={notes.length < 5 || mut.isPending}
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
            <Button
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
  const { user } = useAuth();

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [bypassDialogOpen, setBypassDialogOpen] = useState(false);
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
  });

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

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/invoices")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{invoice.invoiceNumber}</h1>
            <p className="text-muted-foreground mt-1">
              Facture · {invoice.vendor?.legalName ?? `Fournisseur #${invoice.vendorId}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          {getStatusBadge(invoice.status)}
        </div>
      </div>

      {/* Key Details */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Montant</p>
              <p className="text-lg font-bold mt-1">{formatCurrency(invoice.amount)} XOF</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Montant TVA</p>
              <p className="text-lg font-bold mt-1">{formatCurrency(invoice.taxAmount || 0)} XOF</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Date de facture</p>
              <p className="text-lg font-medium mt-1">
                {formatDate(invoice.invoiceDate)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
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

      {/* Approval Actions */}
      {invoice.status === 'pending' && user?.role === 'admin' && (
        <>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Shield className="h-5 w-5 text-amber-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-900">Privilege administrateur</p>
                  <p className="text-sm text-amber-800 mt-1">
                    Vous pouvez approuver ou rejeter cette facture directement
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
                <AlertDialogTitle>Approuver la facture?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action approuvera la facture {invoice.invoiceNumber}. Cette action est irreversible.
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
                  onClick={() => approveMutation.mutate({ invoiceId: parseInt(id!), comment: approveComment })}
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
                <AlertDialogTitle>Rejeter la facture?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action rejettera la facture {invoice.invoiceNumber}. Veuillez fournir une raison.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Raison du rejet *</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Expliquer pourquoi cette facture est rejetee..."
                    className="w-full mt-2 p-2 border rounded text-sm"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => rejectMutation.mutate({ invoiceId: parseInt(id!), reason: rejectReason })}
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
                  Cette action approuvera la facture immediatement en contournant toutes les etapes d'approbation restantes. Cette action sera enregistree dans l'historique.
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
                  onClick={() => bypassMutation.mutate({ invoiceId: parseInt(id!), comment: bypassComment })}
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
      <EntityHistory entries={history || []} isLoading={historyLoading} />

      {["pending", "approved"].includes(invoice.status) && (
        <DisputePanel invoiceId={parseInt(id!)} onSuccess={() => utils.invoices.getById.invalidate()} />
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
