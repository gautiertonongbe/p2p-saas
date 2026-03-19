import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export function ToleranceRules() {
  const { t } = useTranslation();
  const { data: rules, isLoading } = trpc.settings.getToleranceRules.useQuery();
  const utils = trpc.useUtils();

  const [priceVariance, setPriceVariance] = useState("5");
  const [quantityVariance, setQuantityVariance] = useState("2");
  const [amountVariance, setAmountVariance] = useState("5");

  useEffect(() => {
    if (rules) {
      setPriceVariance(rules.priceVariance?.toString() || "5");
      setQuantityVariance(rules.quantityVariance?.toString() || "2");
      setAmountVariance(rules.amountVariance?.toString() || "5");
    }
  }, [rules]);

  const updateMutation = trpc.settings.updateToleranceRules.useMutation({
    onSuccess: () => {
      toast.success("Règles de tolérance mises à jour");
      utils.settings.getToleranceRules.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      priceVariance: parseFloat(priceVariance),
      quantityVariance: parseFloat(quantityVariance),
      amountVariance: parseFloat(amountVariance),
    });
  };

  if (isLoading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.tolerance.title')}</CardTitle>
        <CardDescription>{t('settings.tolerance.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="priceVariance">Tolérance de prix (%)</Label>
              <Input
                id="priceVariance"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={priceVariance}
                onChange={(e) => setPriceVariance(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Écart de prix acceptable entre le bon de commande et la facture
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantityVariance">Tolérance de quantité (%)</Label>
              <Input
                id="quantityVariance"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={quantityVariance}
                onChange={(e) => setQuantityVariance(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Écart de quantité acceptable entre le bon de commande et la réception
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amountVariance">Tolérance de montant (%)</Label>
              <Input
                id="amountVariance"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={amountVariance}
                onChange={(e) => setAmountVariance(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Écart de montant total acceptable pour la correspondance à trois voies
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">À propos des règles de tolérance</h4>
            <p className="text-sm text-blue-800">
              Ces règles définissent les écarts acceptables lors de la correspondance à trois voies (bon de commande, réception, facture). 
              Les écarts dépassant ces seuils nécessiteront une approbation manuelle.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
