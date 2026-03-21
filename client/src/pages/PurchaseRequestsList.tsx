import { PageHeader, HeaderAction } from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Plus, Search, FileText } from "lucide-react";
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

export default function PurchaseRequestsList() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewState, setViewState] = useState<ViewState>({
    filters: [], displayType: "table",
  });

  const PR_COLUMNS = [
    { key: "requestNumber", label: "N° demande", sortable: true },
    { key: "title", label: "Titre", filterable: true, sortable: true },
    { key: "status", label: "Statut", type: "status" as const, filterable: true,
      filterOptions: [
        { value: "draft", label: "Brouillon" }, { value: "pending_approval", label: "En attente" },
        { value: "approved", label: "Approuvé" }, { value: "rejected", label: "Rejeté" }, { value: "cancelled", label: "Annulé" },
      ]},
    { key: "urgencyLevel", label: "Urgence", type: "status" as const, filterable: true,
      filterOptions: [{ value: "low", label: "Faible" }, { value: "medium", label: "Moyen" }, { value: "high", label: "Élevé" }, { value: "critical", label: "Critique" }]},
    { key: "amountEstimate", label: "Montant estimé", type: "amount" as const, sortable: true },
    { key: "createdAt", label: "Date création", type: "date" as const, sortable: true },
  ];

  // Apply view filters on top of existing status filter
  const activeViewFilters = viewState.filters;

  const { data: requests, isLoading } = trpc.purchaseRequests.list.useQuery();

  const filteredRequests = requests?.filter((req) => {
    const matchesSearch =
      req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.requestNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || req.status === statusFilter;

    // Apply view manager filters
    const matchesViewFilters = activeViewFilters.every(f => {
      const val = (req as any)[f.field];
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
    return new Intl.NumberFormat('fr-FR').format(Number(amount));
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fr-FR');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<FileText className="h-5 w-5" />}
        title={t('purchaseRequests.title')}
        description={t('purchaseRequests.list')}
        action={
          <Link href="/purchase-requests/new">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold btn-primary">
              <Plus className="h-4 w-4" />{t('purchaseRequests.new')}
            </button>
          </Link>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('purchaseRequests.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('purchaseRequests.list')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewManager
            entity="purchaseRequests"
            entityLabel="Demandes d'achat"
            columns={PR_COLUMNS}
            value={viewState}
            onChange={setViewState}
            defaultColumns={PR_COLUMNS.map(c => c.key)}
          />
          <Link href="/purchase-requests/new">
            <Button className="w-full sm:w-auto btn-primary">
              <Plus className="mr-2 h-4 w-4" />
              {t('purchaseRequests.new')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('common.filter')}</CardTitle>
          <CardDescription>Rechercher et filtrer les demandes d'achat</CardDescription>
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
                <SelectItem value="draft">{t('purchaseRequests.status.draft')}</SelectItem>
                <SelectItem value="pending_approval">{t('purchaseRequests.status.pending_approval')}</SelectItem>
                <SelectItem value="approved">{t('purchaseRequests.status.approved')}</SelectItem>
                <SelectItem value="rejected">{t('purchaseRequests.status.rejected')}</SelectItem>
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
          ) : filteredRequests && filteredRequests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('purchaseRequests.requestNumber')}</TableHead>
                  <TableHead>{t('purchaseRequests.requestTitle')}</TableHead>
                  <TableHead>{t('purchaseRequests.requester')}</TableHead>
                  <TableHead>{t('purchaseRequests.estimatedAmount')}</TableHead>
                  <TableHead>{t('purchaseRequests.urgencyLevel')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{request.requestNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {request.title}
                      </div>
                    </TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>{formatCurrency(request.amountEstimate)} XOF</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        request.urgencyLevel === 'critical' ? 'bg-red-100 text-red-800' :
                        request.urgencyLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                        request.urgencyLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {t(`purchaseRequests.urgency.${request.urgencyLevel}`)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`status-badge status-${request.status}`}>
                        {t(`purchaseRequests.status.${request.status}`)}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(request.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/purchase-requests/${request.id}`}>
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
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">Aucune demande trouvée</p>
              <Link href="/purchase-requests/new">
                <Button className="mt-4" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('purchaseRequests.create')}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
