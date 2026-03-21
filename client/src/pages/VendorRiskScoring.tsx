import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Shield, CheckCircle, XCircle, AlertTriangle, Save, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  legal: "Conformité légale", financial: "Solidité financière",
  compliance: "Conformité réglementaire", reputation: "Réputation & références",
};

const CATEGORY_COLORS: Record<string, string> = {
  legal: "blue", financial: "emerald", compliance: "amber", reputation: "purple",
};

function RiskGauge({ score, riskLevel, blocked }: { score: number; riskLevel: string; blocked: boolean }) {
  const color = blocked ? "#dc2626" : riskLevel === "low" ? "#059669" : riskLevel === "medium" ? "#d97706" : "#dc2626";
  const label = blocked ? "BLOQUÉ" : riskLevel === "low" ? "Risque faible" : riskLevel === "medium" ? "Risque modéré" : "Risque élevé";
  const bg = blocked ? "bg-red-50 border-red-200" : riskLevel === "low" ? "bg-emerald-50 border-emerald-200" : riskLevel === "medium" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  return (
    <div className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 ${bg}`}>
      <div className="relative h-28 w-28">
        <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8"
            stroke={color} strokeDasharray={`${score * 2.64} 264`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>{score}</span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
      </div>
      <div className="text-center">
        <p className="font-bold text-sm" style={{ color }}>{label}</p>
        {blocked && <p className="text-xs text-red-600 mt-1">Documents obligatoires manquants</p>}
      </div>
    </div>
  );
}

export default function VendorRiskScoring() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const vendorId = parseInt(new URLSearchParams(search).get("vendorId") || "0");
  const utils = trpc.useUtils();

  const { data: criteria = [] } = trpc.vendorRisk.getCriteria.useQuery();
  const { data: existing } = trpc.vendorRisk.getScore.useQuery({ vendorId }, { enabled: !!vendorId });
  const { data: vendors = [] } = trpc.vendors.list.useQuery({});

  const vendor = (vendors as any[]).find((v: any) => v.id === vendorId);

  // Local state for checks
  const [checks, setChecks] = useState<Record<string, { passed: boolean; notes: string }>>(() => {
    if (existing?.checks) return existing.checks;
    return {};
  });
  const [reviewNotes, setReviewNotes] = useState(existing?.reviewNotes || "");
  const [initialized, setInitialized] = useState(false);

  // Init from existing when loaded
  if (existing && !initialized) {
    setChecks(existing.checks || {});
    setReviewNotes(existing.reviewNotes || "");
    setInitialized(true);
  }

  const saveMut = trpc.vendorRisk.saveScore.useMutation({
    onSuccess: (data) => {
      toast.success(`Score enregistré : ${data.score}/100 — ${data.riskLevel === "low" ? "Risque faible" : data.riskLevel === "medium" ? "Risque modéré" : "Risque élevé"}${data.blocked ? " — BLOQUÉ" : ""}`);
      utils.vendorRisk.getScore.invalidate();
      utils.vendorRisk.listHighRisk.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Compute live score
  const liveScore = (criteria as any[]).reduce((sum: number, c: any) => {
    return sum + (checks[c.id]?.passed ? c.weight : 0);
  }, 0);
  const liveBlocked = (criteria as any[]).some((c: any) => c.blocking && !checks[c.id]?.passed);
  const liveRiskLevel = liveScore >= 80 ? "low" : liveScore >= 55 ? "medium" : "high";

  const toggleCheck = (id: string) => {
    setChecks(prev => ({ ...prev, [id]: { ...prev[id], passed: !prev[id]?.passed, notes: prev[id]?.notes || "" } }));
  };

  const setNote = (id: string, notes: string) => {
    setChecks(prev => ({ ...prev, [id]: { ...prev[id], passed: prev[id]?.passed || false, notes } }));
  };

  // Group by category
  const byCategory = (criteria as any[]).reduce((acc: any, c: any) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  if (!vendorId) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center">
        <Shield className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Évaluation des risques fournisseur</h2>
        <p className="text-muted-foreground mb-6">Sélectionnez un fournisseur à évaluer</p>
        <div className="space-y-2">
          {(vendors as any[]).filter((v: any) => v.status !== "inactive").map((v: any) => (
            <button key={v.id} onClick={() => setLocation(`/vendor-risk?vendorId=${v.id}`)}
              className="w-full text-left px-4 py-3 rounded-xl border hover:bg-muted/50 flex items-center justify-between transition-colors">
              <span className="font-medium text-sm">{v.legalName}</span>
              <span className="text-xs text-muted-foreground">Évaluer →</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/vendors")} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />Évaluation des risques
          </h1>
          <p className="text-sm text-muted-foreground">{vendor?.legalName || `Fournisseur #${vendorId}`}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Score gauge */}
        <div className="space-y-4">
          <RiskGauge score={liveScore} riskLevel={liveRiskLevel} blocked={liveBlocked} />
          <Card>
            <CardContent className="pt-4 pb-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Impact sur les achats</p>
              {liveBlocked ? (
                <div className="flex items-start gap-2 text-red-700 bg-red-50 p-3 rounded-lg">
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium">Ce fournisseur ne peut pas être sélectionné sur un bon de commande tant que les critères bloquants ne sont pas remplis.</p>
                </div>
              ) : liveRiskLevel === "high" ? (
                <div className="flex items-start gap-2 text-amber-700 bg-amber-50 p-3 rounded-lg">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium">Risque élevé — une alerte sera affichée lors de la sélection sur un BC.</p>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-lg">
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium">Fournisseur approuvé — peut être sélectionné sans restriction.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Criteria checklist */}
        <div className="lg:col-span-2 space-y-4">
          {Object.entries(byCategory).map(([cat, items]: [string, any]) => {
            const colorKey = CATEGORY_COLORS[cat] || "blue";
            const colors: Record<string, string> = {
              blue: "text-blue-700 bg-blue-50 border-blue-200",
              emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
              amber: "text-amber-700 bg-amber-50 border-amber-200",
              purple: "text-purple-700 bg-purple-50 border-purple-200",
            };
            return (
              <Card key={cat}>
                <CardHeader className="pb-2">
                  <CardTitle className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-2 ${colors[colorKey].split(" ")[0]}`}>
                    {CATEGORY_LABELS[cat] || cat}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((criterion: any) => {
                    const check = checks[criterion.id];
                    const passed = check?.passed || false;
                    return (
                      <div key={criterion.id} className={`rounded-xl border p-3 transition-colors ${passed ? "bg-emerald-50/50 border-emerald-200" : "bg-card border-muted"}`}>
                        <div className="flex items-start gap-3">
                          <button onClick={() => toggleCheck(criterion.id)}
                            className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${passed ? "bg-emerald-500 border-emerald-500" : criterion.blocking ? "border-red-400 hover:border-red-500" : "border-gray-300 hover:border-gray-400"}`}>
                            {passed && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-medium ${passed ? "text-emerald-800" : "text-foreground"}`}>{criterion.label}</span>
                              {criterion.blocking && !passed && (
                                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">Bloquant</span>
                              )}
                              <span className="text-xs text-muted-foreground ml-auto">{criterion.weight} pts</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{criterion.description}</p>
                            <input
                              type="text"
                              value={check?.notes || ""}
                              onChange={e => setNote(criterion.id, e.target.value)}
                              placeholder="Notes de vérification..."
                              className="mt-2 w-full text-xs px-2 py-1.5 rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}

          {/* Review notes */}
          <Card>
            <CardContent className="pt-4">
              <label className="text-sm font-medium block mb-2">Notes générales de l'évaluation</label>
              <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={3}
                className="w-full text-sm px-3 py-2 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Observations sur le fournisseur, contexte de l'évaluation, recommandations..." />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 bg-background/95 backdrop-blur border rounded-xl shadow-lg px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${liveBlocked ? "bg-red-100" : liveRiskLevel === "low" ? "bg-emerald-100" : liveRiskLevel === "medium" ? "bg-amber-100" : "bg-red-100"}`}>
            <Shield className={`h-4 w-4 ${liveBlocked ? "text-red-600" : liveRiskLevel === "low" ? "text-emerald-600" : liveRiskLevel === "medium" ? "text-amber-600" : "text-red-600"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold">Score : {liveScore}/100</p>
            <p className="text-xs text-muted-foreground">{liveBlocked ? "Bloqué — documents manquants" : liveRiskLevel === "low" ? "Risque faible" : liveRiskLevel === "medium" ? "Risque modéré" : "Risque élevé"}</p>
          </div>
        </div>
        <button onClick={() => saveMut.mutate({ vendorId, checks, reviewNotes: reviewNotes || undefined })}
          disabled={saveMut.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold btn-primary text-white disabled:opacity-50">
          {saveMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement...</> : <><Save className="h-4 w-4" />Enregistrer l'évaluation</>}
        </button>
      </div>
    </div>
  );
}
