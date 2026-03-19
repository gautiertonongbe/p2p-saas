import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Plus, Trash2, Save, Send } from "lucide-react";
import { toast } from "sonner";

type PurchaseRequestItem = {
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export default function PurchaseRequestForm() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgencyLevel, setUrgencyLevel] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [justification, setJustification] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [costCenterId, setCostCenterId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [billingStringId, setBillingStringId] = useState<string>("");
  const [items, setItems] = useState<PurchaseRequestItem[]>([
    { itemName: "", description: "", quantity: 1, unit: "pcs", unitPrice: 0 }
  ]);

  const createMutation = trpc.purchaseRequests.create.useMutation({
    onSuccess: () => {
      toast.success(t('success.created'));
      utils.purchaseRequests.list.invalidate();
      setLocation("/purchase-requests");
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const updateMutation = trpc.purchaseRequests.update.useMutation({
    onSuccess: () => {
      toast.success(t('success.submitted'));
      utils.purchaseRequests.list.invalidate();
      setLocation("/purchase-requests");
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const submitMutation = trpc.purchaseRequests.submit.useMutation({
    onSuccess: () => {
      toast.success("Demande soumise pour approbation");
      utils.purchaseRequests.list.invalidate();
      utils.purchaseRequests.getMyRequests.invalidate();
      setLocation("/purchase-requests");
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  // Load reference data from org settings
  const { data: departments = [] } = trpc.settings.listDepartments.useQuery();
  const { data: lookupTypes = [] } = trpc.settings.getLookupTypes.useQuery();

  const categoryTypeId = (lookupTypes as any[]).find((t: any) => t.name === "ExpenseCategory")?.id;
  const costCenterTypeId = (lookupTypes as any[]).find((t: any) => t.name === "CostCenter")?.id;
  const projectTypeId = (lookupTypes as any[]).find((t: any) => t.name === "Project")?.id;
  const billingTypeId = (lookupTypes as any[]).find((t: any) => t.name === "BillingString")?.id;

  const { data: categories = [] } = trpc.settings.getLookupValues.useQuery(
    { lookupTypeId: categoryTypeId! }, { enabled: !!categoryTypeId }
  );
  const { data: costCenters = [] } = trpc.settings.getLookupValues.useQuery(
    { lookupTypeId: costCenterTypeId! }, { enabled: !!costCenterTypeId }
  );
  const { data: projects = [] } = trpc.settings.getLookupValues.useQuery(
    { lookupTypeId: projectTypeId! }, { enabled: !!projectTypeId }
  );
  const { data: billingStrings = [] } = trpc.settings.getLookupValues.useQuery(
    { lookupTypeId: billingTypeId! }, { enabled: !!billingTypeId }
  );

  const addItem = () => {
    setItems([...items, { itemName: "", description: "", quantity: 1, unit: "pcs", unitPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PurchaseRequestItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const validateForm = () => {
    if (!title.trim()) {
      toast.error(t('errors.requiredField') + ": titre");
      return false;
    }
    const validItems = items.filter(item => item.itemName.trim() !== "");
    if (validItems.length === 0) {
      toast.error("Veuillez ajouter au moins un article");
      return false;
    }
    for (const item of validItems) {
      if (item.unitPrice <= 0) {
        toast.error(`Article "${item.itemName}": le prix unitaire doit être supérieur à 0`);
        return false;
      }
      if (item.quantity <= 0) {
        toast.error(`Article "${item.itemName}": la quantité doit être supérieure à 0`);
        return false;
      }
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      toast.error(t('errors.requiredField'));
      return;
    }
    await createMutation.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      urgencyLevel,
      amountEstimate: calculateTotal() || 1,
      departmentId: departmentId ? parseInt(departmentId) : undefined,
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      costCenterId: costCenterId ? parseInt(costCenterId) : undefined,
      projectId: projectId ? parseInt(projectId) : undefined,
      billingStringId: billingStringId ? parseInt(billingStringId) : undefined,
      items: items.filter(item => item.itemName.trim() !== ""),
    });
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Create draft first, then submit through the proper approval-chain endpoint
    const result = await createMutation.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      urgencyLevel,
      amountEstimate: calculateTotal(),
      departmentId: departmentId ? parseInt(departmentId) : undefined,
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      costCenterId: costCenterId ? parseInt(costCenterId) : undefined,
      projectId: projectId ? parseInt(projectId) : undefined,
      billingStringId: billingStringId ? parseInt(billingStringId) : undefined,
      items: items.filter(item => item.itemName.trim() !== ""),
    });

    if (result?.id) {
      await submitMutation.mutateAsync({ id: result.id });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('purchaseRequests.new')}</h1>
        <p className="text-muted-foreground mt-2">Créer une nouvelle demande d'achat</p>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
          <CardDescription>Détails de base de la demande</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t('purchaseRequests.requestTitle')} *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Fournitures de bureau pour Q1 2026"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('common.description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description détaillée de la demande"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="urgency">{t('purchaseRequests.urgencyLevel')}</Label>
              <Select value={urgencyLevel} onValueChange={(value: any) => setUrgencyLevel(value)}>
                <SelectTrigger id="urgency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('purchaseRequests.urgency.low')}</SelectItem>
                  <SelectItem value="medium">{t('purchaseRequests.urgency.medium')}</SelectItem>
                  <SelectItem value="high">{t('purchaseRequests.urgency.high')}</SelectItem>
                  <SelectItem value="critical">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryDate">{t('purchaseRequests.deliveryDate')}</Label>
              <Input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="justification">{t('purchaseRequests.justification')}</Label>
            <Textarea
              id="justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Justification de la demande"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Cost Allocation */}
      <Card>
        <CardHeader>
          <CardTitle>Imputation comptable</CardTitle>
          <CardDescription>Département, catégorie de dépense et centre de coût</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Department */}
          <div className="space-y-2">
            <Label>Département</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Aucun —</SelectItem>
                {(departments as any[]).filter((d: any) => d.isActive !== false).map((d: any) => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expense Category */}
          {(categories as any[]).length > 0 && (
            <div className="space-y-2">
              <Label>Catégorie de dépense</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Aucune —</SelectItem>
                  {(categories as any[]).filter((c: any) => c.isActive).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Cost Center */}
          {(costCenters as any[]).length > 0 && (
            <div className="space-y-2">
              <Label>Centre de coût</Label>
              <Select value={costCenterId} onValueChange={setCostCenterId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Aucun —</SelectItem>
                  {(costCenters as any[]).filter((c: any) => c.isActive).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Project */}
          {(projects as any[]).length > 0 && (
            <div className="space-y-2">
              <Label>Projet</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Aucun —</SelectItem>
                  {(projects as any[]).filter((p: any) => p.isActive).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Billing String */}
          {(billingStrings as any[]).length > 0 && (
            <div className="space-y-2">
              <Label>Code de facturation</Label>
              <Select value={billingStringId} onValueChange={setBillingStringId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Aucun —</SelectItem>
                  {(billingStrings as any[]).filter((b: any) => b.isActive).map((b: any) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('purchaseRequests.items')}</CardTitle>
              <CardDescription>Articles demandés</CardDescription>
            </div>
            <Button onClick={addItem} variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {t('purchaseRequests.addItem')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-start justify-between">
                <h4 className="font-medium">Article {index + 1}</h4>
                {items.length > 1 && (
                  <Button
                    onClick={() => removeItem(index)}
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('purchaseRequests.itemName')} *</Label>
                  <Input
                    value={item.itemName}
                    onChange={(e) => updateItem(index, 'itemName', e.target.value)}
                    placeholder="Nom de l'article"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('purchaseRequests.unit')}</Label>
                  <Input
                    value={item.unit}
                    onChange={(e) => updateItem(index, 'unit', e.target.value)}
                    placeholder="pcs, kg, m, etc."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('common.description')}</Label>
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  placeholder="Description de l'article"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>{t('purchaseRequests.quantity')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('purchaseRequests.unitPrice')}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('purchaseRequests.lineTotal')}</Label>
                  <div className="h-10 flex items-center px-3 border rounded-md bg-muted">
                    {formatCurrency(item.quantity * item.unitPrice)} XOF
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-4 border-t">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{t('common.total')}</p>
              <p className="text-2xl font-bold">{formatCurrency(calculateTotal())} XOF</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={() => setLocation("/purchase-requests")}
          className="w-full sm:w-auto"
        >
          {t('common.cancel')}
        </Button>
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          disabled={createMutation.isPending || submitMutation.isPending}
          className="w-full sm:w-auto"
        >
          <Save className="mr-2 h-4 w-4" />
          {t('purchaseRequests.saveDraft')}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={createMutation.isPending || submitMutation.isPending}
          className="w-full sm:w-auto"
        >
          <Send className="mr-2 h-4 w-4" />
          {createMutation.isPending || submitMutation.isPending
            ? "Soumission en cours..."
            : t('purchaseRequests.submitForApproval')}
        </Button>
      </div>
    </div>
  );
}
