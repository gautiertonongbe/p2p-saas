import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronRight, CreditCard, Banknote, Smartphone,
  CheckCircle2, Clock, XCircle, Calendar, Hash, Building2,
  FileText, Download, AlertTriangle
} from "lucide-react";
import { EntityHistory } from "@/components/EntityHistory";

function fmt(n: number | string) {
  return new Intl.NumberFormat("fr-FR").format(Number(n));
}
function fmtDate(d: any) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

const METHOD_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  bank_transfer: { label: "Virement bancaire", icon: Building2,  color: "text-blue-700",   bg: "bg-blue-50"   },
  mobile_money:  { label: "Mobile Money",      icon: Smartphone, color: "text-emerald-700", bg: "bg-emerald-50"},
  check:         { label: "Chèque",            icon: FileText,   color: "text-purple-700",  bg: "bg-purple-50" },
  cash:          { label: "Espèces",           icon: Banknote,   color: "text-amber-700",   bg: "bg-amber-50"  },
};
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  scheduled:  { label: "Programmé",   color: "text-blue-700",   bg: "bg-blue-100",   icon: Clock        },
  processing: { label: "En cours",    color: "text-amber-700",  bg: "bg-amber-100",  icon: Clock        },
  completed:  { label: "Complété",    color: "text-emerald-700",bg: "bg-emerald-100",icon: CheckCircle2 },
  failed:     { label: "Échoué",      color: "text-red-700",    bg: "bg-red-100",    icon: XCircle      },
  cancelled:  { label: "Annulé",      color: "text-gray-600",   bg: "bg-gray-100",   icon: XCircle      },
};

export default function PaymentDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Get payment from the list (no getById endpoint — filter from list)
  const { data: payments = [], isLoading } = trpc.invoices.listPayments.useQuery(undefined);
  const { data: history, isLoading: histLoading } = trpc.settings.getEntityHistory.useQuery(
    { entityType: "payment" as any, entityId: parseInt(id!) },
    { enabled: !!id }
  );

  const payment = (payments as any[]).find((p: any) => p.id === parseInt(id!));

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!payment) return (
    <div className="min-h-screen bg-gray-50/40 flex items-center justify-center">
      <div className="text-center">
        <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-3" />
        <p className="font-semibold text-gray-700">Paiement introuvable</p>
        <button onClick={() => setLocation("/payments")}
          className="mt-3 text-sm text-blue-600 hover:underline">← Retour aux paiements</button>
      </div>
    </div>
  );

  const methodCfg = METHOD_CONFIG[payment.paymentMethod] || METHOD_CONFIG.bank_transfer;
  const statusCfg = STATUS_CONFIG[payment.status] || STATUS_CONFIG.completed;
  const StatusIcon = statusCfg.icon;
  const MethodIcon = methodCfg.icon;

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* Sticky topbar */}
      <div className="sticky top-0 z-30 bg-white border-b px-6 py-3 flex items-center gap-4">
        <button onClick={() => setLocation("/payments")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />Paiements
        </button>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
        <span className="text-sm font-medium">PAY-{String(payment.id).padStart(6, "0")}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.color}`}>
            <StatusIcon className="h-3.5 w-3.5" />{statusCfg.label}
          </span>
          {payment.invoiceId && (
            <button onClick={() => setLocation(`/invoices/${payment.invoiceId}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition-colors">
              <FileText className="h-3.5 w-3.5" />Voir la facture
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Payment receipt card */}
        <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
          {/* Amount hero */}
          <div className={`px-8 py-8 ${payment.status === 'completed' ? 'bg-emerald-600' : 'bg-gray-800'} text-white text-center`}>
            <p className="text-sm font-medium opacity-80 mb-1">Montant payé</p>
            <p className="text-4xl font-bold">{fmt(payment.amount)}</p>
            <p className="text-lg opacity-80 mt-0.5">{payment.currency || "XOF"}</p>
            {payment.status === 'completed' && (
              <div className="flex items-center justify-center gap-2 mt-3 bg-white/20 rounded-full px-4 py-1.5 w-fit mx-auto">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-semibold">Paiement complété</span>
              </div>
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 divide-x border-b">
            <div className="px-6 py-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Mode de paiement</p>
              <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ${methodCfg.bg}`}>
                <MethodIcon className={`h-4 w-4 ${methodCfg.color}`} />
                <span className={`text-sm font-semibold ${methodCfg.color}`}>{methodCfg.label}</span>
              </div>
            </div>
            <div className="px-6 py-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Date de valeur</p>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{fmtDate(payment.valueDate)}</span>
              </div>
            </div>
          </div>

          {/* References */}
          <div className="px-6 py-4 border-b space-y-3">
            {payment.reference && (
              <div className="flex items-center gap-3">
                <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Référence paiement</p>
                  <p className="text-sm font-mono font-semibold bg-gray-50 px-2 py-0.5 rounded mt-0.5 inline-block">{payment.reference}</p>
                </div>
              </div>
            )}
            {payment.vendor && (
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Bénéficiaire</p>
                  <p className="text-sm font-semibold mt-0.5">{payment.vendor.legalName}</p>
                </div>
              </div>
            )}
            {payment.invoice && (
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Facture associée</p>
                  <button onClick={() => setLocation(`/invoices/${payment.invoiceId}`)}
                    className="text-sm font-semibold text-blue-600 hover:underline mt-0.5 block">
                    {payment.invoice.invoiceNumber} — {fmt(payment.invoice.amount)} XOF
                  </button>
                </div>
              </div>
            )}
            {payment.notes && (
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm text-gray-700 mt-0.5">{payment.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="px-6 py-3 bg-gray-50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Enregistré le {fmtDate(payment.createdAt)}</span>
            <span>PAY-{String(payment.id).padStart(6, "0")}</span>
          </div>
        </div>

        {/* History */}
        {history && history.length > 0 && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-3 border-b">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Historique</span>
            </div>
            <div className="px-4 py-3">
              <EntityHistory entries={history} isLoading={histLoading} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
