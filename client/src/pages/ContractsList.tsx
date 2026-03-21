import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Search, AlertTriangle, CheckCircle, Clock, XCircle, Calendar, DollarSign, Building } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  service: "Service", supply: "Fourniture", maintenance: "Maintenance",
  lease: "Location", consulting: "Conseil", other: "Autre",
};

function StatusBadge({ status, days }: { status: string; days: number }) {
  if (status === "expired") return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />Expiré</Badge>;
  if (status === "expiring_soon") return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><AlertTriangle className="h-3 w-3 mr-1" />Expire dans {days}j</Badge>;
  if (status === "active") return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle className="h-3 w-3 mr-1" />Actif</Badge>;
  if (status === "draft") return <Badge className="bg-gray-100 text-gray-700">Brouillon</Badge>;
  if (status === "terminated") return <Badge className="bg-red-100 text-red-700">Résilié</Badge>;
  return <Badge>{status}</Badge>;
}

export default function ContractsList() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const { data: contracts = [], isLoading } = trpc.contracts.list.useQuery();
  const { data: stats } = trpc.contracts.getStats.useQuery();

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  const filtered = (contracts as any[]).filter((c: any) => {
    const matchSearch = !search || c.title?.toLowerCase().includes(search.toLowerCase()) || c.vendorName?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || c.computedStatus === filter;
    return matchSearch && matchFilter;
  });

  const FILTERS = [
    { id: "all", label: "Tous" },
    { id: "active", label: "Actifs" },
    { id: "expiring_soon", label: "Expirent bientôt" },
    { id: "expired", label: "Expirés" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Contrats"
        description="Gérez vos contrats fournisseurs et suivez les renouvellements"
        action={{ label: "Nouveau contrat", onClick: () => setLocation("/contracts/new") }}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Contrats actifs", value: (stats as any)?.active || 0, icon: CheckCircle, color: "emerald" },
          { label: "Expirent bientôt", value: (stats as any)?.expiringSoon || 0, icon: AlertTriangle, color: "amber" },
          { label: "Expirés", value: (stats as any)?.expired || 0, icon: XCircle, color: "red" },
          { label: "Valeur totale", value: `${fmt((stats as any)?.totalValue || 0)} XOF`, icon: DollarSign, color: "blue" },
        ].map(({ label, value, icon: Icon, color }) => {
          const colors: Record<string, string> = { emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", red: "bg-red-50 text-red-600", blue: "bg-blue-50 text-blue-600" };
          const textColors: Record<string, string> = { emerald: "text-emerald-700", amber: "text-amber-700", red: "text-red-700", blue: "text-blue-700" };
          return (
            <Card key={label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
                    <Icon className="h-4.5 w-4.5" style={{width:18,height:18}} />
                  </div>
                  <div>
                    <p className={`text-xl font-bold ${textColors[color]}`}>{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters & Search */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un contrat ou fournisseur..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f.id ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <Button onClick={() => setLocation("/contracts/new")} className="btn-primary text-white">
          <Plus className="mr-2 h-4 w-4" />Nouveau contrat
        </Button>
      </div>

      {/* Contracts list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">Aucun contrat trouvé</p>
            <p className="text-sm text-muted-foreground mt-1">Créez votre premier contrat fournisseur</p>
            <Button className="mt-4 btn-primary text-white" onClick={() => setLocation("/contracts/new")}>
              <Plus className="mr-2 h-4 w-4" />Créer un contrat
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((contract: any) => (
            <div key={contract.id} onClick={() => setLocation(`/contracts/${contract.id}`)}
              className="bg-card border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <FileText className="h-4.5 w-4.5 text-blue-600" style={{width:18,height:18}} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate group-hover:text-blue-700 transition-colors">{contract.title}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building className="h-3 w-3" />{contract.vendorName || "—"}
                      </span>
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {TYPE_LABELS[contract.contractType] || contract.contractType}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(contract.startDate).toLocaleDateString("fr-FR")} → {new Date(contract.endDate).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {contract.value && (
                    <span className="text-sm font-semibold text-muted-foreground">{fmt(contract.value)} XOF</span>
                  )}
                  <StatusBadge status={contract.computedStatus} days={contract.daysUntilExpiry} />
                  {contract.autoRenew && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">Auto-renouv.</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
