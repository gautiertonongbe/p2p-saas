import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  ShoppingCart, 
  Users, 
  FileCheck, 
  AlertCircle, 
  TrendingUp,
  CheckCircle,
  Clock,
  Package,
  ClipboardList,
} from "lucide-react";import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  // Fetch dashboard data
  const { data: myRequests, isLoading: loadingRequests } = trpc.purchaseRequests.getMyRequests.useQuery();
  const { data: pendingApprovals, isLoading: loadingApprovals } = trpc.approvals.myPendingApprovals.useQuery();
  const { data: budgetAlerts, isLoading: loadingBudgets } = trpc.budgets.getOverspendingAlerts.useQuery();
  const { data: allRequests } = trpc.purchaseRequests.list.useQuery();
  const { data: allOrders } = trpc.purchaseOrders.list.useQuery();
  const { data: allInvoices } = trpc.invoices.list.useQuery();
  const { data: allVendors } = trpc.vendors.list.useQuery();
  const { data: expiringContracts } = trpc.vendors.getExpiringContracts.useQuery({ daysAhead: 30 });
  const { data: inventoryAlerts } = trpc.inventory.getLowStockAlerts.useQuery();

  // Calculate metrics
  const totalRequests = allRequests?.length || 0;
  const pendingRequests = allRequests?.filter(r => r.status === "pending_approval").length || 0;
  const approvedRequests = allRequests?.filter(r => r.status === "approved").length || 0;
  
  const totalOrders = allOrders?.length || 0;
  const activeOrders = allOrders?.filter(o => ["issued", "confirmed", "partially_received"].includes(o.status)).length || 0;
  
  const totalInvoices = allInvoices?.length || 0;
  const pendingInvoices = allInvoices?.filter(i => i.status === "pending").length || 0;
  const disputedInvoices = allInvoices?.filter(i => i.status === "disputed").length || 0;
  const revisedInvoices = allInvoices?.filter(i => i.status === "revised").length || 0;
  
  const activeVendors = allVendors?.filter(v => v.status === "active").length || 0;
  
  const myPendingCount = pendingApprovals?.length || 0;
  const budgetAlertCount = budgetAlerts?.length || 0;
  const contractAlertCount = expiringContracts?.length || 0;
  const inventoryAlertCount = inventoryAlerts?.length || 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('auth.welcomeBack')}, {user?.name || "User"}. {t('dashboard.subtitle')}
        </p>
      </div>

      {/* Alerts Section */}
      {(myPendingCount > 0 || budgetAlertCount > 0 || contractAlertCount > 0 || inventoryAlertCount > 0 || disputedInvoices > 0) && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{/* up to 5 — wraps naturally */}
          {myPendingCount > 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.alerts.pendingApprovals')}</CardTitle>
                <Clock className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-900">{myPendingCount}</div>
                <p className="text-xs text-yellow-700 mt-1">
                  {myPendingCount} demande{myPendingCount > 1 ? 's' : ''} en attente
                </p>
                <Link href="/approvals">
                  <Button variant="outline" size="sm" className="mt-3 border-yellow-300 hover:bg-yellow-100">
                    {t('dashboard.alerts.reviewNow')}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {budgetAlertCount > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.alerts.budgetAlerts')}</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-900">{budgetAlertCount}</div>
                <p className="text-xs text-red-700 mt-1">
                  {budgetAlertCount} budget{budgetAlertCount > 1 ? 's' : ''} dépassé{budgetAlertCount > 1 ? 's' : ''}
                </p>
                <Link href="/budgets">
                  <Button variant="outline" size="sm" className="mt-3 border-red-300 hover:bg-red-100">
                    {t('dashboard.alerts.viewBudgets')}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {contractAlertCount > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contrats expirant</CardTitle>
                <FileCheck className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-900">{contractAlertCount}</div>
                <p className="text-xs text-orange-700 mt-1">
                  {contractAlertCount} contrat{contractAlertCount > 1 ? 's' : ''} dans 30 jours
                </p>
                <Link href="/vendors">
                  <Button variant="outline" size="sm" className="mt-3 border-orange-300 hover:bg-orange-100">
                    Voir les fournisseurs
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {inventoryAlertCount > 0 && (
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stock bas</CardTitle>
                <Package className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-900">{inventoryAlertCount}</div>
                <p className="text-xs text-purple-700 mt-1">
                  {inventoryAlertCount} article{inventoryAlertCount > 1 ? 's' : ''} sous le seuil
                </p>
                <Link href="/inventory">
                  <Button variant="outline" size="sm" className="mt-3 border-purple-300 hover:bg-purple-100">
                    Gérer l'inventaire
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {disputedInvoices > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Factures en litige</CardTitle>
                <AlertCircle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-900">{disputedInvoices}</div>
                <p className="text-xs text-orange-700 mt-1">
                  {disputedInvoices} facture{disputedInvoices > 1 ? 's' : ''} nécessitent une attention
                </p>
                <Link href="/invoices">
                  <Button variant="outline" size="sm" className="mt-3 border-orange-300 hover:bg-orange-100">
                    Voir les litiges
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.metrics.purchaseRequests')}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingRequests} {t('dashboard.metrics.pending')}, {approvedRequests} {t('dashboard.metrics.approved')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.metrics.purchaseOrders')}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeOrders} {t('dashboard.metrics.activeOrders')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.metrics.invoices')}</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingInvoices} {t('dashboard.metrics.pendingApproval')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.metrics.activeVendors')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeVendors}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('dashboard.metrics.approvedSuppliers')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.quickActions.title')}</CardTitle>
          <CardDescription>{t('dashboard.quickActions.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <Link href="/purchase-requests/new">
              <Button className="w-full" variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Nouvelle demande
              </Button>
            </Link>
            <Link href="/approvals">
              <Button className="w-full" variant="outline">
                <CheckCircle className="mr-2 h-4 w-4" />
                Approbations
              </Button>
            </Link>
            <Link href="/rfqs/new">
              <Button className="w-full" variant="outline">
                <ClipboardList className="mr-2 h-4 w-4" />
                Nouvel appel d'offres
              </Button>
            </Link>
            <Link href="/vendors">
              <Button className="w-full" variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Fournisseurs
              </Button>
            </Link>
            <Link href="/inventory">
              <Button className="w-full" variant="outline">
                <Package className="mr-2 h-4 w-4" />
                Inventaire
              </Button>
            </Link>
            <Link href="/analytics">
              <Button className="w-full" variant="outline">
                <TrendingUp className="mr-2 h-4 w-4" />
                Analyses
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.recentActivity.myRecentRequests')}</CardTitle>
            <CardDescription>{t('dashboard.recentActivity.myRecentRequestsSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRequests ? (
              <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
            ) : myRequests && myRequests.length > 0 ? (
              <div className="space-y-3">
                {myRequests.slice(0, 5).map((request) => (
                  <Link key={request.id} href={`/purchase-requests/${request.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{request.title}</p>
                        <p className="text-xs text-muted-foreground">{request.requestNumber}</p>
                      </div>
                      <span className={`status-badge status-${request.status}`}>
                        {t(`purchaseRequests.status.${request.status}`)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{t('dashboard.recentActivity.noRecentRequests')}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.recentActivity.pendingApprovals')}</CardTitle>
            <CardDescription>{t('dashboard.recentActivity.pendingApprovalsSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingApprovals ? (
              <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
            ) : pendingApprovals && pendingApprovals.length > 0 ? (
              <div className="space-y-3">
                {pendingApprovals.slice(0, 5).map((approval) => (
                  <Link key={approval.id} href={`/approvals/${approval.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{approval.request?.title}</p>
                        <p className="text-xs text-muted-foreground">{approval.request?.requestNumber}</p>
                      </div>
                      <span className="text-xs text-yellow-600 font-medium">
                        {new Intl.NumberFormat('fr-FR').format(Number(approval.request?.amountEstimate || 0))} XOF
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{t('dashboard.recentActivity.noPendingApprovals')}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
