import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import {
  TrendingUp, TrendingDown, DollarSign, FileText, Users,
  ShoppingCart, Download, AlertTriangle, CheckCircle2, Clock, BarChart2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const formatCurrencyShort = (amount: number) => {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return formatCurrency(amount);
};

function exportToCSV(data: any[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => JSON.stringify(row[h] ?? "")).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Analytics() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: allRequests } = trpc.purchaseRequests.list.useQuery();
  const { data: allOrders } = trpc.purchaseOrders.list.useQuery();
  const { data: allInvoices } = trpc.invoices.list.useQuery();
  const { data: allVendors } = trpc.vendors.list.useQuery();
  const { data: budgetAlerts } = trpc.budgets.getOverspendingAlerts.useQuery();
  const { data: spendByVendor } = trpc.budgets.getSpendAnalytics.useQuery({ groupBy: "vendor" });
  const { data: spendByMonth } = trpc.budgets.getSpendAnalytics.useQuery({ groupBy: "month" });
  const { data: pendingApprovals } = trpc.approvals.myPendingApprovals.useQuery();
  const { data: savingsData } = trpc.budgets.getSavingsTracking.useQuery();

  const totalSpend = allOrders?.reduce((s, o) => s + parseFloat(o.totalAmount || "0"), 0) ?? 0;
  const totalInvoiceSpend = allInvoices?.reduce((s, i) => s + parseFloat(i.amount || "0"), 0) ?? 0;
  const totalRequests = allRequests?.length ?? 0;
  const approvedRequests = allRequests?.filter(r => r.status === "approved").length ?? 0;
  const rejectedRequests = allRequests?.filter(r => r.status === "rejected").length ?? 0;
  const pendingRequests = allRequests?.filter(r => r.status === "pending_approval").length ?? 0;
  const approvalRate = totalRequests > 0 ? Math.round((approvedRequests / totalRequests) * 100) : 0;
  const totalOrders = allOrders?.length ?? 0;
  const closedOrders = allOrders?.filter(o => o.status === "closed").length ?? 0;
  const activeVendors = allVendors?.filter(v => v.status === "active").length ?? 0;
  const pendingVendors = allVendors?.filter(v => v.status === "pending").length ?? 0;
  const paidInvoices = allInvoices?.filter(i => i.status === "paid").length ?? 0;
  const pendingInvoices = allInvoices?.filter(i => i.status === "pending").length ?? 0;
  const overdueInvoices = allInvoices?.filter(i => {
    if (i.status !== "pending" || !i.dueDate) return false;
    return new Date(i.dueDate) < new Date();
  }).length ?? 0;

  const requestStatusData = [
    { name: "Approuvées", value: approvedRequests, color: "#16a34a" },
    { name: "En attente", value: pendingRequests, color: "#d97706" },
    { name: "Rejetées", value: rejectedRequests, color: "#dc2626" },
    { name: "Brouillons", value: (allRequests?.filter(r => r.status === "draft").length ?? 0), color: "#6b7280" },
  ].filter(d => d.value > 0);

  const invoiceStatusData = [
    { name: "En attente", value: pendingInvoices, color: "#d97706" },
    { name: "Approuvées", value: allInvoices?.filter(i => i.status === "approved").length ?? 0, color: "#2563eb" },
    { name: "Payées", value: paidInvoices, color: "#16a34a" },
    { name: "Rejetées", value: allInvoices?.filter(i => i.status === "rejected").length ?? 0, color: "#dc2626" },
  ].filter(d => d.value > 0);

  const topVendors = [...(spendByVendor ?? [])].sort((a, b) => b.amount - a.amount).slice(0, 8);
  const monthlySpend = [...(spendByMonth ?? [])].sort((a, b) => a.label.localeCompare(b.label)).slice(-12);

  const metrics = [
    { label: "Dépenses totales (BCs)", value: formatCurrencyShort(totalSpend), unit: "XOF", icon: DollarSign, sub: `${totalOrders} bons de commande`, color: "bg-blue-100 text-blue-600" },
    { label: "Demandes d'achat", value: String(totalRequests), unit: "", icon: FileText, sub: `${approvalRate}% taux d'approbation`, color: "bg-purple-100 text-purple-600" },
    { label: "Fournisseurs actifs", value: String(activeVendors), unit: "", icon: Users, sub: `${pendingVendors} en attente`, color: "bg-green-100 text-green-600" },
    { label: "Factures en attente", value: String(pendingInvoices), unit: "", icon: ShoppingCart, sub: overdueInvoices > 0 ? `⚠ ${overdueInvoices} en retard` : `${paidInvoices} payées`, color: overdueInvoices > 0 ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600" },
  ];

  const handleExportRequests = () => exportToCSV((allRequests ?? []).map(r => ({ "N° Demande": r.requestNumber, "Titre": r.title, "Montant (XOF)": r.amountEstimate, "Statut": r.status, "Urgence": r.urgencyLevel, "Date": new Date(r.createdAt).toLocaleDateString("fr-FR") })), `demandes-${new Date().toISOString().split("T")[0]}.csv`);
  const handleExportOrders = () => exportToCSV((allOrders ?? []).map(o => ({ "N° BC": o.poNumber, "Montant (XOF)": o.totalAmount, "Statut": o.status, "Date": new Date(o.createdAt).toLocaleDateString("fr-FR") })), `bons-commande-${new Date().toISOString().split("T")[0]}.csv`);
  const handleExportInvoices = () => exportToCSV((allInvoices ?? []).map(i => ({ "N° Facture": i.invoiceNumber, "Montant (XOF)": i.amount, "TVA": i.taxAmount, "Statut": i.status, "Date": new Date(i.invoiceDate).toLocaleDateString("fr-FR") })), `factures-${new Date().toISOString().split("T")[0]}.csv`);

  return (
    <div className="space-y-6">
      <PageHeader icon={<TrendingUp className="h-5 w-5" />} title={t("analytics.title")} description={t("analytics.description")} />
<div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("analytics.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("analytics.overview")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportRequests}><Download className="mr-2 h-4 w-4" />Demandes CSV</Button>
          <Button variant="outline" size="sm" onClick={handleExportOrders}><Download className="mr-2 h-4 w-4" />BCs CSV</Button>
          <Button variant="outline" size="sm" onClick={handleExportInvoices}><Download className="mr-2 h-4 w-4" />Factures CSV</Button>
        </div>
      </div>

      {((budgetAlerts && budgetAlerts.length > 0) || overdueInvoices > 0 || (pendingApprovals && pendingApprovals.length > 0)) && (
        <div className="flex flex-wrap gap-3">
          {budgetAlerts && budgetAlerts.length > 0 && (<div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm"><AlertTriangle className="h-4 w-4" />{budgetAlerts.length} budget(s) dépassé(s)</div>)}
          {overdueInvoices > 0 && (<div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 text-sm"><Clock className="h-4 w-4" />{overdueInvoices} facture(s) en retard</div>)}
          {pendingApprovals && pendingApprovals.length > 0 && (<div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm"><CheckCircle2 className="h-4 w-4" />{pendingApprovals.length} approbation(s) en attente</div>)}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <p className="text-2xl font-bold mt-1">{metric.value}{metric.unit && <span className="text-sm font-normal text-muted-foreground ml-1">{metric.unit}</span>}</p>
                    <p className="text-xs text-muted-foreground mt-1">{metric.sub}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${metric.color}`}><Icon className="h-6 w-6" /></div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="spend" className="space-y-4">
        <TabsList>
          <TabsTrigger value="spend">Dépenses</TabsTrigger>
          <TabsTrigger value="requests">Demandes</TabsTrigger>
          <TabsTrigger value="invoices">Factures</TabsTrigger>
          <TabsTrigger value="vendors">Fournisseurs</TabsTrigger>
          <TabsTrigger value="savings">Économies</TabsTrigger>
          <TabsTrigger value="reports">Rapports</TabsTrigger>
        </TabsList>

        <TabsContent value="spend" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Évolution mensuelle des dépenses</CardTitle><CardDescription>Dépenses par mois en XOF</CardDescription></CardHeader>
              <CardContent>
                {monthlySpend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={monthlySpend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(val: number) => [`${formatCurrency(val)} XOF`, "Dépenses"]} />
                      <Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (<div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Aucune donnée de dépenses disponible</div>)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Top fournisseurs</CardTitle><CardDescription>Par volume d'achats</CardDescription></CardHeader>
              <CardContent>
                {topVendors.length > 0 ? (
                  <div className="space-y-3">
                    {topVendors.slice(0, 6).map((vendor, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-4">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{vendor.label}</span>
                            <span className="text-xs text-muted-foreground ml-2 shrink-0">{formatCurrencyShort(vendor.amount)} XOF</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((vendor.amount / (topVendors[0]?.amount || 1)) * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (<div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Aucune donnée fournisseur</div>)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Résumé financier</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Dépenses totales (BCs)", value: `${formatCurrency(totalSpend)} XOF` },
                    { label: "Total facturé", value: `${formatCurrency(totalInvoiceSpend)} XOF` },
                    { label: "Écart BC / Factures", value: `${formatCurrency(Math.abs(totalSpend - totalInvoiceSpend))} XOF` },
                    { label: "BCs clôturés", value: `${closedOrders} / ${totalOrders}` },
                    { label: "Taux d'approbation DR", value: `${approvalRate}%` },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className="text-sm font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Répartition par statut</CardTitle></CardHeader>
              <CardContent>
                {requestStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={requestStatusData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {requestStatusData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                      </Pie>
                      <Tooltip formatter={(val: number) => [val, "Demandes"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (<div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Aucune demande</div>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Pipeline des demandes</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Total", value: totalRequests, color: "bg-gray-100 text-gray-700" },
                    { label: "Approuvées", value: approvedRequests, color: "bg-green-100 text-green-700" },
                    { label: "En attente", value: pendingRequests, color: "bg-yellow-100 text-yellow-700" },
                    { label: "Rejetées", value: rejectedRequests, color: "bg-red-100 text-red-700" },
                    { label: "Brouillons", value: allRequests?.filter(r => r.status === "draft").length ?? 0, color: "bg-blue-100 text-blue-700" },
                    { label: "Converties en BC", value: allRequests?.filter(r => r.status === "converted_to_po").length ?? 0, color: "bg-purple-100 text-purple-700" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">{item.label}</span>
                      <Badge className={item.color} variant="outline">{item.value}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Statut des factures</CardTitle></CardHeader>
              <CardContent>
                {invoiceStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={invoiceStatusData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {invoiceStatusData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                      </Pie>
                      <Tooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (<div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Aucune facture</div>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Indicateurs de facturation</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Total factures", value: allInvoices?.length ?? 0, alert: false },
                    { label: "Montant total facturé", value: `${formatCurrency(totalInvoiceSpend)} XOF`, alert: false },
                    { label: "En attente", value: pendingInvoices, alert: false },
                    { label: "Approuvées", value: allInvoices?.filter(i => i.status === "approved").length ?? 0, alert: false },
                    { label: "Payées", value: paidInvoices, alert: false },
                    { label: "En retard de paiement", value: overdueInvoices, alert: overdueInvoices > 0 },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className={`text-sm font-medium ${item.alert ? "text-red-600 font-bold" : ""}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vendors" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Répartition des fournisseurs</CardTitle></CardHeader>
              <CardContent>
                {allVendors && allVendors.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Actifs", value: activeVendors, color: "#16a34a" },
                          { name: "En attente", value: pendingVendors, color: "#d97706" },
                          { name: "Inactifs", value: allVendors.filter(v => v.status === "inactive").length, color: "#6b7280" },
                        ].filter(d => d.value > 0)}
                        cx="50%" cy="50%" outerRadius={90} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}
                      >
                        {["#16a34a","#d97706","#6b7280"].map((c, i) => <Cell key={i} fill={c} />)}
                      </Pie>
                      <Tooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (<div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Aucun fournisseur</div>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Top fournisseurs par dépenses</CardTitle></CardHeader>
              <CardContent>
                {topVendors.length > 0 ? (
                  <div className="space-y-3">
                    {topVendors.slice(0, 6).map((vendor, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-4">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{vendor.label}</span>
                            <span className="text-xs text-muted-foreground ml-2 shrink-0">{formatCurrencyShort(vendor.amount)} XOF</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((vendor.amount / (topVendors[0]?.amount || 1)) * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (<div className="py-8 text-center text-muted-foreground text-sm">Aucune donnée de dépenses fournisseur disponible</div>)}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Savings Tab */}
        <TabsContent value="savings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Économies identifiées</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrencyShort(savingsData?.totalSavings ?? 0)} <span className="text-sm font-normal text-muted-foreground">XOF</span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Dépenses totales analysées</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrencyShort(savingsData?.totalSpend ?? 0)} <span className="text-sm font-normal text-muted-foreground">XOF</span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Taux d'économies potentiel</p>
                <p className="text-2xl font-bold mt-1 text-green-600">{savingsData?.savingsPercent ?? 0}%</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Opportunités d'économies identifiées</CardTitle>
              <CardDescription>Leviers d'optimisation des achats recommandés</CardDescription>
            </CardHeader>
            <CardContent>
              {savingsData?.savingsOpportunities?.length ? (
                <div className="space-y-3">
                  {savingsData.savingsOpportunities.map((opp: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <p className="font-medium text-sm">{opp.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-700">+{formatCurrencyShort(opp.potentialSavings)} XOF</p>
                        <p className="text-xs text-muted-foreground">potentiel</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-6 text-sm">Aucune donnée d'économies disponible</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports tab — gateway to the full report builder */}
        <TabsContent value="reports">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <div className="p-4 bg-primary/10 rounded-2xl inline-flex mb-5">
                  <BarChart2 className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">Générateur de rapports personnalisés</h2>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  Créez des rapports sur mesure avec filtres avancés, regroupements, graphiques interactifs et export CSV. Sauvegardez vos rapports pour les relancer en un clic.
                </p>
                <Button size="lg" onClick={() => setLocation("/reports")}>
                  Ouvrir le générateur de rapports
                </Button>
              </CardContent>
            </Card>

            {/* Quick reports */}
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { title: "Dépenses par fournisseur", desc: "Total des bons de commande groupés par fournisseur", path: "/reports?entity=purchaseOrders&groupBy=vendorName&sortBy=totalAmount_sum&sortDir=desc" },
                { title: "Factures en attente", desc: "Toutes les factures au statut 'pending'", path: "/reports?entity=invoices&filter=status:eq:pending" },
                { title: "Budget vs consommé", desc: "Vue budgétaire avec disponible calculé", path: "/reports?entity=budgets&sortBy=fiscalPeriod" },
              ].map((q, i) => (
                <Card key={i} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setLocation(q.path)}>
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{q.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{q.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
