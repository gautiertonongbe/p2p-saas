import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Clock, CheckCircle, FileText, ShoppingCart, AlertCircle,
  TrendingUp, ChevronRight, Package, FileCheck, Bell,
  Zap, Calendar, DollarSign, ArrowRight, Plus, Receipt,
  Users, BarChart2, Shield, HelpCircle} from "lucide-react";
import { useTheme, COLOR_PRESETS } from "@/contexts/ThemeContext";

function timeAgo(date: string | Date) {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${days}j`;
}

function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  submitted: "bg-blue-100 text-blue-700",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", pending_approval: "En attente",
  approved: "Approuvé", rejected: "Rejeté",
  pending: "En attente", paid: "Payé", submitted: "Soumis",
};

// Metric card with colored icon
function MetricCard({ label, value, sub, icon: Icon, color, href }: {
  label: string; value: number | string; sub: string;
  icon: any; color: string; href: string;
}) {
  const COLORS: Record<string, { bg: string; icon: string; text: string }> = {
    blue:    { bg: "bg-blue-50",   icon: "text-blue-600",   text: "text-blue-700" },
    purple:  { bg: "bg-purple-50", icon: "text-purple-600", text: "text-purple-700" },
    cyan:    { bg: "bg-cyan-50",   icon: "text-cyan-600",   text: "text-cyan-700" },
    amber:   { bg: "bg-amber-50",  icon: "text-amber-600",  text: "text-amber-700" },
    red:     { bg: "bg-red-50",    icon: "text-red-600",    text: "text-red-700" },
    emerald: { bg: "bg-emerald-50",icon: "text-emerald-600",text: "text-emerald-700" },
    pink:    { bg: "bg-pink-50",   icon: "text-pink-600",   text: "text-pink-700" },
  };
  const c = COLORS[color] || COLORS.blue;
  return (
    <Link href={href}>
      <div className="bg-card border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer group h-full">
        <div className="flex items-center justify-between mb-2">
          <div className={`h-9 w-9 rounded-lg ${c.bg} flex items-center justify-center`}>
            <Icon className={`h-4.5 w-4.5 ${c.icon}`} style={{width:"18px",height:"18px"}} />
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <p className={`text-3xl font-bold leading-none mt-1 ${c.text}`}>{value}</p>
        <p className="text-sm font-semibold text-foreground mt-1.5">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{sub}</p>
      </div>
    </Link>
  );
}

// Quick action tile
function ActionTile({ label, href, icon: Icon, color }: {
  label: string; href: string; icon: any; color: string;
}) {
  const COLORS: Record<string, { bg: string; icon: string; border: string }> = {
    blue:    { bg: "hover:bg-blue-50",   icon: "text-blue-600",   border: "hover:border-blue-200" },
    purple:  { bg: "hover:bg-purple-50", icon: "text-purple-600", border: "hover:border-purple-200" },
    cyan:    { bg: "hover:bg-cyan-50",   icon: "text-cyan-600",   border: "hover:border-cyan-200" },
    amber:   { bg: "hover:bg-amber-50",  icon: "text-amber-600",  border: "hover:border-amber-200" },
    emerald: { bg: "hover:bg-emerald-50",icon: "text-emerald-600",border: "hover:border-emerald-200" },
    pink:    { bg: "hover:bg-pink-50",   icon: "text-pink-600",   border: "hover:border-pink-200" },
  };
  const c = COLORS[color] || COLORS.blue;
  return (
    <Link href={href}>
      <div className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border ${c.bg} ${c.border} cursor-pointer transition-all text-center group min-w-0 overflow-hidden`}>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center bg-white/70 group-hover:scale-105 transition-transform`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
        <span className="text-xs font-semibold leading-tight w-full truncate px-1">{label}</span>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { colorPreset } = useTheme();
  const preset = COLOR_PRESETS.find(p => p.id === colorPreset) || COLOR_PRESETS[0];
  const isAdmin = user?.role === "admin" || user?.role === "procurement_manager";

  const { data: myRequests = [] } = trpc.purchaseRequests.getMyRequests.useQuery();
  const { data: pendingApprovals = [] } = trpc.approvals.myPendingApprovals.useQuery();
  const { data: budgetAlerts = [] } = trpc.budgets.getOverspendingAlerts.useQuery();
  const { data: expiringContracts = [] } = trpc.vendors.getExpiringContracts.useQuery({ daysAhead: 30 });
  const { data: inventoryAlerts = [] } = trpc.inventory.getLowStockAlerts.useQuery();
  const { data: allInvoices = [] } = trpc.invoices.list.useQuery(isAdmin ? {} : undefined);
  const { data: allOrders = [] } = trpc.purchaseOrders.list.useQuery();

  const pendingInvoices = (allInvoices as any[]).filter((i: any) => i.status === "pending");
  const disputedInvoices = (allInvoices as any[]).filter((i: any) => i.status === "disputed");
  const activeOrders = (allOrders as any[]).filter((o: any) => ["issued", "confirmed", "partially_received"].includes(o.status));
  const myPending = (myRequests as any[]).filter((r: any) => r.status === "pending_approval");

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const totalActions = (pendingApprovals as any[]).length + pendingInvoices.length + disputedInvoices.length + (budgetAlerts as any[]).length;

  return (
    <div className="space-y-5 pb-8 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, <span style={{ color: `hsl(${preset.primary})` }}>{user?.name?.split(" ")[0]}</span> 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            {totalActions > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-medium">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse inline-block" />
                {totalActions} action{totalActions > 1 ? "s" : ""} requise{totalActions > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <Link href="/purchase-requests/new">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold btn-primary shadow-sm">
            <Plus className="h-4 w-4" />Nouvelle demande
          </button>
        </Link>
      </div>

      {/* Urgent approvals banner */}
      {(pendingApprovals as any[]).length > 0 && (
        <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-lg bg-amber-500 flex items-center justify-center">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <p className="font-semibold text-amber-800 text-base">
              {(pendingApprovals as any[]).length} approbation{(pendingApprovals as any[]).length > 1 ? "s" : ""} attend{(pendingApprovals as any[]).length > 1 ? "ent" : ""} votre décision
            </p>
          </div>
          <div className="space-y-2">
            {(pendingApprovals as any[]).slice(0, 3).map((a: any) => (
              <Link key={a.id} href={`/purchase-requests/${a.requestId}`}>
                <div className="flex items-center justify-between px-3 py-2.5 bg-white rounded-lg border border-amber-200 hover:shadow-sm transition-shadow cursor-pointer">
                  <div>
                    <p className="text-sm font-medium">{a.request?.title || `Demande #${a.requestId}`}</p>
                    <p className="text-xs text-muted-foreground">{a.request?.requestNumber} · Étape {a.stepOrder}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-amber-700">
                      {a.request?.amountEstimate ? `${fmt(Number(a.request.amountEstimate))} XOF` : ""}
                    </span>
                    <ChevronRight className="h-4 w-4 text-amber-400" />
                  </div>
                </div>
              </Link>
            ))}
            {(pendingApprovals as any[]).length > 3 && (
              <Link href="/approvals">
                <p className="text-xs text-amber-700 hover:underline text-center pt-1 cursor-pointer">
                  +{(pendingApprovals as any[]).length - 3} autres →
                </p>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Mes demandes"
          value={(myRequests as any[]).length}
          sub={`${myPending.length} en attente d'approbation`}
          icon={FileText}
          color="blue"
          href="/purchase-requests"
        />
        <MetricCard
          label="Bons de commande"
          value={activeOrders.length}
          sub="commandes actives"
          icon={ShoppingCart}
          color="purple"
          href="/purchase-orders"
        />
        <MetricCard
          label="Factures"
          value={pendingInvoices.length}
          sub={disputedInvoices.length > 0 ? `${disputedInvoices.length} en litige` : "en attente d'approbation"}
          icon={Receipt}
          color={disputedInvoices.length > 0 ? "red" : "cyan"}
          href="/invoices"
        />
        <MetricCard
          label="À approuver"
          value={(pendingApprovals as any[]).length}
          sub="nécessitent votre action"
          icon={Shield}
          color={(pendingApprovals as any[]).length > 0 ? "amber" : "emerald"}
          href="/approvals"
        />
      </div>

      {/* Main content row */}
      <div className="grid gap-3 lg:grid-cols-3 items-stretch">
        {/* Recent requests */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-700">
                <div className="h-6 w-6 rounded-md bg-blue-100 flex items-center justify-center">
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                </div>
                Mes demandes récentes
              </CardTitle>
              <Link href="/purchase-requests">
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  Voir tout <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="min-h-[280px]">
              {(myRequests as any[]).length === 0 ? (
                <div className="text-center py-10">
                  <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                    <FileText className="h-7 w-7 text-blue-400" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Aucune demande pour l'instant</p>
                  <p className="text-xs text-muted-foreground mt-1">Créez votre première demande d'achat</p>
                  <Link href="/purchase-requests/new">
                    <button className="mt-3 text-sm btn-primary px-4 py-1.5 rounded-lg text-white">
                      + Créer une demande
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {(myRequests as any[]).slice(0, 6).map((req: any) => (
                    <Link key={req.id} href={`/purchase-requests/${req.id}`}>
                      <div className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{req.title}</p>
                          <p className="text-xs text-muted-foreground">{req.requestNumber} · {timeAgo(req.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold text-muted-foreground">{fmt(Number(req.amountEstimate))} XOF</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[req.status] || "bg-gray-100 text-gray-700"}`}>
                            {STATUS_LABELS[req.status] || req.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3">
          {/* Quick actions */}
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-purple-700">
                <div className="h-6 w-6 rounded-md bg-purple-100 flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5 text-purple-600" />
                </div>
                Actions rapides
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 overflow-hidden">
              <ActionTile label="Demande d'achat" href="/purchase-requests/new" icon={FileText} color="blue" />
              <ActionTile label="Approbations" href="/approvals" icon={CheckCircle} color="amber" />
              <ActionTile label="Fournisseurs" href="/vendors" icon={Users} color="purple" />
              <ActionTile label="Factures" href="/invoices" icon={Receipt} color="cyan" />
              {isAdmin && <ActionTile label="Analyses" href="/analytics" icon={BarChart2} color="emerald" />}
              {isAdmin && <ActionTile label="Budgets" href="/budgets" icon={DollarSign} color="pink" />}
              <ActionTile label="Centre d'aide" href="/help" icon={HelpCircle} color="blue" />
            </CardContent>
          </Card>

          {/* Active POs */}
          {activeOrders.length > 0 && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-purple-700">
                  <div className="h-6 w-6 rounded-md bg-purple-100 flex items-center justify-center">
                    <ShoppingCart className="h-3.5 w-3.5 text-purple-600" />
                  </div>
                  Commandes actives
                </CardTitle>
                <Link href="/purchase-orders">
                  <button className="text-xs text-muted-foreground hover:text-foreground">Voir tout →</button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {activeOrders.slice(0, 3).map((o: any) => (
                  <Link key={o.id} href={`/purchase-orders/${o.id}`}>
                    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                      <div>
                        <p className="text-xs font-medium">{o.poNumber}</p>
                        <p className="text-xs text-muted-foreground">{o.vendor?.legalName || "—"}</p>
                      </div>
                      <span className="text-xs font-semibold text-purple-700">{fmt(Number(o.totalAmount))} XOF</span>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Alerts */}
      {isAdmin && ((budgetAlerts as any[]).length > 0 || (expiringContracts as any[]).length > 0 || (inventoryAlerts as any[]).length > 0 || disputedInvoices.length > 0) && (
        <div>
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Bell className="h-3.5 w-3.5" />Alertes
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(budgetAlerts as any[]).length > 0 && (
              <Link href="/budgets">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-red-200 bg-red-50 hover:shadow-sm cursor-pointer transition-shadow">
                  <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-800">{(budgetAlerts as any[]).length} dépassement{(budgetAlerts as any[]).length > 1 ? "s" : ""}</p>
                    <p className="text-xs text-red-600">budgétaires</p>
                  </div>
                </div>
              </Link>
            )}
            {disputedInvoices.length > 0 && (
              <Link href="/invoices">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-red-200 bg-red-50 hover:shadow-sm cursor-pointer transition-shadow">
                  <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-800">{disputedInvoices.length} facture{disputedInvoices.length > 1 ? "s" : ""}</p>
                    <p className="text-xs text-red-600">en litige</p>
                  </div>
                </div>
              </Link>
            )}
            {(expiringContracts as any[]).length > 0 && (
              <Link href="/vendors">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50 hover:shadow-sm cursor-pointer transition-shadow">
                  <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <Calendar className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">{(expiringContracts as any[]).length} contrat{(expiringContracts as any[]).length > 1 ? "s" : ""}</p>
                    <p className="text-xs text-amber-600">expirent dans 30j</p>
                  </div>
                </div>
              </Link>
            )}
            {(inventoryAlerts as any[]).length > 0 && (
              <Link href="/inventory">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50 hover:shadow-sm cursor-pointer transition-shadow">
                  <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-800">{(inventoryAlerts as any[]).length} article{(inventoryAlerts as any[]).length > 1 ? "s" : ""}</p>
                    <p className="text-xs text-blue-600">stock bas</p>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
