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
import { useState, useEffect } from "react";
import { toast } from "sonner";

export function OrganizationSettings() {
  const { t } = useTranslation();
  const { data: organization, isLoading } = trpc.settings.getOrganization.useQuery();
  const utils = trpc.useUtils();

  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [country, setCountry] = useState("");
  const [fiscalYearStart, setFiscalYearStart] = useState("");

  useEffect(() => {
    if (organization) {
      setLegalName(organization.legalName);
      setTradeName(organization.tradeName || "");
      setCountry(organization.country);
      setFiscalYearStart(organization.fiscalYearStart || "01-01");
    }
  }, [organization]);

  const updateMutation = trpc.settings.updateOrganization.useMutation({
    onSuccess: () => {
      toast.success("Paramètres de l'organisation mis à jour");
      utils.settings.getOrganization.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      legalName,
      tradeName: tradeName || undefined,
      country: country as "Benin" | "Côte d'Ivoire",
      fiscalYearStart,
    });
  };

  if (isLoading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  if (!organization) {
    return <div className="text-center py-8">Organisation non trouvée</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.organization.title')}</CardTitle>
        <CardDescription>{t('settings.organization.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legalName">Raison sociale *</Label>
              <Input
                id="legalName"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tradeName">Nom commercial</Label>
              <Input
                id="tradeName"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Pays *</Label>
              <Select
                value={country}
                onValueChange={setCountry}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un pays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Benin">Bénin</SelectItem>
                  <SelectItem value="Côte d'Ivoire">Côte d'Ivoire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fiscalYearStart">Début d'exercice fiscal (MM-JJ)</Label>
              <Input
                id="fiscalYearStart"
                value={fiscalYearStart}
                onChange={(e) => setFiscalYearStart(e.target.value)}
                placeholder="01-01"
                pattern="\d{2}-\d{2}"
              />
            </div>

            <div className="space-y-2">
              <Label>Devise de base</Label>
              <Input
                value={organization.baseCurrency}
                disabled
                className="bg-muted"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
