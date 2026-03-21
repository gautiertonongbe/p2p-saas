import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Plus, TrendingUp, AlertTriangle, CheckCircle2, DollarSign } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";

export default function BudgetsList() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: budgets, isLoading } = trpc.budgets.list.useQuery({});
  // Calculate summary from budgets
  const summary = budgets ? {
    totalAllocated: budgets.reduce((sum, b) => sum + parseFloat(b.allocatedAmount), 0),
    totalSpent: budgets.reduce((sum, b) => sum + parseFloat(b.actualAmount || "0") + parseFloat(b.committedAmount || "0"), 0),
    totalAvailable: budgets.reduce((sum, b) => sum + b.available, 0),
    budgetsOverThreshold: budgets.filter(b => b.utilizationPercent >= 75).length,
  } : null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-600";
    if (percentage >= 75) return "text-orange-600";
    return "text-green-600";
  };

  const getUtilizationBgColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-600";
    if (percentage >= 75) return "bg-orange-600";
    return "bg-green-600";
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: { label: "Actif", className: "bg-green-100 text-green-800" },
      exceeded: { label: "Dépassé", className: "bg-red-100 text-red-800" },
      depleted: { label: "Épuisé", className: "bg-gray-100 text-gray-800" },
    };
    const badge = badges[status as keyof typeof badges] || badges.active;
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  const filteredBudgets = budgets?.filter((budget) => {
    if (statusFilter !== "all") {
      const utilization = budget.utilizationPercent;
      if (statusFilter === "exceeded" && utilization <= 100) return false;
      if (statusFilter === "depleted" && utilization < 100) return false;
      if (statusFilter === "active" && utilization >= 100) return false;
    }
    if (typeFilter !== "all" && budget.scopeType !== typeFilter) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
<div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={<DollarSign className="h-5 w-5" />} title="Budgets" description="Contrôle budgétaire" />

        title={t('budgets.title')}
        description={t('budgets.description')}
        action={
          <button onClick={() => setLocation("/budgets/new")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-semibold transition-colors">
            <Plus className="h-4 w-4" />{t('budgets.newBudget')}
          </button>
        }
      />

      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 shadow-sm" style={{ background: "linear-gradient(135deg, #eff6ff, #dbeafe)" }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">Budget total</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">{formatCurrency(summary.totalAllocated)}</div>
              <p className="text-xs text-blue-600 mt-1">
                Tous les budgets actifs
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm" style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)" }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-700">Dépensé</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalSpent)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {((summary.totalSpent / summary.totalAllocated) * 100).toFixed(1)}% utilisé
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disponible</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalAvailable)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Solde restant
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertes</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.budgetsOverThreshold}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Budgets &gt; 75%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="exceeded">Dépassé</SelectItem>
            <SelectItem value="depleted">Épuisé</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="department">Département</SelectItem>
            <SelectItem value="project">Projet</SelectItem>
            <SelectItem value="category">Catégorie</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Budget Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredBudgets && filteredBudgets.length > 0 ? (
          filteredBudgets.map((budget) => {
            const utilizationPercentage = budget.utilizationPercent;
            const allocated = parseFloat(budget.allocatedAmount);
            const spent = parseFloat(budget.actualAmount || "0") + parseFloat(budget.committedAmount || "0");
            return (
              <Card
                key={budget.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setLocation(`/budgets/${budget.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {budget.scopeType === 'department' && `Département #${budget.scopeId}`}
                        {budget.scopeType === 'project' && `Projet #${budget.scopeId}`}
                        {budget.scopeType === 'category' && `Catégorie #${budget.scopeId}`}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {budget.scopeType === 'department' && 'Département'}
                        {budget.scopeType === 'project' && 'Projet'}
                        {budget.scopeType === 'category' && 'Catégorie'}
                        {' • '}
                        Période: {budget.fiscalPeriod}
                      </CardDescription>
                    </div>
                    {getStatusBadge(utilizationPercentage >= 100 ? 'exceeded' : utilizationPercentage >= 90 ? 'depleted' : 'active')}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progression</span>
                      <span className={`font-medium ${getUtilizationColor(utilizationPercentage)}`}>
                        {utilizationPercentage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress
                      value={Math.min(utilizationPercentage, 100)}
                      className="h-2"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Alloué</p>
                      <p className="font-medium">{formatCurrency(allocated)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Dépensé</p>
                      <p className="font-medium">{formatCurrency(spent)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Disponible</p>
                      <p className="font-medium">{formatCurrency(budget.available)}</p>
                    </div>
                  </div>

                  {utilizationPercentage >= 90 && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Budget critique - dépassement imminent</span>
                    </div>
                  )}
                  {utilizationPercentage >= 75 && utilizationPercentage < 90 && (
                    <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-2 rounded">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Attention - budget bientôt épuisé</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="col-span-2">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Aucun budget trouvé</p>
              <p className="text-sm text-muted-foreground mb-4">
                Commencez par créer votre premier budget
              </p>
              <Button onClick={() => setLocation("/budgets/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Créer un budget
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
