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

    if (!scopeId || !computedFiscalPeriod || !allocatedAmount) {
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
      fiscalPeriod: computedFiscalPeriod,
      allocatedAmount: amount,
    };
    createMutation.mutate(payload);
  };

  const currentYear = new Date().getFullYear();
  // Allow any year from 2020 to currentYear + 5
  const yearRange = Array.from({ length: currentYear - 2020 + 6 }, (_, i) => 2020 + i);
  const [periodType, setPeriodType] = useState<"annual" | "quarterly" | "monthly">("annual");
  const [periodYear, setPeriodYear] = useState(String(currentYear));
  const [periodQuarter, setPeriodQuarter] = useState("1");
  const [periodMonth, setPeriodMonth] = useState("01");

  // Compute the fiscalPeriod value from the selectors
  const computedFiscalPeriod =
    periodType === "annual" ? periodYear :
    periodType === "quarterly" ? `${periodYear}-Q${periodQuarter}` :
    `${periodYear}-${periodMonth.padStart(2, "0")}`;

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
                ) : scopeType === 'category' ? (
                  <Select value={scopeId} onValueChange={setScopeId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner une catégorie" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Informatique & Technologie</SelectItem>
                      <SelectItem value="2">Fournitures de bureau</SelectItem>
                      <SelectItem value="3">Déplacements & Transport</SelectItem>
                      <SelectItem value="4">Formation & Développement</SelectItem>
                      <SelectItem value="5">Marketing & Communication</SelectItem>
                      <SelectItem value="6">Maintenance & Réparations</SelectItem>
                      <SelectItem value="7">Services professionnels</SelectItem>
                      <SelectItem value="8">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="scopeId"
                    type="number"
                    value={scopeId}
                    onChange={(e) => setScopeId(e.target.value)}
                    placeholder="Numéro du projet (ex: 101)"
                    required
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Période fiscale *</Label>
                <div className="flex gap-2">
                  <select value={periodType} onChange={e => setPeriodType(e.target.value as any)}
                    className="h-10 px-3 rounded-md border border-input bg-background text-sm flex-1">
                    <option value="annual">Annuelle</option>
                    <option value="quarterly">Trimestrielle</option>
                    <option value="monthly">Mensuelle</option>
                  </select>
                  <select value={periodYear} onChange={e => setPeriodYear(e.target.value)}
                    className="h-10 px-3 rounded-md border border-input bg-background text-sm w-24">
                    {yearRange.map(y => <option key={y} value={String(y)}>{y}</option>)}
                  </select>
                  {periodType === "quarterly" && (
                    <select value={periodQuarter} onChange={e => setPeriodQuarter(e.target.value)}
                      className="h-10 px-3 rounded-md border border-input bg-background text-sm w-28">
                      <option value="1">T1 (Jan-Mar)</option>
                      <option value="2">T2 (Avr-Jun)</option>
                      <option value="3">T3 (Jul-Sep)</option>
                      <option value="4">T4 (Oct-Déc)</option>
                    </select>
                  )}
                  {periodType === "monthly" && (
                    <select value={periodMonth} onChange={e => setPeriodMonth(e.target.value)}
                      className="h-10 px-3 rounded-md border border-input bg-background text-sm w-32">
                      {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m, i) => (
                        <option key={m} value={m}>
                          {new Date(2000, i).toLocaleDateString("fr-FR", { month: "long" })}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Valeur : <span className="font-mono font-medium">{computedFiscalPeriod}</span></p>
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
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold btn-primary text-white disabled:opacity-50"
              >
                {createMutation.isPending ? "Création en cours..." : "Créer le budget"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
