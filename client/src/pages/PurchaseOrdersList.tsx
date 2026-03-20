import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Plus, Search, ShoppingCart, FileText } from "lucide-react";
import { useState } from "react";
import { ViewManager, ViewState } from "@/components/ViewManager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PurchaseOrdersList() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewState, setViewState] = useState<ViewState>({ filters: [], displayType: "table" });

  const PO_COLUMNS = [
    { key: "poNumber", label: "N° BC", sortable: true },
    { key: "status", label: "Statut", type: "status" as const, filterable: true,
      filterOptions: [
        { value: "draft", label: "Brouillon" }, { value: "issued", label: "Émis" },
        { value: "received", label: "Réceptionné" }, { value: "closed", label: "Clôturé" }, { value: "cancelled", label: "Annulé" },
      ]},
    { key: "totalAmount", label: "Montant total", type: "amount" as const, sortable: true },
    { key: "vendorId", label: "Fournisseur", filterable: true },
    { key: "createdAt", label: "Date création", type: "date" as const, sortable: true },
    { key: "expectedDeliveryDate", label: "Livraison prévue", type: "date" as const, sortable: true },
  ];

  const { data: purchaseOrders, isLoading } = trpc.purchaseOrders.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );

  // Client-side search filter on top of server-side status filter
  const filteredOrders = purchaseOrders?.filter((po) => {
    const matchesSearch =
      po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (po.vendor?.legalName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || po.status === statusFilter;
    const matchesViewFilters = viewState.filters.every(f => {
      const val = (po as any)[f.field];
      switch (f.operator) {
        case "eq": return String(val) === f.value;
        case "ne": return String(val) !== f.value;
        case "contains": return String(val).toLowerCase().includes(f.value.toLowerCase());
        case "gt": return Number(val) > Number(f.value);
        case "gte": return Number(val) >= Number(f.value);
        case "lt": return Number(val) < Number(f.value);
        case "lte": return Number(val) <= Number(f.value);
        default: return true;
      }
    });
    return matchesSearch && matchesStatus && matchesViewFilters;
  });

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("fr-FR").format(Number(amount));
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("fr-FR");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('purchaseOrders.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('purchaseOrders.list')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewManager
            entity="purchaseOrders"
            entityLabel="Bons de commande"
            columns={PO_COLUMNS}
            value={viewState}
            onChange={setViewState}
            defaultColumns={PO_COLUMNS.map(c => c.key)}
          />
          <Link href="/purchase-orders/new">
            <Button className="w-full sm:w-auto btn-primary">
              <Plus className="mr-2 h-4 w-4" />
              {t('purchaseOrders.new')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{purchaseOrders?.length || 0}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold">
                  {purchaseOrders?.filter(po => po.status === 'draft' || po.status === 'issued').length || 0}
                </p>
              </div>
              <FileText className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reçus</p>
                <p className="text-2xl font-bold">
                  {purchaseOrders?.filter(po => po.status === 'received').length || 0}
                </p>
              </div>
              <FileText className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Montant total</p>
                <p className="text-xl font-bold">
                  {formatCurrency(
                    purchaseOrders?.reduce((sum, po) => sum + Number(po.totalAmount), 0) || 0
                  )} XOF
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('common.filter')}</CardTitle>
          <CardDescription>Rechercher et filtrer les bons de commande</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('common.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={t('common.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="draft">{t('purchaseOrders.status.draft')}</SelectItem>
                <SelectItem value="issued">{t('purchaseOrders.status.issued')}</SelectItem>
                <SelectItem value="confirmed">{t('purchaseOrders.status.confirmed')}</SelectItem>
                <SelectItem value="partially_received">{t('purchaseOrders.status.partially_received')}</SelectItem>
                <SelectItem value="received">{t('purchaseOrders.status.received')}</SelectItem>
                <SelectItem value="closed">{t('purchaseOrders.status.closed')}</SelectItem>
                <SelectItem value="cancelled">{t('purchaseOrders.status.cancelled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>
          ) : filteredOrders && filteredOrders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('purchaseOrders.poNumber')}</TableHead>
                  <TableHead>{t('purchaseOrders.vendor')}</TableHead>
                  <TableHead>{t('purchaseOrders.orderDate')}</TableHead>
                  <TableHead>{t('purchaseOrders.expectedDelivery')}</TableHead>
                  <TableHead className="text-right">{t('purchaseOrders.totalAmount')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((po) => (
                  <TableRow key={po.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{po.poNumber}</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>{po.issuedAt ? formatDate(po.issuedAt) : formatDate(po.createdAt)}</TableCell>
                    <TableCell>{po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : '-'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(po.totalAmount)} XOF</TableCell>
                    <TableCell>
                      <span className={`status-badge status-${po.status}`}>
                        {t(`purchaseOrders.status.${po.status}`)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/purchase-orders/${po.id}`}>
                        <Button variant="ghost" size="sm">
                          {t('common.view')}
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center">
              <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">Aucun bon de commande trouvé</p>
              <Link href="/purchase-orders/new">
                <Button className="mt-4" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('purchaseOrders.create')}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
