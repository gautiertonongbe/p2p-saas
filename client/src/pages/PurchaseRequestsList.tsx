import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ActionMenu } from "@/components/ActionMenu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Plus, Search, FileText, Eye, ChevronRight, Copy, Send, CheckCircle, Edit2, ShoppingCart, XCircle} from "lucide-react";
import { toast } from "sonner";
import { SortToggle } from "@/components/SortToggle";
import { ViewManager, ViewState } from "@/components/ViewManager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PurchaseRequestsList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const canManage = user?.role === "admin" || user?.role === "procurement_manager";

  const submitMut = trpc.purchaseRequests.submit.useMutation({
    onSuccess: () => { toast.success("Demande soumise"); utils.purchaseRequests.list.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const cancelMut2 = trpc.purchaseRequests.cancel.useMutation({
    onSuccess: () => { toast.success("Demande annulée"); utils.purchaseRequests.list.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const isApprover = user?.role === "approver";
  const [statusFilter, setStatusFilter] = useState<string>(isApprover ? "submitted" : "all");
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

  const sortedItems = useMemo(() => {
    return [...(filteredRequests || [])].sort((a: any, b: any) => {
      const aDate = new Date(a.createdAt || a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || b.createdAt || 0).getTime();
      return sortDir === "desc" ? bDate - aDate : aDate - bDate;
    });
  }, [filteredRequests, sortDir]);

  return (
    <div className="space-y-6">
      <PageHeader icon={<FileText className="h-5 w-5" />} title={t("purchaseRequests.title")} description={t("purchaseRequests.list")} />

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
          <SortToggle value={sortDir} onChange={setSortDir} />
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
                {sortedItems.map((request) => (
                  <TableRow key={request.id} className="cursor-pointer hover:bg-muted/50 group">
                    <TableCell className="font-medium">{request.requestNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {request.title}
                      </div>
                    </TableCell>
                    <TableCell>{(request as any).requesterName || <span className="text-muted-foreground text-xs">—</span>}</TableCell>
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
                      {(() => {
                        const STATUS_LABELS: Record<string, { label: string; color: string }> = {
                          draft:           { label: "Brouillon",      color: "bg-gray-100 text-gray-700" },
                          submitted:       { label: "Soumis",         color: "bg-blue-100 text-blue-700" },
                          pending_approval:{ label: "En approbation", color: "bg-amber-100 text-amber-700" },
                          approved:        { label: "Approuvé",       color: "bg-emerald-100 text-emerald-700" },
                          rejected:        { label: "Refusé",         color: "bg-red-100 text-red-700" },
                          cancelled:       { label: "Annulé",         color: "bg-gray-100 text-gray-500" },
                          converted_to_po: { label: "Converti BC",    color: "bg-purple-100 text-purple-700" },
                        };
                        const s = STATUS_LABELS[request.status] || { label: request.status, color: "bg-gray-100 text-gray-600" };
                        return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${s.color}`}>{s.label}</span>;
                      })()}
                    </TableCell>
                    <TableCell>{formatDate(request.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <ActionMenu actions={[
                        { icon: <Eye className="h-4 w-4" />, label: "Voir le détail", href: `/purchase-requests/${request.id}/edit` },
                        { icon: <Edit2 className="h-4 w-4" />, label: "Modifier", href: `/purchase-requests/${request.id}/edit`, hidden: request.status !== "draft" || !canManage },
                        { icon: <Send className="h-4 w-4" />, label: "Soumettre pour approbation", hidden: request.status !== "draft", variant: "success", onClick: (e) => { e.stopPropagation(); submitMut.mutate({ id: request.id }); } },
                        { icon: <ShoppingCart className="h-4 w-4" />, label: "Créer un bon de commande", href: `/purchase-orders/new?requestId=${request.id}`, hidden: request.status !== "approved", variant: "success" },
                        { icon: <Copy className="h-4 w-4" />, label: "Dupliquer", href: `/purchase-requests/new?copyFrom=${request.id}`, hidden: !canManage },
                        { icon: <XCircle className="h-4 w-4" />, label: "Annuler la demande", hidden: !["draft","submitted"].includes(request.status) || !canManage, variant: "danger", onClick: (e) => { e.stopPropagation(); const reason = prompt("Motif d'annulation :"); if (reason !== null) cancelMut2.mutate({ id: request.id, reason: reason || "Annulé" }); } },
                      ]} />
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
