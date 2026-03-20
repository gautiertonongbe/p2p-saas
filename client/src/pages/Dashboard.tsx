import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FileText, ShoppingCart, Users, FileCheck, AlertCircle, TrendingUp,
  CheckCircle, Clock, Package, ArrowUpRight, ArrowDownRight, Zap,
  BarChart3, Activity, Bell, ChevronRight, CircleDollarSign,
  ShieldCheck, Truck, Receipt, Star, Target, Flame
} from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function formatXOF(amount: number) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M XOF`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K XOF`;
  return `${amount.toLocaleString()} XOF`;
}

function StatCard({ title, value, sub, icon: Icon, trend, color, href }: any) {
  const colorMap: any = {
    blue: "from-blue-500 to-blue-600",
    emerald: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    rose: "from-rose-500 to-rose-600",
    violet: "from-violet-500 to-violet-600",
    cyan: "from-cyan-500 to-cyan-600",
  };
  const gradient = colorMap[color] || colorMap.blue;
  const content = (
    <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 cursor-pointer group">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`} />
      <div className="absolute inset-0 bg-grid-white/10" />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-white/80 text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
            <p className="text-white text-3xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-white/70 text-xs mt-1.5">{sub}</p>}
          </div>
          <div className="bg-white/20 rounded-xl p-2.5 group-hover:bg-white/30 transition-colors">
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
        {trend !== undefined && (
          <div className="mt-3 flex items-center gap-1">
            {trend >= 0
              ? <ArrowUpRight className="h-3.5 w-3.5 text-white/80" />
              : <ArrowDownRight className="h-3.5 w-3.5 text-white/80" />}
            <span className="text-white/80 text-xs font-medium">
              {Math.abs(trend)}% ce mois
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function AlertCard({ icon: Icon, title, count, desc, color, href }: any) {
  const colorMap: any = {
    yellow: "bg-amber-50 border-amber-200 text-amber-800",
    red: "bg-rose-50 border-rose-200 text-rose-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    purple: "bg-violet-50 border-violet-200 text-violet-800",
  };
  const iconMap: any = {
    yellow: "text-amber-500",
    red: "text-rose-500",
    blue: "text-blue-500",
    purple: "text-violet-500",
  };
  return (
    <Link href={href || "#"}>
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${colorMap[color]} hover:opacity-80 transition-opacity cursor-pointer`}>
        <div className={`shrink-0 ${iconMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{count} {title}</p>
          <p className="text-xs opacity-70 truncate">{desc}</p>
        </div>
        <ChevronRight className="h-4 w-4 opacity-50 shrink-0" />
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data: myRequests } = trpc.purchaseRequests.getMyRequests.useQuery();
  const { data: pendingApprovals } = trpc.approvals.myPendingApprovals.useQuery();
  const { data: budgetAlerts } = trpc.budgets.getOverspendingAlerts.useQuery();
  const { data: allRequests } = trpc.purchaseRequests.list.useQuery();
  const { data: allOrders } = trpc.purchaseOrders.list.useQuery();
  const { data: allInvoices } = trpc.invoices.list.useQuery();
  const { data: allVendors } = trpc.vendors.list.useQuery();
  const { data: expiringContracts } = trpc.vendors.getExpiringContracts.useQuery({ daysAhead: 30 });
  const { data: inventoryAlerts } = trpc.inventory.getLowStockAlerts.useQuery();

  const totalRequests = allRequests?.length || 0;
  const pendingRequests = allRequests?.filter(r => r.status === "pending_approval").length || 0;
  const approvedRequests = allRequests?.filter(r => r.status === "approved").length || 0;
  const totalOrders = allOrders?.length || 0;
  const activeOrders = allOrders?.filter(o => ["issued", "confirmed", "partially_received"].includes(o.status)).length || 0;
  const totalInvoices = allInvoices?.length || 0;
  const pendingInvoices = allInvoices?.filter(i => i.status === "pending").length || 0;
  const disputedInvoices = allInvoices?.filter(i => i.status === "disputed").length || 0;
  const activeVendors = allVendors?.filter(v => v.status === "active").length || 0;
  const myPendingCount = pendingApprovals?.length || 0;
  const budgetAlertCount = budgetAlerts?.length || 0;
  const contractAlertCount = expiringContracts?.length || 0;
  const inventoryAlertCount = inventoryAlerts?.length || 0;

  const totalSpend = allOrders?.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0) || 0;
  const invoiceSpend = allInvoices?.reduce((sum, i) => sum + Number(i.amount || 0), 0) || 0;

  // Chart data
  const requestStatusData = [
    { name: "Brouillon", value: allRequests?.filter(r => r.status === "draft").length || 0, color: "#94a3b8" },
    { name: "En attente", value: pendingRequests, color: "#f59e0b" },
    { name: "Approuvées", value: approvedRequests, color: "#10b981" },
    { name: "Rejetées", value: allRequests?.filter(r => r.status === "rejected").length || 0, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const orderStatusData = [
    { name: "Brouillon", value: allOrders?.filter(o => o.status === "draft").length || 0 },
    { name: "Émis", value: allOrders?.filter(o => o.status === "issued").length || 0 },
    { name: "Confirmé", value: allOrders?.filter(o => o.status === "confirmed").length || 0 },
    { name: "Reçu", value: allOrders?.filter(o => o.status === "received").length || 0 },
    { name: "Clôturé", value: allOrders?.filter(o => o.status === "closed").length || 0 },
  ];

  // Spend by month mock (replace with real data later)
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun"];
  const spendData = months.map((m, i) => ({
    month: m,
    dépenses: Math.round(totalSpend * (0.1 + Math.random() * 0.25)),
    factures: Math.round(invoiceSpend * (0.1 + Math.random() * 0.25)),
  }));

  const alertCount = myPendingCount + budgetAlertCount + contractAlertCount + inventoryAlertCount + disputedInvoices;
  const approvalRate = totalRequests > 0 ? Math.round((approvedRequests / totalRequests) * 100) : 0;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className="space-y-6 pb-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-6 text-white shadow-xl">
        <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-8 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-5 w-5 text-amber-300" />
              <span className="text-white/80 text-sm font-medium">{greeting},</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{user?.name || "Utilisateur"}</h1>
            <p className="text-white/70 mt-1 text-sm">
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {myPendingCount > 0 && (
              <Link href="/approvals">
                <div className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-4 py-2.5 cursor-pointer">
                  <Bell className="h-4 w-4" />
                  <span className="text-sm font-semibold">{myPendingCount} approbation{myPendingCount > 1 ? "s" : ""}</span>
                </div>
              </Link>
            )}
            <Link href="/purchase-requests/new">
              <div className="flex items-center gap-2 bg-white text-primary hover:bg-white/90 transition-colors rounded-xl px-4 py-2.5 cursor-pointer font-semibold text-sm">
                <FileText className="h-4 w-4" />
                Nouvelle demande
              </div>
            </Link>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Mes demandes", value: myRequests?.length || 0, icon: FileText },
            { label: "Approbations", value: myPendingCount, icon: ShieldCheck },
            { label: "Alertes actives", value: alertCount, icon: AlertCircle },
            { label: "Taux approbation", value: `${approvalRate}%`, icon: Target },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white/15 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-3.5 w-3.5 text-white/70" />
                <span className="text-white/70 text-xs">{label}</span>
              </div>
              <p className="text-white text-xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Demandes d'achat" value={totalRequests} sub={`${pendingRequests} en attente`} icon={FileText} color="blue" trend={12} href="/purchase-requests" />
        <StatCard title="Bons de commande" value={totalOrders} sub={`${activeOrders} actifs`} icon={ShoppingCart} color="violet" trend={8} href="/purchase-orders" />
        <StatCard title="Factures" value={totalInvoices} sub={`${pendingInvoices} à traiter`} icon={Receipt} color="emerald" trend={-3} href="/invoices" />
        <StatCard title="Fournisseurs actifs" value={activeVendors} sub={`${allVendors?.length || 0} au total`} icon={Users} color="amber" trend={5} href="/vendors" />
      </div>

      {/* Spend Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <StatCard title="Volume de commandes" value={formatXOF(totalSpend)} sub="Total bons de commande" icon={CircleDollarSign} color="cyan" href="/purchase-orders" />
        <StatCard title="Volume de facturation" value={formatXOF(invoiceSpend)} sub="Total factures reçues" icon={TrendingUp} color="rose" href="/invoices" />
      </div>

      {/* Alerts */}
      {alertCount > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="bg-rose-100 rounded-lg p-1.5">
                <AlertCircle className="h-4 w-4 text-rose-600" />
              </div>
              <CardTitle className="text-base">Actions requises</CardTitle>
              <Badge variant="destructive" className="ml-auto">{alertCount}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {myPendingCount > 0 && <AlertCard icon={Clock} title="approbation(s) en attente" count={myPendingCount} desc="Demandes nécessitant votre validation" color="yellow" href="/approvals" />}
            {disputedInvoices > 0 && <AlertCard icon={AlertCircle} title="facture(s) en litige" count={disputedInvoices} desc="Litiges à résoudre avec les fournisseurs" color="red" href="/invoices" />}
            {budgetAlertCount > 0 && <AlertCard icon={BarChart3} title="dépassement(s) budgétaire(s)" count={budgetAlertCount} desc="Budgets ayant dépassé leur limite" color="red" href="/budgets" />}
            {contractAlertCount > 0 && <AlertCard icon={FileCheck} title="contrat(s) expirant bientôt" count={contractAlertCount} desc="Contrats fournisseurs à renouveler" color="purple" href="/vendors" />}
            {inventoryAlertCount > 0 && <AlertCard icon={Package} title="alerte(s) stock bas" count={inventoryAlertCount} desc="Articles en dessous du niveau de réapprovisionnement" color="blue" href="/inventory" />}
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Spend trend */}
        <Card className="lg:col-span-2 border-0 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 rounded-lg p-1.5">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-base">Évolution des dépenses</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">6 derniers mois</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={spendData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="colorDepenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorFactures" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: any) => formatXOF(v)} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Area type="monotone" dataKey="dépenses" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorDepenses)" name="Commandes" />
                <Area type="monotone" dataKey="factures" stroke="#10b981" strokeWidth={2} fill="url(#colorFactures)" name="Factures" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* PR Status Pie */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-violet-100 rounded-lg p-1.5">
                <Zap className="h-4 w-4 text-violet-600" />
              </div>
              <CardTitle className="text-base">Statut des demandes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {requestStatusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={requestStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {requestStatusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {requestStatusData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-muted-foreground">{d.name}</span>
                      </div>
                      <span className="font-semibold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                Aucune donnée disponible
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orders Bar Chart + Pipeline */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-amber-100 rounded-lg p-1.5">
                <BarChart3 className="h-4 w-4 text-amber-600" />
              </div>
              <CardTitle className="text-base">Bons de commande par statut</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={orderStatusData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="value" name="Commandes" radius={[4, 4, 0, 0]}>
                  {orderStatusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* P2P Pipeline */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-100 rounded-lg p-1.5">
                <Truck className="h-4 w-4 text-emerald-600" />
              </div>
              <CardTitle className="text-base">Pipeline P2P</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Demandes d'achat", value: totalRequests, max: Math.max(totalRequests, 1), color: "bg-blue-500", href: "/purchase-requests" },
              { label: "Bons de commande", value: totalOrders, max: Math.max(totalRequests, 1), color: "bg-violet-500", href: "/purchase-orders" },
              { label: "Factures", value: totalInvoices, max: Math.max(totalRequests, 1), color: "bg-emerald-500", href: "/invoices" },
              { label: "Paiements", value: allInvoices?.filter(i => i.status === "paid").length || 0, max: Math.max(totalRequests, 1), color: "bg-amber-500", href: "/payments" },
            ].map(({ label, value, max, color, href }) => (
              <Link href={href} key={label}>
                <div className="space-y-1 hover:opacity-80 transition-opacity cursor-pointer">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
                  </div>
                </div>
              </Link>
            ))}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-400" />Taux de conversion</span>
                <span className="font-semibold text-foreground">{totalRequests > 0 ? Math.round((totalOrders / totalRequests) * 100) : 0}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 rounded-lg p-1.5">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">Actions rapides</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Nouvelle demande", icon: FileText, href: "/purchase-requests/new", color: "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200" },
              { label: "Nouveau fournisseur", icon: Users, href: "/vendors/new", color: "bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200" },
              { label: "Nouvel appel d'offres", icon: ShoppingCart, href: "/rfqs/new", color: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200" },
              { label: "Voir les approbations", icon: CheckCircle, href: "/approvals", color: "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200" },
            ].map(({ label, icon: Icon, href, color }) => (
              <Link href={href} key={label}>
                <div className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${color} transition-colors cursor-pointer`}>
                  <Icon className="h-6 w-6" />
                  <span className="text-xs font-medium text-center leading-tight">{label}</span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
