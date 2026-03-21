import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, FileText, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ContractForm() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [contractType, setContractType] = useState("service");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [value, setValue] = useState("");
  const [autoRenew, setAutoRenew] = useState(false);
  const [noticePeriodDays, setNoticePeriodDays] = useState("30");
  const [alertDaysBefore, setAlertDaysBefore] = useState("30");
  const [description, setDescription] = useState("");

  const { data: vendors = [] } = trpc.vendors.list.useQuery();

  const createMutation = trpc.contracts.create.useMutation({
    onSuccess: () => {
      toast.success("Contrat créé avec succès");
      utils.contracts.list.invalidate();
      setLocation("/contracts");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    if (!vendorId) { toast.error("Fournisseur requis"); return; }
    if (!endDate) { toast.error("Date de fin requise"); return; }
    createMutation.mutate({
      title: title.trim(),
      vendorId: parseInt(vendorId),
      contractType: contractType as any,
      startDate, endDate,
      value: value ? parseFloat(value) : undefined,
      autoRenew,
      noticePeriodDays: parseInt(noticePeriodDays),
      alertDaysBefore: parseInt(alertDaysBefore),
      description: description.trim() || undefined,
    });
  };

  const CONTRACT_TYPES = [
    { value: "service", label: "Prestation de service" },
    { value: "supply", label: "Fourniture de biens" },
    { value: "maintenance", label: "Maintenance / SAV" },
    { value: "lease", label: "Location / Bail" },
    { value: "consulting", label: "Conseil / Expertise" },
    { value: "other", label: "Autre" },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/contracts")} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Nouveau contrat</h1>
          <p className="text-sm text-muted-foreground">Enregistrer un contrat fournisseur</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-blue-700">
            <FileText className="h-4 w-4" />Informations du contrat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Titre du contrat *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Contrat maintenance photocopieurs 2026" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Fournisseur *</Label>
              <select value={vendorId} onChange={e => setVendorId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Sélectionner...</option>
                {(vendors as any[]).map((v: any) => <option key={v.id} value={v.id}>{v.legalName}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Type de contrat *</Label>
              <select value={contractType} onChange={e => setContractType(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Date de début *</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date de fin *</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Valeur du contrat (XOF)</Label>
              <Input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Alerte avant expiration (jours)</Label>
              <Input type="number" value={alertDaysBefore} onChange={e => setAlertDaysBefore(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Préavis de résiliation (jours)</Label>
              <Input type="number" value={noticePeriodDays} onChange={e => setNoticePeriodDays(e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input type="checkbox" id="autoRenew" checked={autoRenew} onChange={e => setAutoRenew(e.target.checked)} className="h-4 w-4" />
              <Label htmlFor="autoRenew" className="cursor-pointer">Renouvellement automatique</Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description / Notes</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Portée du contrat, conditions spéciales, contacts clés..." />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end sticky bottom-4 bg-background/95 backdrop-blur py-3 px-4 rounded-xl border shadow-md">
        <button onClick={() => setLocation("/contracts")}
          className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
          Annuler
        </button>
        <button onClick={handleSave} disabled={createMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 btn-primary text-white">
          {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement...</> : <><Save className="h-4 w-4" />Enregistrer le contrat</>}
        </button>
      </div>
    </div>
  );
}
