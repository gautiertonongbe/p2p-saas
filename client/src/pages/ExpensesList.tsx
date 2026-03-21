import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, FileText, Clock, CheckCircle, XCircle, DollarSign, TrendingUp, Loader2, Filter , Receipt} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

function fmt(n: number) { return new Intl.NumberFormat("fr-FR").format(Number(n) || 0); }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString("fr-FR") : "—"; }

const STATUS = {
  draft:       { label: "Brouillon",  color: "bg-gray-100 text-gray-700" },
  submitted:   { label: "Soumis",     color: "bg-blue-100 text-blue-700" },
  approved:    { label: "Approuvé",   color: "bg-emerald-100 text-emerald-700" },
  rejected:    { label: "Refusé",     color: "bg-red-100 text-red-700" },
  reimbursed:  { label: "Remboursé",  color: "bg-purple-100 text-purple-700" },
};

export default function ExpensesList() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "procurement_manager" || user?.role === "approver";
  const [filter, setFilter] = useState<"mine" | "all">("mine");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: reports = [], isLoading, refetch } = trpc.expenses.list.useQuery({
    myOnly: filter === "mine",
    status: statusFilter || undefined,
  });

  const { data: stats } = trpc.expenses.stats.useQuery();

  const deleteMut = trpc.expenses.delete.useMutation({
    onSuccess: () => { toast.success("Note de frais supprimée"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const approveMut = trpc.expenses.approve.useMutation({
    onSuccess: () => { toast.success("Note de frais approuvée"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const pendingApproval = (reports as any[]).filter(r => r.status === "submitted");

  return (
    <div className="space-y-5 pb-8">
      <PageHeader icon={<Receipt className="h-5 w-5" />} title={t("expenses.title")} description={t("expenses.description")} />
<div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notes de frais</h1>
          <p className="text-sm text-muted-foreground">Gérez vos remboursements de dépenses</p>
        </div>
        <button onClick={() => setLocation("/expenses/new")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-semibold btn-primary">
          <Plus className="h-4 w-4" />Nouvelle note de frais
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "En attente", value: fmt(Number((stats as any)?.pendingAmount || 0)), sub: `${(stats as any)?.submitted || 0} rapport(s)`, icon: Clock, color: "text-amber-600" },
          { label: "Approuvé", value: `${(stats as any)?.approved || 0}`, sub: "à rembourser", icon: CheckCircle, color: "text-emerald-600" },
          { label: "Remboursé", value: fmt(Number((stats as any)?.totalReimbursed || 0)), sub: "XOF total", icon: DollarSign, color: "text-blue-600" },
          { label: "Total rapports", value: `${(stats as any)?.total || 0}`, sub: "tous statuts", icon: FileText, color: "text-gray-600" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending approvals banner for managers */}
      {isAdmin && pendingApproval.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  {pendingApproval.length} note{pendingApproval.length > 1 ? "s" : ""} de frais en attente d'approbation
                </span>
              </div>
              <button onClick={() => setStatusFilter("submitted")} className="text-xs text-amber-700 hover:underline">
                Voir →
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {isAdmin && (
          <div className="flex rounded-lg border overflow-hidden">
            {[{ id: "mine", label: "Mes notes" }, { id: "all", label: "Toutes" }].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id as any)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${filter === f.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
                {f.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex rounded-lg border overflow-hidden">
          {[
            { id: "", label: "Tous" },
            { id: "draft", label: "Brouillons" },
            { id: "submitted", label: "Soumis" },
            { id: "approved", label: "Approuvés" },
            { id: "reimbursed", label: "Remboursés" },
          ].map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${statusFilter === f.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (reports as any[]).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Aucune note de frais</p>
            <button onClick={() => setLocation("/expenses/new")}
              className="mt-4 px-4 py-2 rounded-lg text-sm btn-primary text-white">
              Créer ma première note de frais
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
{(reports as any[]).map((report: any) => {
            const st = STATUS[report.status as keyof typeof STATUS] || STATUS.draft;
            return (
              <Card key={report.id} className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setLocation(`/expenses/${report.id}`)}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{report.reportNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                        {report.isBillable && <Badge variant="outline" className="text-xs">Refacturable</Badge>}
                      </div>
                      <p className="font-semibold mt-1 truncate">{report.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{report.submitterName}</span>
                        {report.periodStart && <span>📅 {fmtDate(report.periodStart)} → {fmtDate(report.periodEnd)}</span>}
                        <span>Créé le {fmtDate(report.createdAt)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-blue-700">{fmt(report.totalAmount)} XOF</p>
                      {report.status === "submitted" && isAdmin && (
                        <div className="flex gap-1 mt-2" onClick={e => e.stopPropagation()}>
                          <button onClick={() => approveMut.mutate({ id: report.id })}
                            disabled={approveMut.isPending}
                            className="px-2 py-1 rounded text-xs bg-emerald-600 text-white hover:bg-emerald-700 font-medium">
                            ✓ Approuver
                          </button>
                          <button onClick={() => setLocation(`/expenses/${report.id}`)}
                            className="px-2 py-1 rounded text-xs border text-gray-600 hover:bg-gray-50">
                            Voir
                          </button>
                        </div>
                      )}
                      {report.status === "draft" && report.submitterId === user?.id && (
                        <button onClick={e => { e.stopPropagation(); deleteMut.mutate({ id: report.id }); }}
                          className="mt-1 text-xs text-red-400 hover:text-red-600">Supprimer</button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
