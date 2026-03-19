import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import React, { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function BudgetForm() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const [scopeType, setScopeType] = useState<"department" | "project" | "category">("department");
  const [scopeId, setScopeId] = useState("");
  const [fiscalPeriod, setFiscalPeriod] = useState("");
  const [allocatedAmount, setAllocatedAmount] = useState("");

  const { data: departments } = trpc.settings.listDepartments.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.budgets.create.useMutation({
    onSuccess: () => {
      toast.success("Budget créé avec succès");
      utils.budgets.list.invalidate();
      setLocation("/budgets");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la création du budget");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!scopeId || !fiscalPeriod || !allocatedAmount) {
      toast.error("Veuillez remplir tous les champs requis");
      return;
    }

    const amount = parseFloat(allocatedAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Le montant doit être un nombre positif");
      return;
    }

    const payload = {
      scopeType,
      scopeId: parseInt(scopeId),
      fiscalPeriod,
      allocatedAmount: amount,
    };
    createMutation.mutate(payload);
  };

  // Generate fiscal period options
  const currentYear = new Date().getFullYear();
  const fiscalPeriodOptions = [
    // Quarterly
    ...Array.from({ length: 4 }, (_, i) => ({
      value: `${currentYear}-Q${i + 1}`,
      label: `${currentYear} - Trimestre ${i + 1}`,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      value: `${currentYear + 1}-Q${i + 1}`,
      label: `${currentYear + 1} - Trimestre ${i + 1}`,
    })),
    // Monthly
    ...Array.from({ length: 12 }, (_, i) => ({
      value: `${currentYear}-${String(i + 1).padStart(2, '0')}`,
      label: `${currentYear} - ${new Date(currentYear, i).toLocaleDateString('fr-FR', { month: 'long' })}`,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/budgets")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nouveau budget</h1>
          <p className="text-muted-foreground mt-1">Créer une allocation budgétaire</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Informations du budget</CardTitle>
          <CardDescription>
            Définissez le périmètre, la période et le montant alloué
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="scopeType">Type de périmètre *</Label>
                <Select
                  value={scopeType}
                  onValueChange={(value) => {
                    setScopeType(value as any);
                    setScopeId(""); // Reset scope ID when type changes
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="department">Département</SelectItem>
                    <SelectItem value="project">Projet</SelectItem>
                    <SelectItem value="category">Catégorie</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scopeId">
                  {scopeType === 'department' && 'Département *'}
                  {scopeType === 'project' && 'Projet *'}
                  {scopeType === 'category' && 'Catégorie *'}
                </Label>
                {scopeType === 'department' && departments ? (
                  <Select value={scopeId} onValueChange={setScopeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un département" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name} ({dept.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="scopeId"
                    type="number"
                    value={scopeId}
                    onChange={(e) => setScopeId(e.target.value)}
                    placeholder={`ID du ${scopeType === 'project' ? 'projet' : 'catégorie'}`}
                    required
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fiscalPeriod">Période fiscale *</Label>
                <Select value={fiscalPeriod} onValueChange={setFiscalPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une période" />
                  </SelectTrigger>
                  <SelectContent>
                    {fiscalPeriodOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="allocatedAmount">Montant alloué (XOF) *</Label>
                <Input
                  id="allocatedAmount"
                  type="number"
                  step="0.01"
                  value={allocatedAmount}
                  onChange={(e) => setAllocatedAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">À propos des budgets</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Les budgets sont suivis en temps réel à chaque demande d'achat</li>
                <li>• Les montants engagés sont réservés dès l'approbation des demandes</li>
                <li>• Les montants réels sont comptabilisés lors de la réception des factures</li>
                <li>• Des alertes sont envoyées lorsque le budget atteint 75% et 90%</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/budgets")}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Création..." : "Créer le budget"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
