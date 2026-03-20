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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          {(disputedInvoices > 0 || revisedInvoices > 0) && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Factures en litige</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-900">{disputedInvoices + revisedInvoices}</div>
                <p className="text-xs text-red-700 mt-1">{disputedInvoices} litige{disputedInvoices > 1 ? 's' : ''}, {revisedInvoices} révision{revisedInvoices > 1 ? 's' : ''}</p>
                <Link href="/invoices">
                  <Button variant="outline" size="sm" className="mt-3 border-red-300 hover:bg-red-100">Voir les factures</Button>
                </Link>
              </CardContent>
            </Card>
          )}
          {budgetAlertCount > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.alerts.budgetAlerts')}</CardTitle>
                <TrendingUp className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-900">{budgetAlertCount}</div>
                <p className="text-xs text-red-700 mt-1">{t('dashboard.alerts.budgetAlertsDesc')}</p>
                <Link href="/budgets">
                  <Button variant="outline" size="sm" className="mt-3 border-red-300 hover:bg-red-100">{t('dashboard.alerts.reviewNow')}</Button>
                </Link>
              </CardContent>
            </Card>
          )}
          {contractAlertCount > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.alerts.expiringContracts')}</CardTitle>
                <FileCheck className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-900">{contractAlertCount}</div>
                <p className="text-xs text-orange-700 mt-1">{t('dashboard.alerts.expiringContractsDesc')}</p>
                <Link href="/vendors">
                  <Button variant="outline" size="sm" className="mt-3 border-orange-300 hover:bg-orange-100">{t('dashboard.alerts.reviewNow')}</Button>
                </Link>
              </CardContent>
            </Card>
          )}
          {inventoryAlertCount > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.alerts.lowStock')}</CardTitle>
                <Package className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-900">{inventoryAlertCount}</div>
                <p className="text-xs text-blue-700 mt-1">{t('dashboard.alerts.lowStockDesc')}</p>
                <Link href="/inventory">
                  <Button variant="outline" size="sm" className="mt-3 border-blue-300 hover:bg-blue-100">{t('dashboard.alerts.reviewNow')}</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Main Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.metrics.purchaseRequests')}</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests}</div>
            <p className="text-xs text-muted-foreground mt-1">{pendingRequests} {t('dashboard.metrics.pending')}</p>
            <Link href="/purchase-requests">
              <Button variant="ghost" size="sm" className="mt-2 p-0 h-auto text-xs">{t('common.viewAll')} →</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.metrics.purchaseOrders')}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">{activeOrders} {t('dashboard.metrics.active')}</p>
            <Link href="/purchase-orders">
              <Button variant="ghost" size="sm" className="mt-2 p-0 h-auto text-xs">{t('common.viewAll')} →</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.metrics.invoices')}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground mt-1">{pendingInvoices} {t('dashboard.metrics.pending')}</p>
            <Link href="/invoices">
              <Button variant="ghost" size="sm" className="mt-2 p-0 h-auto text-xs">{t('common.viewAll')} →</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.metrics.vendors')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeVendors}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('dashboard.metrics.activeVendors')}</p>
            <Link href="/vendors">
              <Button variant="ghost" size="sm" className="mt-2 p-0 h-auto text-xs">{t('common.viewAll')} →</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* My Requests */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.myRequests.title')}</CardTitle>
            <CardDescription>{t('dashboard.myRequests.desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRequests ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : myRequests && myRequests.length > 0 ? (
              <div className="space-y-3">
                {myRequests.slice(0, 5).map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{req.title}</p>
                      <p className="text-xs text-muted-foreground">{req.requestNumber} · {Number(req.amountEstimate).toLocaleString()} XOF</p>
                    </div>
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                      req.status === 'approved' ? 'bg-green-100 text-green-800' :
                      req.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      req.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {req.status === 'draft' ? t('status.draft') :
                       req.status === 'submitted' ? t('status.submitted') :
                       req.status === 'pending_approval' ? t('status.pendingApproval') :
                       req.status === 'approved' ? t('status.approved') :
                       req.status === 'rejected' ? t('status.rejected') : req.status}
                    </span>
                  </div>
                ))}
                {myRequests.length > 5 && (
                  <Link href="/purchase-requests">
                    <Button variant="outline" size="sm" className="w-full">{t('common.viewAll')}</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <ClipboardList className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{t('dashboard.myRequests.empty')}</p>
                <Link href="/purchase-requests/new">
                  <Button size="sm" className="mt-3">{t('dashboard.myRequests.create')}</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.pendingApprovals.title')}</CardTitle>
            <CardDescription>{t('dashboard.pendingApprovals.desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingApprovals ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : pendingApprovals && pendingApprovals.length > 0 ? (
              <div className="space-y-3">
                {pendingApprovals.slice(0, 5).map((approval) => (
                  <div key={approval.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{(approval as any).request?.title || `Demande #${approval.requestId}`}</p>
                      <p className="text-xs text-muted-foreground">{t('approvals.step')} {approval.stepOrder}</p>
                    </div>
                    <Link href={`/approvals/${approval.id}`}>
                      <Button size="sm" variant="outline">{t('common.review')}</Button>
                    </Link>
                  </div>
                ))}
                {pendingApprovals.length > 5 && (
                  <Link href="/approvals">
                    <Button variant="outline" size="sm" className="w-full">{t('common.viewAll')}</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{t('dashboard.pendingApprovals.empty')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
