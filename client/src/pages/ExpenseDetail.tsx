import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, XCircle, CreditCard, Loader2 } from "lucide-react";

function fmt(n: number) { return new Intl.NumberFormat("fr-FR").format(Number(n) || 0); }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString("fr-FR") : "—"; }

const STATUS = {
  draft:      { label: "Brouillon",  color: "bg-gray-100 text-gray-700" },
  submitted:  { label: "Soumis",     color: "bg-blue-100 text-blue-700" },
  approved:   { label: "Approuvé",   color: "bg-emerald-100 text-emerald-700" },
  rejected:   { label: "Refusé",     color: "bg-red-100 text-red-700" },
  reimbursed: { label: "Remboursé",  color: "bg-purple-100 text-purple-700" },
};

export default function ExpenseDetail() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const id = parseInt(params.id as string);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "procurement_manager" || user?.role === "approver";
  const utils = trpc.useUtils();

  const { data: report, isLoading } = trpc.expenses.getById.useQuery({ id });
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [reimburseMethod, setReimburseMethod] = useState("bank_transfer");
  const [reimburseRef, setReimburseRef] = useState("");
  const [showReimburse, setShowReimburse] = useState(false);

  const submitMut = trpc.expenses.submit.useMutation({
    onSuccess: () => { toast.success("Soumis pour approbation"); utils.expenses.getById.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const approveMut = trpc.expenses.approve.useMutation({
    onSuccess: () => { toast.success("Approuvé !"); utils.expenses.getById.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const rejectMut = trpc.expenses.reject.useMutation({
    onSuccess: () => { toast.success("Refusé"); setShowReject(false); utils.expenses.getById.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const reimburseMut = trpc.expenses.markReimbursed.useMutation({
    onSuccess: () => { toast.success("Marqué comme remboursé !"); setShowReimburse(false); utils.expenses.getById.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!report) return <div className="text-center py-20 text-muted-foreground">Note de frais introuvable</div>;

  const st = STATUS[(report as any).status as keyof typeof STATUS] || STATUS.draft;
  const lines = (report as any).lines || [];

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/expenses")} className="p-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground">{(report as any).reportNumber}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
            </div>
            <h1 className="text-xl font-bold mt-1">{(report as any).title}</h1>
            <p className="text-sm text-muted-foreground">Soumis par {(report as any).submitterName}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-blue-700">{fmt((report as any).totalAmount)} XOF</p>
          {(report as any).periodStart && (
            <p className="text-xs text-muted-foreground">{fmtDate((report as any).periodStart)} → {fmtDate((report as any).periodEnd)}</p>
          )}
        </div>
      </div>

      {/* Rejection reason */}
      {(report as any).status === "rejected" && (report as any).rejectionReason && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm font-semibold text-red-800 mb-1">Motif de refus</p>
          <p className="text-sm text-red-700">{(report as any).rejectionReason}</p>
        </div>
      )}

      {/* Reimbursement info */}
      {(report as any).status === "reimbursed" && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <p className="text-sm font-semibold text-purple-800 mb-1">✅ Remboursement effectué</p>
          <p className="text-sm text-purple-700">
            Méthode: {(report as any).reimbursementMethod?.replace("_", " ")}
            {(report as any).reimbursementRef && ` · Réf: ${(report as any).reimbursementRef}`}
            {(report as any).reimbursedAt && ` · Le ${fmtDate((report as any).reimbursedAt)}`}
          </p>
        </div>
      )}

      {/* Expense lines */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Détail des dépenses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Catégorie</th>
                <th className="text-left p-3">Description</th>
                <th className="text-right p-3">Montant</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line: any, i: number) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 text-muted-foreground">{fmtDate(line.expenseDate)}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-xs">{line.category}</Badge>
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{line.description || "—"}</p>
                    {line.vendorName && <p className="text-xs text-muted-foreground">{line.vendorName}</p>}
                    {line.isBillable && <Badge variant="secondary" className="text-xs mt-0.5">Refacturable</Badge>}
                  </td>
                  <td className="p-3 text-right font-semibold">{fmt(line.amount)} XOF</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-muted/20">
              <tr>
                <td colSpan={3} className="p-3 font-semibold text-right">Total</td>
                <td className="p-3 text-right font-bold text-blue-700 text-base">{fmt((report as any).totalAmount)} XOF</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-end">
        {/* Submit own draft */}
        {(report as any).status === "draft" && (report as any).submitterId === user?.id && (
          <button onClick={() => submitMut.mutate({ id })} disabled={submitMut.isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white btn-primary">
            {submitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Soumettre pour approbation
          </button>
        )}

        {/* Approve/Reject */}
        {(report as any).status === "submitted" && isAdmin && !showReject && (
          <>
            <button onClick={() => setShowReject(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-red-300 text-red-700 hover:bg-red-50">
              <XCircle className="h-4 w-4" />Refuser
            </button>
            <button onClick={() => approveMut.mutate({ id })} disabled={approveMut.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700">
              {approveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Approuver
            </button>
          </>
        )}

        {/* Reject form */}
        {showReject && (
          <div className="w-full p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
            <p className="text-sm font-medium text-red-800">Motif du refus *</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm" rows={2} placeholder="Expliquez pourquoi cette note est refusée..." />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowReject(false)} className="px-3 py-1.5 border rounded text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={() => rejectMut.mutate({ id, reason: rejectReason })}
                disabled={!rejectReason.trim() || rejectMut.isPending}
                className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium disabled:opacity-50">
                Confirmer le refus
              </button>
            </div>
          </div>
        )}

        {/* Reimburse */}
        {(report as any).status === "approved" && isAdmin && !showReimburse && (
          <button onClick={() => setShowReimburse(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white btn-primary">
            <CreditCard className="h-4 w-4" />Marquer comme remboursé
          </button>
        )}

        {showReimburse && (
          <div className="w-full p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
            <p className="text-sm font-medium text-blue-800">Informations de remboursement</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Méthode</label>
                <select value={reimburseMethod} onChange={e => setReimburseMethod(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                  <option value="bank_transfer">Virement bancaire</option>
                  <option value="mobile_money">Mobile Money (MTN/Moov)</option>
                  <option value="cash">Espèces</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Référence (optionnel)</label>
                <input value={reimburseRef} onChange={e => setReimburseRef(e.target.value)}
                  placeholder="N° virement, transaction..." className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowReimburse(false)} className="px-3 py-1.5 border rounded text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={() => reimburseMut.mutate({ id, method: reimburseMethod as any, reference: reimburseRef || undefined })}
                disabled={reimburseMut.isPending}
                className="px-3 py-1.5 btn-primary text-white rounded text-sm font-medium disabled:opacity-50">
                {reimburseMut.isPending ? "..." : "Confirmer le remboursement"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
