import { useState, useMemo } from "react";
import { ActionMenu } from "@/components/ActionMenu";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { Plus, Search, Users, Building2, Eye, Edit2, ChevronRight, XCircle, ShieldCheck, UserCheck} from "lucide-react";
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

export default function VendorsList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "procurement_manager";
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewState, setViewState] = useState<ViewState>({ filters: [], displayType: "table" });

  const VENDOR_COLUMNS = [
    { key: "legalName", label: "Raison sociale", sortable: true, filterable: true },
    { key: "status", label: "Statut", type: "status" as const, filterable: true,
      filterOptions: [{ value: "active", label: "Actif" }, { value: "pending", label: "En attente" }, { value: "inactive", label: "Inactif" }]},
    { key: "country", label: "Pays", filterable: true },
    { key: "contactEmail", label: "Email", filterable: true },
    { key: "performanceScore", label: "Score", type: "number" as const, sortable: true },
    { key: "createdAt", label: "Date création", type: "date" as const, sortable: true },
  ];

  const { data: vendors, isLoading } = trpc.vendors.list.useQuery();

  const filteredVendors = vendors?.filter((vendor) => {
    const matchesSearch =
      vendor.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (vendor.tradeName?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || vendor.status === statusFilter;
    const matchesViewFilters = viewState.filters.every(f => {
      const val = (vendor as any)[f.field];
      switch (f.operator) {
        case "eq": return String(val) === f.value;
        case "ne": return String(val) !== f.value;
        case "contains": return String(val).toLowerCase().includes(f.value.toLowerCase());
        default: return true;
      }
    });
    return matchesSearch && matchesStatus && matchesViewFilters;
  });

  const sortedItems = useMemo(() => {
    return [...(filteredVendors || [])].sort((a: any, b: any) => {
      const aDate = new Date(a.createdAt || a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || b.createdAt || 0).getTime();
      return sortDir === "desc" ? bDate - aDate : aDate - bDate;
    });
  }, [filteredVendors, sortDir]);

  return (
    <div className="space-y-6">
      <PageHeader icon={<Users className="h-5 w-5" />} title={t("vendors.title")} description={t("vendors.description")} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('vendors.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('vendors.list')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewManager
            entity="vendors"
            entityLabel="Fournisseurs"
            columns={VENDOR_COLUMNS}
            value={viewState}
            onChange={setViewState}
            defaultColumns={VENDOR_COLUMNS.map(c => c.key)}
          />
          <SortToggle value={sortDir} onChange={setSortDir} />
          {canManage && <Link href="/vendors/new">
            <Button className="w-full sm:w-auto btn-primary">
              <Plus className="mr-2 h-4 w-4" />
              {t('vendors.new')}
            </Button>
          </Link>}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('common.filter')}</CardTitle>
          <CardDescription>Rechercher et filtrer les fournisseurs</CardDescription>
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
                <SelectItem value="active">{t('vendors.status.active')}</SelectItem>
                <SelectItem value="inactive">{t('vendors.status.inactive')}</SelectItem>
                <SelectItem value="pending_approval">{t('vendors.status.pending_approval')}</SelectItem>
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
          ) : filteredVendors && filteredVendors.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('vendors.vendorCode')}</TableHead>
                  <TableHead>{t('vendors.legalName')}</TableHead>
                  <TableHead>{t('vendors.category')}</TableHead>
                  <TableHead>{t('vendors.contactPerson')}</TableHead>
                  <TableHead>{t('vendors.email')}</TableHead>
                  <TableHead>{t('vendors.paymentMethod')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.map((vendor) => (
                  <TableRow key={vendor.id} className="cursor-pointer hover:bg-muted/50 group">
                    <TableCell className="font-medium">V-{vendor.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{vendor.legalName}</div>
                          {vendor.tradeName && (
                            <div className="text-xs text-muted-foreground">{vendor.tradeName}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>{vendor.contactName || '-'}</TableCell>
                    <TableCell>{vendor.contactEmail || '-'}</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>
                      <span className={`status-badge status-${vendor.status}`}>
                        {t(`vendors.status.${vendor.status}`)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionMenu actions={[
                        { icon: <Eye className="h-4 w-4" />, label: "Voir le profil", href: `/vendors/${vendor.id}` },
                        { icon: <Edit2 className="h-4 w-4" />, label: "Modifier", href: `/vendors/${vendor.id}`, hidden: !canManage },
                        { icon: <ShieldCheck className="h-4 w-4" />, label: "Evaluer le risque", href: `/vendors/${vendor.id}`, hidden: !canManage, variant: "warning" },
                        { icon: <UserCheck className="h-4 w-4" />, label: "Qualifier le fournisseur", href: `/vendor-onboarding?vendorId=${vendor.id}`, hidden: !canManage, variant: "success" },
                        { icon: <XCircle className="h-4 w-4" />, label: vendor.status === "inactive" ? "Réactiver" : "Désactiver", hidden: !canManage, variant: "danger", onClick: (e) => { e.stopPropagation(); window.location.href = `/vendors/${vendor.id}`; } },
                      ]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">Aucun fournisseur trouvé</p>
              <Link href="/vendors/new">
                <Button className="mt-4" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('vendors.create')}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
