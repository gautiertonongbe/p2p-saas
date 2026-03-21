import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, Circle, AlertCircle, ChevronRight, Shield, Clock, Star } from "lucide-react";
import { toast } from "sonner";

function RiskGauge({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600";
  const bg = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  const label = score >= 80 ? "Faible risque" : score >= 50 ? "Risque modéré" : "Risque élevé";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3"
            className={bg.replace("bg-", "stroke-")} strokeDasharray={`${score} 100`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${color}`}>{score}%</span>
        </div>
      </div>
      <span className={`text-xs font-medium ${color}`}>{label}</span>
    </div>
  );
}

function OnboardingCard({ onboarding, vendor, onUpdate, onApprove }: any) {
  const checklist = onboarding.checklist || [];
  const required = checklist.filter((c: any) => c.required);
  const done = required.filter((c: any) => c.done);

  const updateMutation = trpc.vendorOnboarding.updateChecklist.useMutation({
    onSuccess: () => { toast.success("Mis à jour"); },
    onError: (e: any) => toast.error(e.message),
  });
  const approveMutation = trpc.vendorOnboarding.approve.useMutation({
    onSuccess: () => { toast.success("Fournisseur approuvé et activé !"); onApprove(); },
    onError: (e: any) => toast.error(e.message),
  });

  const isComplete = done.length === required.length;
  const statusColors: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700", approved: "bg-blue-100 text-blue-700",
    in_progress: "bg-amber-100 text-amber-700", rejected: "bg-red-100 text-red-700",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold">{vendor?.legalName || `Fournisseur #${onboarding.vendorId}`}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[onboarding.status] || "bg-gray-100 text-gray-700"}`}>
                {onboarding.status === "completed" ? "Documents complets" : onboarding.status === "approved" ? "Approuvé" : onboarding.status === "in_progress" ? "En cours" : onboarding.status}
              </span>
            </div>
          </div>
          <RiskGauge score={onboarding.riskScore || 0} />
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Documents obligatoires</span><span>{done.length}/{required.length}</span>
          </div>
          <div className="h-2 bg-muted rounded-full">
            <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${required.length ? (done.length / required.length) * 100 : 0}%` }} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {checklist.map((item: any) => (
          <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
            <button onClick={() => updateMutation.mutate({ vendorId: onboarding.vendorId, checklistItemId: item.id, done: !item.done })}
              className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${item.done ? "bg-emerald-500 border-emerald-500" : item.required ? "border-amber-400" : "border-gray-300"}`}>
              {item.done && <CheckCircle className="h-3 w-3 text-white" />}
            </button>
            <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.label}</span>
            {item.required && !item.done && <span className="text-xs text-amber-600 font-medium">Requis</span>}
          </div>
        ))}
        {isComplete && onboarding.status !== "approved" && (
          <button onClick={() => approveMutation.mutate({ vendorId: onboarding.vendorId })}
            disabled={approveMutation.isPending}
            className="w-full mt-3 py-2.5 rounded-lg text-sm font-semibold btn-primary text-white flex items-center justify-center gap-2">
            <Shield className="h-4 w-4" />Approuver et activer le fournisseur
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export default function VendorOnboardingPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [selectedVendorId, setSelectedVendorId] = useState("");

  const { data: onboardings = [] } = trpc.vendorOnboarding.list.useQuery();
  const { data: vendors = [] } = trpc.vendors.list.useQuery();

  const pendingVendors = (vendors as any[]).filter((v: any) =>
    v.status === "pending_approval" && !(onboardings as any[]).find((o: any) => o.vendorId === v.id)
  );

  const startMutation = trpc.vendorOnboarding.start.useMutation({
    onSuccess: () => { toast.success("Processus d'onboarding démarré"); utils.vendorOnboarding.list.invalidate(); setSelectedVendorId(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const getVendor = (vendorId: number) => (vendors as any[]).find((v: any) => v.id === vendorId);
  const invalidate = () => { utils.vendorOnboarding.list.invalidate(); utils.vendors.list.invalidate(); };

  const stats = {
    inProgress: (onboardings as any[]).filter((o: any) => o.status === "in_progress").length,
    completed: (onboardings as any[]).filter((o: any) => o.status === "completed").length,
    approved: (onboardings as any[]).filter((o: any) => o.status === "approved").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader icon={<Users className="h-5 w-5" />} title="Qualification fournisseurs"
        description="Processus structuré d'onboarding et de qualification des nouveaux fournisseurs" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "En cours", value: stats.inProgress, color: "amber", icon: Clock },
          { label: "Documents complets", value: stats.completed, color: "blue", icon: CheckCircle },
          { label: "Approuvés", value: stats.approved, color: "emerald", icon: Shield },
        ].map(({ label, value, color, icon: Icon }) => {
          const colors: Record<string, string> = { amber: "bg-amber-50 text-amber-600", blue: "bg-blue-50 text-blue-600", emerald: "bg-emerald-50 text-emerald-600" };
          const textColors: Record<string, string> = { amber: "text-amber-700", blue: "text-blue-700", emerald: "text-emerald-700" };
          return (
            <Card key={label}><CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
                  <Icon className="h-4.5 w-4.5" style={{width:18,height:18}} />
                </div>
                <div>
                  <p className={`text-xl font-bold ${textColors[color]}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent></Card>
          );
        })}
      </div>

      {/* Start new onboarding */}
      {pendingVendors.length > 0 && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-purple-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />{pendingVendors.length} fournisseur{pendingVendors.length > 1 ? "s" : ""} en attente de qualification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <select value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)}
                className="flex-1 h-10 px-3 rounded-md border border-purple-200 bg-white text-sm">
                <option value="">Sélectionner un fournisseur à qualifier...</option>
                {pendingVendors.map((v: any) => <option key={v.id} value={v.id}>{v.legalName}</option>)}
              </select>
              <button disabled={!selectedVendorId || startMutation.isPending}
                onClick={() => selectedVendorId && startMutation.mutate({ vendorId: parseInt(selectedVendorId) })}
                className="px-4 py-2 rounded-lg text-sm font-semibold btn-primary text-white disabled:opacity-50">
                Démarrer la qualification
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active onboardings */}
      {(onboardings as any[]).length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">Aucun processus en cours</p>
          <p className="text-sm text-muted-foreground mt-1">Ajoutez un fournisseur et démarrez sa qualification</p>
          <button onClick={() => setLocation("/vendors/new")} className="mt-4 text-sm btn-primary px-4 py-1.5 rounded-lg text-white">
            + Ajouter un fournisseur
          </button>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {(onboardings as any[]).map((o: any) => (
            <OnboardingCard key={o.id} onboarding={o} vendor={getVendor(o.vendorId)} onUpdate={invalidate} onApprove={invalidate} />
          ))}
        </div>
      )}
    </div>
  );
}
