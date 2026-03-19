import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Bell, Mail, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface NotificationPreferences {
  emailNotifications: {
    newPurchaseRequest: boolean;
    approvalRequired: boolean;
    approvalApproved: boolean;
    approvalRejected: boolean;
    budgetThresholdExceeded: boolean;
    invoiceReceived: boolean;
    poIssued: boolean;
  };
  alertThresholds: {
    budgetWarningPercentage: number;
    budgetCriticalPercentage: number;
    approvalSlaHours: number;
  };
}

export function NotificationSettings() {
  const { data: orgSettings } = trpc.settings.getOrganization.useQuery();
  
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotifications: {
      newPurchaseRequest: true,
      approvalRequired: true,
      approvalApproved: true,
      approvalRejected: true,
      budgetThresholdExceeded: true,
      invoiceReceived: true,
      poIssued: true,
    },
    alertThresholds: {
      budgetWarningPercentage: 80,
      budgetCriticalPercentage: 95,
      approvalSlaHours: 48,
    },
  });

  const updateMutation = trpc.settings.updateOrganization.useMutation({
    onSuccess: () => {
      toast.success("Paramètres de notification mis à jour");
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleToggle = (key: keyof NotificationPreferences["emailNotifications"]) => {
    setPreferences((prev) => ({
      ...prev,
      emailNotifications: {
        ...prev.emailNotifications,
        [key]: !prev.emailNotifications[key],
      },
    }));
  };

  const handleThresholdChange = (key: keyof NotificationPreferences["alertThresholds"], value: number) => {
    setPreferences((prev) => ({
      ...prev,
      alertThresholds: {
        ...prev.alertThresholds,
        [key]: value,
      },
    }));
  };

  const handleSave = () => {
    updateMutation.mutate({
      settings: {
        ...orgSettings?.settings,
        notificationPreferences: preferences as any,
      } as any,
    });
  };

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
          <Bell className="h-6 w-6" />
          Paramètres de notification
        </h2>
        <p className="text-muted-foreground">
          Configurez les notifications par email et les seuils d'alerte pour votre organisation
        </p>
      </div>

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Notifications par email
          </CardTitle>
          <CardDescription>
            Choisissez les événements pour lesquels vous souhaitez recevoir des notifications par email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="newPurchaseRequest">Nouvelle demande d'achat</Label>
              <p className="text-sm text-muted-foreground">
                Recevoir une notification lorsqu'une nouvelle demande d'achat est créée
              </p>
            </div>
            <Switch
              id="newPurchaseRequest"
              checked={preferences.emailNotifications.newPurchaseRequest}
              onCheckedChange={() => handleToggle("newPurchaseRequest")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="approvalRequired">Approbation requise</Label>
              <p className="text-sm text-muted-foreground">
                Recevoir une notification lorsqu'une approbation est requise
              </p>
            </div>
            <Switch
              id="approvalRequired"
              checked={preferences.emailNotifications.approvalRequired}
              onCheckedChange={() => handleToggle("approvalRequired")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="approvalApproved">Demande approuvée</Label>
              <p className="text-sm text-muted-foreground">
                Recevoir une notification lorsqu'une demande est approuvée
              </p>
            </div>
            <Switch
              id="approvalApproved"
              checked={preferences.emailNotifications.approvalApproved}
              onCheckedChange={() => handleToggle("approvalApproved")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="approvalRejected">Demande rejetée</Label>
              <p className="text-sm text-muted-foreground">
                Recevoir une notification lorsqu'une demande est rejetée
              </p>
            </div>
            <Switch
              id="approvalRejected"
              checked={preferences.emailNotifications.approvalRejected}
              onCheckedChange={() => handleToggle("approvalRejected")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="budgetThresholdExceeded">Seuil budgétaire dépassé</Label>
              <p className="text-sm text-muted-foreground">
                Recevoir une notification lorsqu'un budget dépasse le seuil d'alerte
              </p>
            </div>
            <Switch
              id="budgetThresholdExceeded"
              checked={preferences.emailNotifications.budgetThresholdExceeded}
              onCheckedChange={() => handleToggle("budgetThresholdExceeded")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="invoiceReceived">Facture reçue</Label>
              <p className="text-sm text-muted-foreground">
                Recevoir une notification lorsqu'une nouvelle facture est reçue
              </p>
            </div>
            <Switch
              id="invoiceReceived"
              checked={preferences.emailNotifications.invoiceReceived}
              onCheckedChange={() => handleToggle("invoiceReceived")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="poIssued">Bon de commande émis</Label>
              <p className="text-sm text-muted-foreground">
                Recevoir une notification lorsqu'un bon de commande est émis
              </p>
            </div>
            <Switch
              id="poIssued"
              checked={preferences.emailNotifications.poIssued}
              onCheckedChange={() => handleToggle("poIssued")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Alert Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Seuils d'alerte
          </CardTitle>
          <CardDescription>
            Définissez les seuils pour déclencher des alertes automatiques
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="budgetWarning">Seuil d'avertissement budgétaire (%)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="budgetWarning"
                type="number"
                min="0"
                max="100"
                value={preferences.alertThresholds.budgetWarningPercentage}
                onChange={(e) => handleThresholdChange("budgetWarningPercentage", parseInt(e.target.value))}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">
                Alerte lorsque le budget atteint {preferences.alertThresholds.budgetWarningPercentage}% de consommation
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budgetCritical">Seuil critique budgétaire (%)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="budgetCritical"
                type="number"
                min="0"
                max="100"
                value={preferences.alertThresholds.budgetCriticalPercentage}
                onChange={(e) => handleThresholdChange("budgetCriticalPercentage", parseInt(e.target.value))}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">
                Alerte critique lorsque le budget atteint {preferences.alertThresholds.budgetCriticalPercentage}% de consommation
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="approvalSla">Délai d'approbation (heures)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="approvalSla"
                type="number"
                min="1"
                max="168"
                value={preferences.alertThresholds.approvalSlaHours}
                onChange={(e) => handleThresholdChange("approvalSlaHours", parseInt(e.target.value))}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">
                Alerte si une approbation est en attente depuis plus de {preferences.alertThresholds.approvalSlaHours} heures
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          <CheckCircle className="mr-2 h-4 w-4" />
          {updateMutation.isPending ? "Enregistrement..." : "Enregistrer les paramètres"}
        </Button>
      </div>
    </div>
  );
}
