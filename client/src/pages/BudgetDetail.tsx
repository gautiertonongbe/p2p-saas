import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, TrendingUp, DollarSign, AlertTriangle, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React, { useState } from "react";
import { toast } from "sonner";

export default function BudgetDetail() {
  const { t } = useTranslation();
  const params = useParams();
  const [, setLocation] = useLocation();
  const budgetId = parseInt(params.id || "0");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newAllocatedAmount, setNewAllocatedAmount] = useState("");

  const { data: budget, isLoading } = trpc.budgets.getById.useQuery({ id: budgetId });
  const utils = trpc.useUtils();

  const updateMutation = trpc.budgets.update.useMutation({
    onSuccess: () => {
      toast.success("Budget mis à jour");
      utils.budgets.getById.invalidate({ id: budgetId });
      utils.budgets.list.invalidate();
      setEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleEdit = () => {
    if (budget) {
      setNewAllocatedAmount(budget.allocatedAmount);
      setEditDialogOpen(true);
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newAllocatedAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Le montant doit être un nombre positif");
      return;
    }

    updateMutation.mutate({
      id: budgetId,
      allocatedAmount: amount,
    });
  };

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

  if (!budget) {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-medium mb-2">Budget non trouvé</p>
        <Button onClick={() => setLocation("/budgets")}>
          Retour aux budgets
        </Button>
      </div>
    );
  }

  const allocated = parseFloat(budget.allocatedAmount);
  const committed = parseFloat(budget.committedAmount || "0");
  const actual = parseFloat(budget.actualAmount || "0");
  const spent = committed + actual;
  const available = allocated - spent;
  const utilizationPercentage = allocated > 0 ? (spent / allocated) * 100 : 0;

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-600";
    if (percentage >= 75) return "text-orange-600";
    return "text-green-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/budgets")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {budget.scopeType === 'department' && `Département #${budget.scopeId}`}
              {budget.scopeType === 'project' && `Projet #${budget.scopeId}`}
              {budget.scopeType === 'category' && `Catégorie #${budget.scopeId}`}
            </h1>
            <p className="text-muted-foreground mt-1">
              Période: {budget.fiscalPeriod}
            </p>
          </div>
        </div>
        <Button onClick={handleEdit}>
          <Edit className="mr-2 h-4 w-4" />
          Modifier le budget
        </Button>
      </div>

      {/* Alert Banner */}
      {utilizationPercentage >= 90 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <div className="flex-1">
            <p className="font-medium text-red-900">Budget critique</p>
            <p className="text-sm text-red-700">
              Le budget a atteint {utilizationPercentage.toFixed(1)}% de son allocation. Dépassement imminent.
            </p>
          </div>
        </div>
      )}
      {utilizationPercentage >= 75 && utilizationPercentage < 90 && (
        <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-lg p-4">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <div className="flex-1">
            <p className="font-medium text-orange-900">Attention</p>
            <p className="text-sm text-orange-700">
              Le budget a atteint {utilizationPercentage.toFixed(1)}% de son allocation.
            </p>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alloué</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(allocated)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Budget total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagé</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(committed)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Demandes approuvées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Réalisé</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(actual)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Factures reçues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponible</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(available)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Solde restant
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Utilization Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Utilisation du budget</CardTitle>
          <CardDescription>
            Suivi en temps réel de la consommation budgétaire
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progression globale</span>
              <span className={`text-sm font-medium ${getUtilizationColor(utilizationPercentage)}`}>
                {utilizationPercentage.toFixed(1)}%
              </span>
            </div>
            <Progress value={Math.min(utilizationPercentage, 100)} className="h-3" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Montant engagé</span>
                <span className="text-sm font-medium">{((committed / allocated) * 100).toFixed(1)}%</span>
              </div>
              <Progress value={Math.min((committed / allocated) * 100, 100)} className="h-2" />
              <p className="text-xs text-muted-foreground">{formatCurrency(committed)} sur {formatCurrency(allocated)}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Montant réalisé</span>
                <span className="text-sm font-medium">{((actual / allocated) * 100).toFixed(1)}%</span>
              </div>
              <Progress value={Math.min((actual / allocated) * 100, 100)} className="h-2" />
              <p className="text-xs text-muted-foreground">{formatCurrency(actual)} sur {formatCurrency(allocated)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Répartition du budget</CardTitle>
          <CardDescription>
            Détail des montants alloués, engagés et disponibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium">Budget alloué</p>
                <p className="text-sm text-muted-foreground">Montant total autorisé</p>
              </div>
              <p className="text-lg font-bold">{formatCurrency(allocated)}</p>
            </div>

            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium">Montant engagé</p>
                <p className="text-sm text-muted-foreground">Demandes d'achat approuvées</p>
              </div>
              <p className="text-lg font-bold text-blue-600">-{formatCurrency(committed)}</p>
            </div>

            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium">Montant réalisé</p>
                <p className="text-sm text-muted-foreground">Factures reçues et validées</p>
              </div>
              <p className="text-lg font-bold text-purple-600">-{formatCurrency(actual)}</p>
            </div>

            <div className="flex items-center justify-between py-3 bg-green-50 rounded-lg px-4">
              <div>
                <p className="font-medium text-green-900">Solde disponible</p>
                <p className="text-sm text-green-700">Montant restant pour nouvelles demandes</p>
              </div>
              <p className="text-xl font-bold text-green-600">{formatCurrency(available)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le budget</DialogTitle>
            <DialogDescription>
              Ajuster le montant alloué pour cette période
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="allocatedAmount">Nouveau montant alloué (XOF) *</Label>
              <Input
                id="allocatedAmount"
                type="number"
                step="0.01"
                value={newAllocatedAmount}
                onChange={(e) => setNewAllocatedAmount(e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                Montant actuel: {formatCurrency(allocated)}
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Attention:</strong> La modification du budget n'affecte pas les engagements existants.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
