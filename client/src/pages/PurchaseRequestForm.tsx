import { trpc } from "@/lib/trpc";
import { PriceBenchmark } from "@/components/PriceBenchmark";
import CodingWidget, { type CodingValues } from "@/components/CodingWidget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation, useParams, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Send, ArrowLeft, Package, FileText, Copy } from "lucide-react";
import { toast } from "sonner";

type Item = { itemName: string; description: string; quantity: string; unit: string; unitPrice: string };

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function parseNum(s: string) {
  return parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0;
}

const UNITS = ["pcs", "kg", "g", "L", "mL", "m", "cm", "m²", "m³", "boîte", "carton", "palette", "lot", "heure", "jour", "mois"];

export default function PurchaseRequestForm() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const searchString = useSearch();
  const urlParams = searchString ? new URLSearchParams(searchString) : null;
  const editId = params?.id ? parseInt(params.id) : null;
  const copyFromId = urlParams?.get("copyFrom") ? parseInt(urlParams.get("copyFrom")!) : null;
  const sourceId = editId || copyFromId;
  const isEdit = !!editId;
  const isCopy = !!copyFromId;
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgencyLevel, setUrgencyLevel] = useState<"low"|"medium"|"high"|"critical">("medium");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [justification, setJustification] = useState("");
  const [justificationError, setJustificationError] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [billingStringId, setBillingStringId] = useState("");
  const [coding, setCoding] = useState<CodingValues>({});

  const [items, setItems] = useState<Item[]>([
    { itemName: "", description: "", quantity: "1", unit: "pcs", unitPrice: "" }
  ]);

  const { data: departments = [] } = trpc.settings.listDepartments.useQuery();

  // Load existing data for edit or copy
  const { data: existingRequest } = trpc.purchaseRequests.getById.useQuery(
    { id: sourceId! }, { enabled: !!sourceId }
  );
  const { data: existingItems } = trpc.purchaseRequests.getRequestItems.useQuery(
    { requestId: sourceId! }, { enabled: !!sourceId }
  );
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (existingRequest && !prefilled) {
      setTitle(isCopy ? `Copie — ${existingRequest.title}` : (existingRequest.title || ""));
      setDescription((existingRequest as any).description || "");
      setUrgencyLevel((existingRequest.urgencyLevel as any) || "medium");
      setDeliveryDate(existingRequest.deliveryDate ? new Date(existingRequest.deliveryDate).toISOString().split("T")[0] : "");
      setJustification((existingRequest as any).justification || "");
      setDepartmentId(existingRequest.departmentId ? String(existingRequest.departmentId) : "");
      if (existingItems && existingItems.length > 0) {
        setItems(existingItems.map((it: any) => ({
          itemName: it.itemName || "",
          description: it.description || "",
          quantity: String(it.quantity || 1),
          unit: it.unit || "pcs",
          unitPrice: String(Number(it.unitPrice) || 0),
        })));
      }
      setPrefilled(true);
    }
  }, [existingRequest, existingItems, prefilled, isCopy]);
  const { data: lookupTypes = [] } = trpc.settings.getLookupTypes.useQuery();
  const categories = trpc.settings.getLookupValues.useQuery(
    { lookupTypeId: (lookupTypes as any[]).find((t: any) => t.name === "category")?.id ?? 0 },
    { enabled: (lookupTypes as any[]).some((t: any) => t.name === "category") }
  ).data ?? [];
  const costCenters = trpc.settings.getLookupValues.useQuery(
    { lookupTypeId: (lookupTypes as any[]).find((t: any) => t.name === "cost_center")?.id ?? 0 },
    { enabled: (lookupTypes as any[]).some((t: any) => t.name === "cost_center") }
  ).data ?? [];


  const updateMutation = trpc.purchaseRequests.update.useMutation({
    onSuccess: () => {
      toast.success("Demande mise à jour");
      utils.purchaseRequests.list.invalidate();
      setLocation(`/purchase-requests/${editId}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createMutation = trpc.purchaseRequests.create.useMutation({
    onSuccess: (data) => { utils.purchaseRequests.list.invalidate(); setLocation(`/purchase-requests/${(data as any).id || ""}`); },
    onError: (e) => toast.error(e.message),
  });
  const submitMutation = trpc.purchaseRequests.submit.useMutation({
    onSuccess: () => { toast.success("Demande soumise pour approbation !"); utils.purchaseRequests.list.invalidate(); setLocation("/purchase-requests"); },
    onError: (e) => toast.error(e.message),
  });

  const addItem = () => setItems(prev => [...prev, { itemName: "", description: "", quantity: "1", unit: "pcs", unitPrice: "" }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof Item, val: any) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const total = items.reduce((sum, it) => sum + ((parseFloat(String(it.quantity)) || 0) * parseNum(it.unitPrice)), 0);

  const buildPayload = () => ({
    title: title.trim(),
    description: description.trim() || undefined,
    urgencyLevel,
    deliveryDate: deliveryDate || undefined,
    justification: justification.trim() || undefined,
    departmentId: departmentId ? parseInt(departmentId) : undefined,
    categoryId: categoryId ? parseInt(categoryId) : undefined,
    billingStringId: billingStringId ? parseInt(billingStringId) : undefined,
    costCenterId: coding.costCenterId ? parseInt(coding.costCenterId) : (costCenterId ? parseInt(costCenterId) : undefined),
    glAccountId: coding.glAccountId ? parseInt(coding.glAccountId) : undefined,
    projectId: coding.projectId ? parseInt(coding.projectId) : undefined,
    amountEstimate: total,
    items: items.filter(it => it.itemName.trim()).map(it => ({
      itemName: it.itemName.trim(),
      description: it.description.trim() || undefined,
      quantity: parseFloat(String(it.quantity)) || 1,
      unit: it.unit || undefined,
      unitPrice: parseNum(it.unitPrice),
      totalPrice: (parseFloat(String(it.quantity)) || 1) * parseNum(it.unitPrice),
    })),
  });

  const handleSaveDraft = async () => {
    if (!title.trim()) { toast.error("Veuillez saisir un titre"); return; }
    if (!justification.trim()) {
      setJustificationError(true);
      document.getElementById("justification-field")?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("La justification est obligatoire");
      return;
    }
    if (isEdit && editId) {
      updateMutation.mutate({ id: editId, ...buildPayload() } as any);
    } else {
      createMutation.mutate(buildPayload());
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Veuillez saisir un titre"); return; }
    if (!justification.trim()) {
      setJustificationError(true);
      document.getElementById("justification-field")?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("La justification est obligatoire");
      return;
    }
    if (items.every(it => !it.itemName.trim())) { toast.error("Ajoutez au moins un article"); return; }
    const data = await createMutation.mutateAsync(buildPayload()).catch(() => null);
    if (data?.id) submitMutation.mutate({ id: data.id });
  };

  const isPending = createMutation.isPending || submitMutation.isPending || updateMutation.isPending;

  const URGENCY = [
    { value: "low", label: "Faible", color: "text-gray-600" },
    { value: "medium", label: "Moyen", color: "text-blue-600" },
    { value: "high", label: "Élevé", color: "text-orange-600" },
    { value: "critical", label: "Critique", color: "text-red-600" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/purchase-requests")} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEdit ? "Modifier la demande" : isCopy ? "Copier la demande" : "Nouvelle demande d'achat"}
          </h1>
          <p className="text-sm text-muted-foreground">Remplissez les informations de votre demande</p>
        </div>
      </div>

      {/* Step 1 - General info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</div>
            Informations générales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Titre de la demande *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Achat de fournitures de bureau Q2 2026" className="text-base" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Niveau d'urgence</Label>
              <div className="grid grid-cols-4 gap-2">
                {URGENCY.map(u => (
                  <button key={u.value} type="button" onClick={() => setUrgencyLevel(u.value as any)}
                    className={`py-2 px-1 rounded-lg border-2 text-xs font-semibold transition-all ${urgencyLevel === u.value ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <span className={urgencyLevel === u.value ? "text-blue-700" : u.color}>{u.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Date de livraison souhaitée</Label>
              <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <div id="justification-field">
            <Label>Justification <span className="text-red-500">*</span></Label>
            <Textarea
              value={justification}
              onChange={e => { setJustification(e.target.value); if (e.target.value.trim()) setJustificationError(false); }}
              placeholder="Expliquez pourquoi cette demande est nécessaire..."
              rows={3}
              className={justificationError ? "border-red-400 ring-2 ring-red-200 bg-red-50/30" : ""}
            />
            {justificationError && (
              <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                ⚠️ Ce champ est obligatoire avant de pouvoir soumettre
              </p>
            )}
            </div>
          </div>

          {/* Billing fields - always visible and required */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
              <div className="space-y-1.5">
                <Label>Département <span className="text-red-500">*</span></Label>
                <Select value={departmentId || "none"} onValueChange={v => setDepartmentId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucun —</SelectItem>
                    {(departments as any[]).map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie <span className="text-red-500">*</span></Label>
                <Select value={categoryId || "none"} onValueChange={v => setCategoryId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucune —</SelectItem>
                    {(categories as any[]).filter((c: any) => c.isActive).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Centre de coût <span className="text-red-500">*</span></Label>
                <Select value={costCenterId || "none"} onValueChange={v => setCostCenterId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucun —</SelectItem>
                    {(costCenters as any[]).filter((c: any) => c.isActive).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Description (optionnel)</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description supplémentaire" />
              </div>
            </div>
        </CardContent>
      </Card>

      {/* Coding */}
      <Card>
        <CardContent className="pt-5">
          <CodingWidget value={coding} onChange={setCoding} />
        </CardContent>
      </Card>

      {/* Step 2 - Items */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2</div>
              Articles demandés
            </CardTitle>
            <button type="button" onClick={addItem}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors">
              <Plus className="h-4 w-4" />Ajouter un article
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Table header */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            <div className="col-span-4">Article *</div>
            <div className="col-span-2">Unité</div>
            <div className="col-span-2 text-center">Qté</div>
            <div className="col-span-2 text-right">Prix unit. (XOF)</div>
            <div className="col-span-1 text-right">Total</div>
            <div className="col-span-1"></div>
          </div>

          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors">
              {/* Article name */}
              <div className="col-span-12 sm:col-span-4">
                <Input value={item.itemName} onChange={e => updateItem(i, "itemName", e.target.value)}
                  placeholder="Nom de l'article..." className="border-0 bg-transparent p-0 h-8 text-sm font-medium placeholder:text-muted-foreground focus-visible:ring-0" />
                <Input value={item.description} onChange={e => updateItem(i, "description", e.target.value)}
                  placeholder="Description (optionnel)" className="border-0 bg-transparent p-0 h-7 text-xs text-muted-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 mt-0.5" />
              </div>

              {/* Unit */}
              <div className="col-span-4 sm:col-span-2">
                <Select value={item.unit || "pcs"} onValueChange={v => updateItem(i, "unit", v)}>
                  <SelectTrigger className="h-8 text-sm border-0 bg-white/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity */}
              <div className="col-span-4 sm:col-span-2">
                <Input type="text" inputMode="decimal" value={item.quantity}
                  onFocus={e => e.target.select()}
                  onChange={e => updateItem(i, "quantity", e.target.value)}
                  onBlur={e => { if (!e.target.value.trim() || parseFloat(e.target.value) <= 0) updateItem(i, "quantity", "1"); }}
                  className="h-8 text-sm text-center bg-white/80" />
              </div>

              {/* Unit price */}
              <div className="col-span-4 sm:col-span-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={item.unitPrice}
                  onChange={e => updateItem(i, "unitPrice", e.target.value)}
                  onFocus={e => { if (item.unitPrice === "0" || item.unitPrice === "") updateItem(i, "unitPrice", ""); }}
                  placeholder="0"
                  className="h-8 text-sm text-right bg-white/80"
                />
              </div>

              {/* Line total */}
              <div className="col-span-11 sm:col-span-1 text-right">
                <span className="text-sm font-semibold text-blue-700">
                  {fmt((parseFloat(String(item.quantity)) || 0) * parseNum(item.unitPrice))}
                </span>
              </div>

              {/* Price benchmark — spans full width below this row */}
              {item.itemName.trim().length >= 3 && parseNum(item.unitPrice) > 0 && (
                <div className="col-span-12">
                  <PriceBenchmark
                    itemName={item.itemName}
                    unitPrice={parseNum(item.unitPrice)}
                    unit={item.unit}
                    quantity={parseFloat(String(item.quantity)) || 1}
                    description={item.description}
                  />
                </div>
              )}

              {/* Remove */}
              <div className="col-span-1 flex justify-end">
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)}
                    className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="flex justify-end pt-3 border-t">
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Montant total estimé</p>
              <p className="text-2xl font-bold text-blue-700">{fmt(total)} <span className="text-base font-normal text-muted-foreground">XOF</span></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
        <button type="button" onClick={() => setLocation("/purchase-requests")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" />Annuler
        </button>
        <div className="flex gap-3">
          <button type="button" onClick={handleSaveDraft} disabled={isPending || !title.trim()} data-mode={isEdit ? "edit" : "new"}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Save className="h-4 w-4" />Enregistrer brouillon
          </button>
          <button type="button" onClick={handleSubmit} disabled={isPending || !title.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 btn-primary">
            <Send className="h-4 w-4" />
            {isPending ? "En cours..." : "Soumettre pour approbation"}
          </button>
        </div>
      </div>
    </div>
  );
}
