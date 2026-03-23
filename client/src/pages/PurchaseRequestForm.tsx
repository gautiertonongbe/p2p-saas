import { trpc } from "@/lib/trpc";
import { PriceBenchmark } from "@/components/PriceBenchmark";
import CodingWidget, { type CodingValues } from "@/components/CodingWidget";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation, useParams, useSearch } from "wouter";
import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type Item = { itemName: string; description: string; quantity: string; unit: string; unitPrice: string };
type Urgency = "low" | "medium" | "high" | "critical";

function fmt(n: number) { return new Intl.NumberFormat("fr-FR").format(n); }
function parseNum(s: string) { return parseFloat(String(s).replace(/\s/g, "").replace(",", ".")) || 0; }

const UNITS = ["pcs","kg","g","L","mL","m","cm","m²","m³","boîte","carton","palette","lot","heure","jour","mois"];
const URGENCY_OPTIONS = [
  { value: "low",      label: "Faible",   color: "#4B5563" },
  { value: "medium",   label: "Moyen",    color: "#2563EB" },
  { value: "high",     label: "Élevé",    color: "#EA580C" },
  { value: "critical", label: "Critique", color: "#DC2626" },
];

// Simple field component with guaranteed visible text
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
        {label}{required && <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// Native input with guaranteed black text
function NativeInput({ value, onChange, placeholder, type = "text", style: extraStyle = {} }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; style?: React.CSSProperties;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", height: 38, padding: "0 12px", fontSize: 14,
        color: "#111827", backgroundColor: "#ffffff",
        border: "1px solid #D1D5DB", borderRadius: 8, outline: "none",
        ...extraStyle
      }}
      onFocus={e => { e.target.style.borderColor = "#3B82F6"; }}
      onBlur={e => { e.target.style.borderColor = "#D1D5DB"; }}
    />
  );
}

function NativeTextarea({ value, onChange, placeholder, rows = 3, error }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; error?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%", padding: "8px 12px", fontSize: 14,
        color: "#111827", backgroundColor: error ? "#FFF5F5" : "#ffffff",
        border: `1px solid ${error ? "#EF4444" : "#D1D5DB"}`,
        borderRadius: 8, outline: "none", resize: "vertical", fontFamily: "inherit",
        boxShadow: error ? "0 0 0 3px rgba(239,68,68,0.15)" : "none"
      }}
      onFocus={e => { e.target.style.borderColor = error ? "#EF4444" : "#3B82F6"; }}
      onBlur={e => { e.target.style.borderColor = error ? "#EF4444" : "#D1D5DB"; }}
    />
  );
}

export default function PurchaseRequestForm() {
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

  // Form state
  const [title, setTitle]               = useState("");
  const [description, setDescription]   = useState("");
  const [urgency, setUrgency]           = useState<Urgency>("medium");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [justification, setJustification] = useState("");
  const [justificationError, setJustificationError] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [categoryId, setCategoryId]     = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [coding, setCoding]             = useState<CodingValues>({});
  const [items, setItems]               = useState<Item[]>([
    { itemName: "", description: "", quantity: "1", unit: "pcs", unitPrice: "" }
  ]);
  const [prefilled, setPrefilled]       = useState(false);

  // Data
  const { data: departments = [] }      = trpc.settings.listDepartments.useQuery();
  const { data: lookupTypes = [] }      = trpc.settings.getLookupTypes.useQuery();
  const catTypeId   = (lookupTypes as any[]).find((t: any) => t.name === "category")?.id ?? 0;
  const ccTypeId    = (lookupTypes as any[]).find((t: any) => t.name === "cost_center")?.id ?? 0;
  const { data: categories  = [] }      = trpc.settings.getLookupValues.useQuery({ lookupTypeId: catTypeId }, { enabled: catTypeId > 0 });
  const { data: costCenters = [] }      = trpc.settings.getLookupValues.useQuery({ lookupTypeId: ccTypeId  }, { enabled: ccTypeId  > 0 });

  // Prefill for edit/copy
  const { data: existing }       = trpc.purchaseRequests.getById.useQuery({ id: sourceId! }, { enabled: !!sourceId });
  const { data: existingItems }  = trpc.purchaseRequests.getRequestItems.useQuery({ requestId: sourceId! }, { enabled: !!sourceId });

  useEffect(() => {
    if (existing && !prefilled) {
      setTitle(isCopy ? `Copie — ${existing.title}` : (existing.title || ""));
      setDescription((existing as any).description || "");
      setUrgency((existing.urgencyLevel as Urgency) || "medium");
      setDeliveryDate(existing.deliveryDate ? new Date(existing.deliveryDate).toISOString().split("T")[0] : "");
      setJustification((existing as any).justification || "");
      setDepartmentId(existing.departmentId ? String(existing.departmentId) : "");
      if (existingItems?.length) {
        setItems(existingItems.map((it: any) => ({
          itemName:    it.itemName || "",
          description: it.description || "",
          quantity:    String(it.quantity || 1),
          unit:        it.unit || "pcs",
          unitPrice:   String(Number(it.unitPrice) || 0),
        })));
      }
      setPrefilled(true);
    }
  }, [existing, existingItems, prefilled, isCopy]);

  // Mutations
  const updateMutation  = trpc.purchaseRequests.update.useMutation({
    onSuccess: () => { toast.success("Demande mise à jour"); utils.purchaseRequests.list.invalidate(); setLocation(`/purchase-requests/${editId}`); },
    onError: (e: any) => toast.error(e.message),
  });
  const createMutation  = trpc.purchaseRequests.create.useMutation({
    onError: (e: any) => toast.error(e.message),
  });
  const submitMutation  = trpc.purchaseRequests.submit.useMutation({
    onError: (e: any) => toast.error(e.message),
  });

  const isPending = createMutation.isPending || submitMutation.isPending || updateMutation.isPending;

  const total = items.reduce((s, it) => s + (parseFloat(String(it.quantity)) || 0) * parseNum(it.unitPrice), 0);

  const buildPayload = () => ({
    title: title.trim(),
    description: description.trim() || undefined,
    justification: justification.trim() || undefined,
    urgencyLevel: urgency,
    deliveryDate: deliveryDate || undefined,
    departmentId:   departmentId   ? parseInt(departmentId)   : undefined,
    categoryId:     categoryId     ? parseInt(categoryId)     : undefined,
    costCenterId:   coding.costCenterId ? parseInt(coding.costCenterId) : (costCenterId ? parseInt(costCenterId) : undefined),
    glAccountId:    coding.glAccountId  ? parseInt(coding.glAccountId)  : undefined,
    projectId:      coding.projectId    ? parseInt(coding.projectId)    : undefined,
    amountEstimate: total,
    items: items.filter(it => it.itemName.trim()).map(it => ({
      itemName:    it.itemName.trim(),
      description: it.description.trim() || undefined,
      quantity:    parseFloat(String(it.quantity)) || 1,
      unit:        it.unit || undefined,
      unitPrice:   parseNum(it.unitPrice),
      totalPrice:  (parseFloat(String(it.quantity)) || 1) * parseNum(it.unitPrice),
    })),
  });

  const validate = (): boolean => {
    if (!title.trim()) { toast.error("Le titre est obligatoire"); return false; }
    if (!justification.trim()) {
      setJustificationError(true);
      document.getElementById("just-field")?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("La justification est obligatoire");
      return false;
    }
    if (items.every(it => !it.itemName.trim())) { toast.error("Ajoutez au moins un article"); return false; }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) { toast.error("Le titre est obligatoire"); return; }
    if (isEdit && editId) {
      updateMutation.mutate({ id: editId, ...buildPayload() } as any);
    } else {
      const data = await createMutation.mutateAsync(buildPayload()).catch(() => null);
      if (data?.id) { toast.success("Brouillon enregistré"); setLocation(`/purchase-requests/${(data as any).id}`); }
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      const data = await createMutation.mutateAsync(buildPayload());
      const id = (data as any)?.id;
      if (!id) { toast.error("Erreur: impossible de récupérer l'ID"); return; }
      await submitMutation.mutateAsync({ id });
      toast.success("Demande soumise pour approbation !");
      utils.purchaseRequests.list.invalidate();
      setLocation("/purchase-requests");
    } catch (e: any) {
      // error already shown by mutation onError
    }
  };

  const addItem    = () => setItems(p => [...p, { itemName: "", description: "", quantity: "1", unit: "pcs", unitPrice: "" }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, k: keyof Item, v: string) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  // Styles
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 24, marginBottom: 16 };
  const sectionTitle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, marginBottom: 20 };
  const badge: React.CSSProperties = { width: 24, height: 24, borderRadius: "50%", background: "#2563EB", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 };
  const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 };
  const grid4: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 40px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 0" }}>
        <button onClick={() => setLocation("/purchase-requests")}
          style={{ padding: 8, borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", cursor: "pointer" }}>
          <ArrowLeft style={{ width: 18, height: 18, color: "#374151" }} />
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>
            {isEdit ? "Modifier la demande" : isCopy ? "Copier la demande" : "Nouvelle demande d'achat"}
          </h1>
          <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>Remplissez tous les champs obligatoires *</p>
        </div>
      </div>

      {/* Section 1 */}
      <div style={card}>
        <div style={sectionTitle}>
          <div style={badge}>1</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Informations générales</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Title */}
          <Field label="Titre de la demande" required>
            <NativeInput value={title} onChange={setTitle} placeholder="Ex: Achat fournitures bureau Q2 2026" style={{ fontSize: 15, height: 42 }} />
          </Field>

          {/* Justification — prominent, first */}
          <div id="just-field">
            <Field label="Justification — pourquoi cet achat est-il nécessaire ?" required>
              <NativeTextarea
                value={justification}
                onChange={v => { setJustification(v); if (v.trim()) setJustificationError(false); }}
                placeholder="Décrivez le besoin, l'impact opérationnel, l'urgence..."
                rows={3}
                error={justificationError}
              />
              {justificationError && (
                <p style={{ color: "#DC2626", fontSize: 12, marginTop: 4 }}>
                  ⚠️ Ce champ est obligatoire
                </p>
              )}
            </Field>
          </div>

          {/* Urgency + Date */}
          <div style={grid2}>
            <Field label="Niveau d'urgence">
              <div style={grid4}>
                {URGENCY_OPTIONS.map(u => (
                  <button key={u.value} type="button" onClick={() => setUrgency(u.value as Urgency)}
                    style={{
                      padding: "8px 4px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: `2px solid ${urgency === u.value ? u.color : "#E5E7EB"}`,
                      background: urgency === u.value ? `${u.color}15` : "#fff",
                      color: urgency === u.value ? u.color : "#6B7280",
                    }}>
                    {u.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Date de livraison souhaitée">
              <NativeInput value={deliveryDate} onChange={setDeliveryDate} type="date" />
            </Field>
          </div>

          {/* Département + Catégorie + Centre de coût */}
          <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 16, display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
            <Field label="Département" required>
              <Select value={departmentId || "none"} onValueChange={v => setDepartmentId(v === "none" ? "" : v)}>
                <SelectTrigger style={{ height: 38, fontSize: 14, color: "#111827", background: "#fff" }}>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucun —</SelectItem>
                  {(departments as any[]).map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Catégorie" required>
              <Select value={categoryId || "none"} onValueChange={v => setCategoryId(v === "none" ? "" : v)}>
                <SelectTrigger style={{ height: 38, fontSize: 14, color: "#111827", background: "#fff" }}>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucune —</SelectItem>
                  {(categories as any[]).filter((c: any) => c.isActive).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Centre de coût" required>
              <Select value={costCenterId || "none"} onValueChange={v => setCostCenterId(v === "none" ? "" : v)}>
                <SelectTrigger style={{ height: 38, fontSize: 14, color: "#111827", background: "#fff" }}>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucun —</SelectItem>
                  {(costCenters as any[]).filter((c: any) => c.isActive).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Description additionnelle">
              <NativeInput value={description} onChange={setDescription} placeholder="Description supplémentaire (optionnel)" />
            </Field>
          </div>
        </div>
      </div>

      {/* Coding */}
      <div style={{ ...card, padding: 20 }}>
        <CodingWidget value={coding} onChange={setCoding} />
      </div>

      {/* Section 2 — Items */}
      <div style={card}>
        <div style={{ ...sectionTitle, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={badge}>2</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Articles demandés</span>
          </div>
          <button type="button" onClick={addItem}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Plus style={{ width: 14, height: 14 }} /> Ajouter un article
          </button>
        </div>

        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1.5fr auto auto", gap: 8, padding: "0 4px 8px", borderBottom: "1px solid #F3F4F6", marginBottom: 8 }}>
          {["Article", "Unité", "Qté", "Prix unit. (XOF)", "Total", ""].map((h, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: i >= 3 ? "right" : "left" }}>{h}</span>
          ))}
        </div>

        {items.map((item, i) => (
          <div key={i} style={{ background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1.5fr auto auto", gap: 8, alignItems: "center" }}>

              {/* Name */}
              <input
                type="text" value={item.itemName}
                onChange={e => updateItem(i, "itemName", e.target.value)}
                placeholder="Nom de l'article..."
                style={{ color: "#111827", background: "#fff", border: "1px solid #D1D5DB", borderRadius: 6, height: 34, padding: "0 10px", fontSize: 13, fontWeight: 600, width: "100%", outline: "none" }}
              />

              {/* Unit */}
              <select
                value={item.unit || "pcs"} onChange={e => updateItem(i, "unit", e.target.value)}
                style={{ color: "#111827", background: "#fff", border: "1px solid #D1D5DB", borderRadius: 6, height: 34, padding: "0 6px", fontSize: 13, width: "100%", outline: "none" }}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>

              {/* Qty */}
              <input
                type="text" inputMode="decimal" value={item.quantity}
                onFocus={e => e.target.select()}
                onChange={e => updateItem(i, "quantity", e.target.value)}
                onBlur={e => { if (!e.target.value || parseFloat(e.target.value) <= 0) updateItem(i, "quantity", "1"); }}
                style={{ color: "#111827", background: "#fff", border: "1px solid #D1D5DB", borderRadius: 6, height: 34, padding: "0 10px", fontSize: 13, textAlign: "center", width: "100%", outline: "none" }}
              />

              {/* Price */}
              <input
                type="text" inputMode="decimal" value={item.unitPrice} placeholder="0"
                onChange={e => updateItem(i, "unitPrice", e.target.value)}
                onFocus={e => { if (item.unitPrice === "0") updateItem(i, "unitPrice", ""); }}
                style={{ color: "#111827", background: "#fff", border: "1px solid #D1D5DB", borderRadius: 6, height: 34, padding: "0 10px", fontSize: 13, textAlign: "right", width: "100%", outline: "none" }}
              />

              {/* Line total */}
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1D4ED8", textAlign: "right", whiteSpace: "nowrap" }}>
                {fmt((parseFloat(String(item.quantity)) || 0) * parseNum(item.unitPrice))}
              </span>

              {/* Delete */}
              <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
                style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: items.length === 1 ? "not-allowed" : "pointer", opacity: items.length === 1 ? 0.3 : 1 }}>
                <Trash2 style={{ width: 14, height: 14, color: "#EF4444" }} />
              </button>
            </div>

            {/* Item description */}
            <input
              type="text" value={item.description}
              onChange={e => updateItem(i, "description", e.target.value)}
              placeholder="Description de l'article (optionnel)"
              style={{ color: "#374151", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 6, height: 28, padding: "0 10px", fontSize: 12, width: "100%", outline: "none", marginTop: 6, boxSizing: "border-box" }}
            />

            {/* Price benchmark */}
            {item.itemName.trim().length >= 3 && parseNum(item.unitPrice) > 0 && (
              <div style={{ marginTop: 8 }}>
                <PriceBenchmark itemName={item.itemName} unitPrice={parseNum(item.unitPrice)} unit={item.unit} quantity={parseFloat(String(item.quantity)) || 1} description={item.description} />
              </div>
            )}
          </div>
        ))}

        {/* Total */}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid #F3F4F6" }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Montant total estimé</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: "#1D4ED8", margin: 0 }}>{fmt(total)} <span style={{ fontSize: 14, color: "#9CA3AF", fontWeight: 400 }}>XOF</span></p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <button onClick={() => setLocation("/purchase-requests")}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "1px solid #D1D5DB", background: "#fff", color: "#374151", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          <ArrowLeft style={{ width: 16, height: 16 }} /> Annuler
        </button>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleSaveDraft} disabled={isPending || !title.trim()}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "1px solid #D1D5DB", background: "#fff", color: "#374151", fontSize: 14, fontWeight: 500, cursor: "pointer", opacity: isPending || !title.trim() ? 0.5 : 1 }}>
            <Save style={{ width: 16, height: 16 }} /> Enregistrer brouillon
          </button>
          <button onClick={handleSubmit} disabled={isPending}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 24px", borderRadius: 10, border: "none", background: isPending ? "#93C5FD" : "#2563EB", color: "#fff", fontSize: 14, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer" }}>
            <Send style={{ width: 16, height: 16 }} />
            {isPending ? "En cours..." : "Soumettre pour approbation"}
          </button>
        </div>
      </div>
    </div>
  );
}
