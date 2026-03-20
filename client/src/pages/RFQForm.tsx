import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { useState } from "react";
import { Plus, Trash2, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

type Item = { itemName: string; description: string; quantity: number; unit: string; estimatedUnitPrice: string };
type Criterion = { name: string; weight: number };

export default function RFQForm() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [items, setItems] = useState<Item[]>([{ itemName: "", description: "", quantity: 1, unit: "pcs", estimatedUnitPrice: "" }]);
  const [criteria, setCriteria] = useState<Criterion[]>([
    { name: "Prix", weight: 40 },
    { name: "Délai de livraison", weight: 30 },
    { name: "Qualité / expérience", weight: 30 },
  ]);
  const [selectedVendorIds, setSelectedVendorIds] = useState<number[]>([]);

  const { data: vendors } = trpc.vendors.list.useQuery({ status: "active" });

  const createMutation = trpc.rfqs.create.useMutation({
    onSuccess: (data) => {
      toast.success(`RFQ ${data.rfqNumber} créé avec succès`);
      utils.rfqs.list.invalidate();
      setLocation(`/rfqs/${data.id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addItem = () => setItems(p => [...p, { itemName: "", description: "", quantity: 1, unit: "pcs", estimatedUnitPrice: "" }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, f: keyof Item, v: any) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [f]: v } : it));

  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Le titre est requis"); return; }
    if (!deadline) { toast.error("La date limite est requise"); return; }
    if (items.filter(i => i.itemName.trim()).length === 0) { toast.error("Ajoutez au moins un article"); return; }
    if (totalWeight !== 100) { toast.error(`La somme des critères doit être 100% (actuellement ${totalWeight}%)`); return; }

    await createMutation.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      deadline,
      evaluationCriteria: criteria,
      items: items.filter(i => i.itemName.trim()).map(i => ({
        itemName: i.itemName,
        description: i.description || undefined,
        quantity: i.quantity,
        unit: i.unit || undefined,
        estimatedUnitPrice: i.estimatedUnitPrice ? parseFloat(i.estimatedUnitPrice) : undefined,
      })),
      vendorIds: selectedVendorIds.length ? selectedVendorIds : undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/rfqs")}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Nouveau appel d'offres</h1>
          <p className="text-muted-foreground mt-1">Créer un RFQ et inviter des fournisseurs à soumettre leurs offres</p>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader><CardTitle>Informations générales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Titre *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Fourniture de matériel informatique Q2 2026" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Contexte et exigences de l'appel d'offres" rows={3} />
          </div>
          <div className="space-y-2 max-w-xs">
            <Label>Date limite de réponse *</Label>
            <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} min={new Date().toISOString().split("T")[0]} />
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle>Articles à sourcer</CardTitle><CardDescription>Définissez ce que vous souhaitez acheter</CardDescription></div>
          <Button size="sm" variant="outline" onClick={addItem}><Plus className="mr-2 h-4 w-4" />Ajouter</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="p-4 border rounded-lg space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Article {i + 1}</span>
                {items.length > 1 && (
                  <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => removeItem(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Désignation *</Label>
                  <Input value={item.itemName} onChange={e => updateItem(i, "itemName", e.target.value)} placeholder="Nom de l'article" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} placeholder="Spécifications" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Quantité *</Label>
                  <Input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, "quantity", parseFloat(e.target.value) || 1)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unité</Label>
                  <Input value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} placeholder="pcs, kg, m…" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Prix estimé (XOF)</Label>
                  <Input type="number" value={item.estimatedUnitPrice} onChange={e => updateItem(i, "estimatedUnitPrice", e.target.value)} placeholder="0" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Evaluation Criteria */}
      <Card>
        <CardHeader>
          <CardTitle>Critères d'évaluation</CardTitle>
          <CardDescription>
            Définissez comment les offres seront notées. La somme doit être 100%.{" "}
            <span className={totalWeight !== 100 ? "text-red-600 font-medium" : "text-green-600"}>
              Actuel: {totalWeight}%
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {criteria.map((c, i) => (
            <div key={i} className="flex items-center gap-3">
              <Input value={c.name} onChange={e => setCriteria(p => p.map((cr, idx) => idx === i ? { ...cr, name: e.target.value } : cr))} placeholder="Critère" className="flex-1" />
              <div className="flex items-center gap-2 w-32">
                <Input type="number" min="0" max="100" value={c.weight}
                  onChange={e => setCriteria(p => p.map((cr, idx) => idx === i ? { ...cr, weight: parseInt(e.target.value) || 0 } : cr))}
                  className="w-20" />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0"
                onClick={() => setCriteria(p => p.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setCriteria(p => [...p, { name: "", weight: 0 }])}>
            <Plus className="mr-2 h-3.5 w-3.5" />Ajouter un critère
          </Button>
        </CardContent>
      </Card>

      {/* Vendors */}
      <Card>
        <CardHeader>
          <CardTitle>Fournisseurs à inviter</CardTitle>
          <CardDescription>Sélectionnez les fournisseurs actifs à qui envoyer cet appel d'offres</CardDescription>
        </CardHeader>
        <CardContent>
          {vendors && vendors.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {vendors.map(v => (
                <label key={v.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer border">
                  <Checkbox
                    checked={selectedVendorIds.includes(v.id)}
                    onCheckedChange={checked => setSelectedVendorIds(p =>
                      checked ? [...p, v.id] : p.filter(id => id !== v.id)
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium">{v.legalName}</p>
                    {v.contactEmail && <p className="text-xs text-muted-foreground">{v.contactEmail}</p>}
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun fournisseur actif disponible.</p>
          )}
          {selectedVendorIds.length > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">{selectedVendorIds.length} fournisseur(s) sélectionné(s)</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => setLocation("/rfqs")} className="w-full sm:w-auto">Annuler</Button>
        <Button onClick={handleSubmit} disabled={createMutation.isPending} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white">
          <Send className="mr-2 h-4 w-4" />
          {createMutation.isPending ? "Création en cours..." : "Créer le RFQ"}
        </Button>
      </div>
    </div>
  );
}
