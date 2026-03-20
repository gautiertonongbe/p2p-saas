import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock, CheckCircle, XCircle, FileText, ShoppingCart,
  AlertCircle, TrendingUp, ChevronRight, Package,
  FileCheck, Bell, Zap, Calendar, DollarSign, ArrowRight
} from "lucide-react";

function timeAgo(date: string | Date) {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `il y a ${mins}min`;
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${days}j`;
}

function fmt(n: number) {
  if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n/1000).toFixed(0)}K`;
  return n.toString();
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", submitted: "Soumis", pending_approval: "En attente",
  approved: "Approuvé", rejected: "Rejeté", pending: "En attente", paid: "Payé",
};

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.role === "admin" || user?.role === "procurement_manager";
  const isApprover = user?.role === "approver" || isAdmin;

  const { data: myRequests = [] } = trpc.purchaseRequests.getMyRequests.useQuery();
  const { data: pendingApprovals = [] } = trpc.approvals.myPendingApprovals.useQuery();
  const { data: budgetAlerts = [] } = trpc.budgets.getOverspendingAlerts.useQuery();
  const { data: expiringContracts = [] } = trpc.vendors.getExpiringContracts.useQuery({ daysAhead: 30 });
  const { data: inventoryAlerts = [] } = trpc.inventory.getLowStockAlerts.useQuery();
  const { data: allInvoices = [] } = trpc.invoices.list.useQuery(isAdmin ? {} : undefined);
  const { data: allOrders = [] } = trpc.purchaseOrders.list.useQuery();

  const pendingInvoices = (allInvoices as any[]).filter((i: any) => i.status === "pending");
  const disputedInvoices = (allInvoices as any[]).filter((i: any) => i.status === "disputed");
  const activeOrders = (allOrders as any[]).filter((o: any) => ["issued","confirmed","partially_received"].includes(o.status));

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  const totalActions = (pendingApprovals as any[]).length + pendingInvoices.length + disputedInvoices.length + (budgetAlerts as any[]).length;

  return (
    <div className="space-y-6 pb-8">
      {/* Personal greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}, {user?.name?.split(" ")[0]} 👋</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            {totalActions > 0 && <span className="ml-2 text-amber-600 font-medium">· {totalActions} action{totalActions > 1 ? "s" : ""} requise{totalActions > 1 ? "s" : ""}</span>}
          </p>
        </div>
        <Link href="/purchase-requests/new">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium btn-primary">
            <FileText className="h-4 w-4" />Nouvelle demande
          </button>
        </Link>
      </div>

      {/* Action required — top priority */}
      {(pendingApprovals as any[]).length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {(pendingApprovals as any[]).length} approbation{(pendingApprovals as any[]).length > 1 ? "s" : ""} en attente de votre décision
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(pendingApprovals as any[]).slice(0, 3).map((a: any) => (
              <Link key={a.id} href={`/approvals/${a.id}`}>
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200 hover:shadow-sm transition-shadow cursor-pointer">
                  <div>
                    <p className="text-sm font-medium">{a.request?.title || `Demande #${a.requestId}`}</p>
                    <p className="text-xs text-muted-foreground">Étape {a.stepOrder} · {a.request?.requestNumber}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-amber-700">
                      {a.request?.amountEstimate ? `${fmt(Number(a.request.amountEstimate))} XOF` : ""}
                    </span>
                    <ChevronRight className="h-4 w-4 text-amber-400" />
                  </div>
                </div>
              </Link>
            ))}
            {(pendingApprovals as any[]).length > 3 && (
              <Link href="/approvals">
                <button className="w-full text-xs text-amber-700 hover:underline">
                  Voir les {(pendingApprovals as any[]).length - 3} autres →
                </button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* My requests + Quick stats */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* My recent requests */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />Mes demandes récentes
              </CardTitle>
              <Link href="/purchase-requests">
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  Voir tout <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </CardHeader>
            <CardContent>
              {(myRequests as any[]).length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune demande</p>
                  <Link href="/purchase-requests/new">
                    <button className="mt-3 text-sm btn-primary px-4 py-1.5 rounded-lg">Créer une demande</button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(myRequests as any[]).slice(0, 5).map((req: any) => (
                    <Link key={req.id} href={`/purchase-requests/${req.id}`}>
                      <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{req.title}</p>
                          <p className="text-xs text-muted-foreground">{req.requestNumber} · {timeAgo(req.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-medium">{fmt(Number(req.amountEstimate))} XOF</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[req.status] || ""}`}>
                            {STATUS_LABELS[req.status] || req.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick actions + stats */}
        <div className="space-y-4">
          {/* Personal stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />Mon activité
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Mes demandes", value: (myRequests as any[]).length, sub: `${(myRequests as any[]).filter((r: any) => r.status === "pending_approval").length} en attente`, icon: FileText, href: "/purchase-requests" },
                { label: "À approuver", value: (pendingApprovals as any[]).length, sub: "nécessitent votre action", icon: Clock, href: "/approvals", highlight: (pendingApprovals as any[]).length > 0 },
                ...(isAdmin ? [
                  { label: "Factures en attente", value: pendingInvoices.length, sub: `${disputedInvoices.length} en litige`, icon: DollarSign, href: "/invoices", highlight: disputedInvoices.length > 0 },
                  { label: "Commandes actives", value: activeOrders.length, sub: "bons de commande", icon: ShoppingCart, href: "/purchase-orders" },
                ] : []),
              ].map(({ label, value, sub, icon: Icon, href, highlight }) => (
                <Link key={label} href={href}>
                  <div className={`flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${highlight ? "bg-amber-50 border border-amber-200" : ""}`}>
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${highlight ? "bg-amber-100" : "bg-muted"}`}>
                      <Icon className={`h-4 w-4 ${highlight ? "text-amber-600" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className={`text-sm font-semibold ${highlight ? "text-amber-700" : ""}`}>{value} <span className="text-xs font-normal text-muted-foreground">{sub}</span></p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {[
                { label: "Demande d'achat", href: "/purchase-requests/new", icon: FileText },
                { label: "Approbations", href: "/approvals", icon: CheckCircle },
                { label: "Fournisseurs", href: "/vendors", icon: Package },
                { label: "Factures", href: "/invoices", icon: DollarSign },
              ].map(({ label, href, icon: Icon }) => (
                <Link key={label} href={href}>
                  <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl border hover:bg-muted/50 cursor-pointer transition-colors text-center">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs font-medium leading-tight">{label}</span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Alerts row */}
      {(isAdmin && ((budgetAlerts as any[]).length > 0 || (expiringContracts as any[]).length > 0 || (inventoryAlerts as any[]).length > 0 || disputedInvoices.length > 0) && ((budgetAlerts as any[]).length + (expiringContracts as any[]).length + (inventoryAlerts as any[]).length + disputedInvoices.length > 0)) && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Bell className="h-3.5 w-3.5" />Alertes organisation
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(budgetAlerts as any[]).length > 0 && (
              <Link href="/budgets">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-red-200 bg-red-50 hover:shadow-sm cursor-pointer">
                  <TrendingUp className="h-5 w-5 text-red-500 shrink-0" />
                  <div><p className="text-sm font-semibold text-red-800">{(budgetAlerts as any[]).length} dépassement{(budgetAlerts as any[]).length > 1 ? "s" : ""}</p><p className="text-xs text-red-600">budgétaire{(budgetAlerts as any[]).length > 1 ? "s" : ""}</p></div>
                </div>
              </Link>
            )}
            {disputedInvoices.length > 0 && (
              <Link href="/invoices">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-red-200 bg-red-50 hover:shadow-sm cursor-pointer">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <div><p className="text-sm font-semibold text-red-800">{disputedInvoices.length} facture{disputedInvoices.length > 1 ? "s" : ""}</p><p className="text-xs text-red-600">en litige</p></div>
                </div>
              </Link>
            )}
            {(expiringContracts as any[]).length > 0 && (
              <Link href="/vendors">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50 hover:shadow-sm cursor-pointer">
                  <Calendar className="h-5 w-5 text-amber-500 shrink-0" />
                  <div><p className="text-sm font-semibold text-amber-800">{(expiringContracts as any[]).length} contrat{(expiringContracts as any[]).length > 1 ? "s" : ""}</p><p className="text-xs text-amber-600">expirent dans 30j</p></div>
                </div>
              </Link>
            )}
            {(inventoryAlerts as any[]).length > 0 && (
              <Link href="/inventory">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50 hover:shadow-sm cursor-pointer">
                  <Package className="h-5 w-5 text-blue-500 shrink-0" />
                  <div><p className="text-sm font-semibold text-blue-800">{(inventoryAlerts as any[]).length} article{(inventoryAlerts as any[]).length > 1 ? "s" : ""}</p><p className="text-xs text-blue-600">stock bas</p></div>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
