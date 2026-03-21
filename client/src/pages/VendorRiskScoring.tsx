import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Shield, CheckCircle, XCircle, AlertTriangle,
  ChevronRight, ChevronLeft, Save, Loader2, Building
} from "lucide-react";
import { toast } from "sonner";

// ── Risk criteria grouped for step-by-step flow ───────────────────────────────
const STEPS = [
  {
    id: "legal",
    title: "Conformité légale",
    subtitle: "Documents d'identité et d'enregistrement",
    color: "blue",
    criteria: [
      { id: "ifu", label: "IFU / Numéro fiscal", blocking: true, weight: 20, how: "Vérifier sur portail DGI ou demander attestation de moins de 3 mois" },
      { id: "rccm", label: "RCCM en cours de validité", blocking: true, weight: 15, how: "Registre du commerce — vérifier la date d'expiration (renouvellement annuel)" },
      { id: "conflict_of_interest", label: "Déclaration d'absence de conflit d'intérêt", blocking: true, weight: 10, how: "Document signé par le représentant légal du fournisseur" },
    ]
  },
  {
    id: "financial",
    title: "Solidité financière",
    subtitle: "Capacité à honorer le marché",
    color: "emerald",
    criteria: [
      { id: "rib", label: "RIB / Coordonnées bancaires vérifiées", blocking: true, weight: 15, how: "Appel téléphonique de confirmation avec la banque ou virement test de 1 XOF" },
      { id: "financial_capacity", label: "Capacité financière suffisante", blocking: false, weight: 10, how: "CA annuel ≥ 2× la valeur du marché — demander les derniers états financiers" },
    ]
  },
  {
    id: "compliance",
    title: "Conformité réglementaire",
    subtitle: "Assurances et obligations fiscales",
    color: "amber",
    criteria: [
      { id: "insurance", label: "Assurance RC professionnelle valide", blocking: false, weight: 10, how: "Attestation d'assurance — vérifier la date d'expiration" },
      { id: "tax_compliance", label: "Attestation de régularité fiscale (DGI)", blocking: false, weight: 10, how: "Quitus fiscal de moins de 3 mois attestant l'absence de dette fiscale" },
    ]
  },
  {
    id: "reputation",
    title: "Réputation",
    subtitle: "Références et historique",
    color: "purple",
    criteria: [
      { id: "references", label: "Références clients confirmées", blocking: false, weight: 5, how: "Au moins 2 références d'organisations similaires contactées et validées" },
      { id: "no_litigation", label: "Absence de litige ou procédure judiciaire", blocking: false, weight: 5, how: "Déclaration sur l'honneur + recherche presse locale" },
    ]
  },
];

const ALL_CRITERIA = STEPS.flatMap(s => s.criteria);
const TOTAL_WEIGHT = ALL_CRITERIA.reduce((s, c) => s + c.weight, 0);

const COLOR = {
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700",    icon: "text-blue-600",    step: "bg-blue-600" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: "text-emerald-600", step: "bg-emerald-600" },
  amber:   { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   icon: "text-amber-600",   step: "bg-amber-500" },
  purple:  { bg: "bg-purple-50",  border: "border-purple-200",  text: "text-purple-700",  icon: "text-purple-600",  step: "bg-purple-600" },
};

function ScoreBadge({ score, blocked }: { score: number; blocked: boolean }) {
  const color = blocked ? "text-red-700" : score >= 80 ? "text-emerald-700" : score >= 60 ? "text-amber-700" : "text-red-700";
  const bg = blocked ? "bg-red-50 border-red-200" : score >= 80 ? "bg-emerald-50 border-emerald-200" : score >= 60 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  const label = blocked ? "Bloqué" : score >= 80 ? "Risque faible" : score >= 60 ? "Risque modéré" : "Risque élevé";
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${bg}`}>
      <span className={`text-lg font-bold ${color}`}>{score}/100</span>
      <span className={`text-xs font-medium ${color}`}>{label}</span>
    </div>
  );
}

export default function VendorRiskScoring() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const canManage = user?.role === 'admin' || user?.role === 'procurement_manager';
  const search = useSearch();
  const vendorId = parseInt(new URLSearchParams(search).get("vendorId") || "0");
  const utils = trpc.useUtils();

  const [step, setStep] = useState(0); // 0 = vendor select, 1-4 = criteria steps, 5 = summary
  const [checks, setChecks] = useState<Record<string, { passed: boolean; notes: string }>>({});
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: vendors = [] } = trpc.vendors.list.useQuery({});
  const { data: existing } = trpc.vendorRisk.getScore.useQuery({ vendorId }, { enabled: !!vendorId });

  const vendor = (vendors as any[]).find((v: any) => v.id === vendorId);

  // Init from existing score
  if (existing && Object.keys(checks).length === 0 && existing.checks) {
    setChecks(existing.checks);
    if (existing.reviewNotes) setReviewNotes(existing.reviewNotes);
  }

  // Start evaluation when vendor selected
  if (vendorId && step === 0) setStep(1);

  const saveMut = trpc.vendorRisk.saveScore.useMutation({
    onSuccess: (data) => {
      const level = data.riskLevel === "low" ? "Risque faible ✅" : data.riskLevel === "medium" ? "Risque modéré ⚠️" : "Risque élevé 🔴";
      toast.success(`Évaluation enregistrée — Score ${data.score}/100 · ${level}`);
      utils.vendorRisk.getScore.invalidate();
      utils.vendorRisk.listHighRisk.invalidate();
      setLocation("/vendor-onboarding");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = (id: string) => {
    setChecks(prev => ({ ...prev, [id]: { passed: !prev[id]?.passed, notes: prev[id]?.notes || "" } }));
  };

  // Live score
  const liveScore = ALL_CRITERIA.reduce((sum, c) => sum + (checks[c.id]?.passed ? c.weight : 0), 0);
  const liveBlocked = ALL_CRITERIA.some(c => c.blocking && !checks[c.id]?.passed);
  const currentStep = STEPS[step - 1];
  const totalSteps = STEPS.length;
  const progress = Math.round((step > 0 ? (step - 1) / totalSteps : 0) * 100);

  // ── Vendor selector ──────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="max-w-lg space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/vendors")} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><Shield className="h-5 w-5 text-blue-600" />Évaluation des risques</h1>
            <p className="text-sm text-muted-foreground">Sélectionnez un fournisseur à évaluer</p>
          </div>
        </div>
        <div className="space-y-2">
          {(vendors as any[]).filter((v: any) => v.status !== "inactive").map((v: any) => (
            <button key={v.id} onClick={() => setLocation(`/vendor-risk?vendorId=${v.id}`)}
              className="w-full text-left px-4 py-3 rounded-xl border hover:bg-muted/50 hover:border-blue-300 flex items-center justify-between transition-all group">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Building className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{v.legalName}</p>
                  <p className="text-xs text-muted-foreground">{v.country || "—"}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Summary / result screen ───────────────────────────────────────────────────
  if (step === totalSteps + 1) {
    const blockingFailed = ALL_CRITERIA.filter(c => c.blocking && !checks[c.id]?.passed);
    const passed = ALL_CRITERIA.filter(c => checks[c.id]?.passed).length;
    return (
      <div className="max-w-lg space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep(totalSteps)} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Résumé de l'évaluation</h1>
        </div>

        {/* Score card */}
        <Card className={`border-2 ${liveBlocked ? "border-red-300 bg-red-50/30" : liveScore >= 80 ? "border-emerald-300 bg-emerald-50/30" : liveScore >= 60 ? "border-amber-300 bg-amber-50/30" : "border-red-300 bg-red-50/30"}`}>
          <CardContent className="pt-5 pb-5 text-center">
            <div className="text-5xl font-bold mb-1" style={{ color: liveBlocked ? "#dc2626" : liveScore >= 80 ? "#059669" : liveScore >= 60 ? "#d97706" : "#dc2626" }}>
              {liveScore}<span className="text-2xl text-muted-foreground">/100</span>
            </div>
            <p className="font-semibold text-lg">{liveBlocked ? "🔴 Fournisseur bloqué" : liveScore >= 80 ? "✅ Risque faible" : liveScore >= 60 ? "⚠️ Risque modéré" : "🔴 Risque élevé"}</p>
            <p className="text-sm text-muted-foreground mt-1">{passed}/{ALL_CRITERIA.length} critères validés · {vendor?.legalName}</p>
          </CardContent>
        </Card>

        {/* Blocking issues */}
        {blockingFailed.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
              <XCircle className="h-4 w-4" />{blockingFailed.length} document{blockingFailed.length > 1 ? "s" : ""} obligatoire{blockingFailed.length > 1 ? "s" : ""} manquant{blockingFailed.length > 1 ? "s" : ""}
            </p>
            {blockingFailed.map(c => (
              <p key={c.id} className="text-xs text-red-600 flex items-center gap-1.5 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />{c.label}
              </p>
            ))}
            <p className="text-xs text-red-500 mt-2 font-medium">Ce fournisseur ne peut pas être utilisé sur un bon de commande tant que ces documents ne sont pas fournis.</p>
          </div>
        )}

        {/* Step summary */}
        <div className="space-y-2">
          {STEPS.map(s => {
            const stepPassed = s.criteria.filter(c => checks[c.id]?.passed).length;
            const c = COLOR[s.color as keyof typeof COLOR];
            return (
              <button key={s.id} onClick={() => setStep(STEPS.indexOf(s) + 1)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border ${c.bg} ${c.border} hover:opacity-90 transition-opacity`}>
                <span className={`text-sm font-medium ${c.text}`}>{s.title}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{stepPassed}/{s.criteria.length}</span>
                  <div className="flex gap-1">
                    {s.criteria.map(criterion => (
                      <div key={criterion.id} className={`h-2.5 w-2.5 rounded-full ${checks[criterion.id]?.passed ? "bg-emerald-500" : criterion.blocking ? "bg-red-400" : "bg-gray-300"}`} />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Notes générales (optionnel)</label>
          <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={2}
            className="w-full text-sm px-3 py-2 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Observations supplémentaires..." />
        </div>

        {/* Save */}
        <button onClick={() => saveMut.mutate({ vendorId, checks, reviewNotes: reviewNotes || undefined })}
          disabled={saveMut.isPending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold btn-primary text-white disabled:opacity-50">
          {saveMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement...</> : <><Save className="h-4 w-4" />Enregistrer l'évaluation</>}
        </button>
      </div>
    );
  }

  // ── Step screen ───────────────────────────────────────────────────────────────
  const c = COLOR[currentStep.color as keyof typeof COLOR];
  const stepCriteria = currentStep.criteria;
  const stepDone = stepCriteria.filter(cr => checks[cr.id]?.passed).length;

  return (
    <div className="max-w-lg space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => step === 1 ? setLocation("/vendors") : setStep(s => s - 1)}
          className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{vendor?.legalName} · Étape {step}/{totalSteps}</p>
          <h1 className="text-lg font-bold truncate">{currentStep.title}</h1>
        </div>
        <ScoreBadge score={liveScore} blocked={liveBlocked} />
      </div>

      {/* Progress bar */}
      <div className="flex gap-1">
        {STEPS.map((s, i) => {
          const done = s.criteria.every(cr => checks[cr.id]?.passed);
          const partial = s.criteria.some(cr => checks[cr.id]?.passed);
          const active = i + 1 === step;
          return (
            <button key={s.id} onClick={() => setStep(i + 1)} className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
              <div className={`h-full rounded-full transition-all ${active ? "bg-blue-600" : done ? "bg-emerald-500" : partial ? "bg-amber-400" : "bg-muted"}`}
                style={{ width: active ? "100%" : done ? "100%" : partial ? "50%" : "0%" }} />
            </button>
          );
        })}
      </div>

      {/* Step description */}
      <p className="text-sm text-muted-foreground">{currentStep.subtitle}</p>

      {/* Criteria cards */}
      <div className="space-y-3">
        {stepCriteria.map(criterion => {
          const checked = checks[criterion.id]?.passed || false;
          return (
            <div key={criterion.id}
              className={`rounded-xl border-2 p-4 transition-all cursor-pointer ${checked ? "border-emerald-400 bg-emerald-50/50" : criterion.blocking ? "border-red-200 bg-red-50/20" : "border-muted hover:border-gray-300"}`}
              onClick={() => toggle(criterion.id)}>
              <div className="flex items-start gap-3">
                {/* Big tap target checkbox */}
                <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${checked ? "bg-emerald-500 border-emerald-500" : criterion.blocking ? "border-red-400" : "border-gray-300"}`}>
                  {checked && <CheckCircle className="h-4 w-4 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${checked ? "text-emerald-800" : "text-foreground"}`}>{criterion.label}</span>
                    {criterion.blocking && !checked && (
                      <span className="text-[11px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">Obligatoire</span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">{criterion.weight} pts</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{criterion.how}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        {step < totalSteps ? (
          <button onClick={() => setStep(s => s + 1)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold btn-primary text-white">
            {stepDone === stepCriteria.length ? "Continuer ✓" : "Continuer"}
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={() => setStep(totalSteps + 1)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold btn-primary text-white">
            Voir le résumé <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Skip to summary */}
      <button onClick={() => setStep(totalSteps + 1)} className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
        Passer au résumé →
      </button>
    </div>
  );
}
