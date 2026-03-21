import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp, TrendingDown, Minus, Sparkles, Loader2,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Info, Lightbulb
} from "lucide-react";

interface Props {
  itemName: string;
  unitPrice: number;
  unit?: string;
  quantity?: number;
  description?: string;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

export function PriceBenchmark({ itemName, unitPrice, unit, quantity, description }: Props) {
  const [showAI, setShowAI] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const prevItem = useRef("");

  // Only query when item name has 3+ chars and price > 0
  const enabled = itemName.trim().length >= 3 && unitPrice > 0;

  const { data: historical, isLoading: histLoading } = trpc.priceBenchmark.getHistorical.useQuery(
    { itemName: itemName.trim(), unit },
    { enabled, staleTime: 30000 }
  );

  const aiMut = trpc.priceBenchmark.getAIEstimate.useMutation();

  // Reset when item name changes significantly
  useEffect(() => {
    if (itemName !== prevItem.current) {
      setShowAI(false);
      prevItem.current = itemName;
    }
  }, [itemName]);

  if (!enabled) return null;
  if (histLoading) return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 px-1">
      <Loader2 className="h-3 w-3 animate-spin" />Recherche des prix historiques...
    </div>
  );

  // ── Historical data found ─────────────────────────────────────────────────
  if (historical) {
    const pct = ((unitPrice - historical.avg) / historical.avg) * 100;
    const aboveThreshold = pct > 20;
    const slightlyAbove = pct > 5 && pct <= 20;
    const goodDeal = pct < -5;
    const savings = unitPrice > historical.avg ? (unitPrice - historical.avg) * (quantity || 1) : 0;

    const badge = aboveThreshold
      ? { bg: "bg-red-50 border-red-200", text: "text-red-700", icon: TrendingUp, label: `+${pct.toFixed(0)}% au-dessus`, dot: "bg-red-500" }
      : slightlyAbove
      ? { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: TrendingUp, label: `+${pct.toFixed(0)}% au-dessus`, dot: "bg-amber-400" }
      : goodDeal
      ? { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", icon: TrendingDown, label: `${pct.toFixed(0)}% en dessous`, dot: "bg-emerald-500" }
      : { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", icon: Minus, label: "Prix dans la norme", dot: "bg-blue-400" };

    return (
      <div className="mt-1.5">
        {/* Compact badge */}
        <button onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:opacity-90 ${badge.bg}`}>
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
            <badge.icon className={`h-3 w-3 ${badge.text}`} />
            <span className={badge.text}>{badge.label} de la moyenne historique</span>
            {aboveThreshold && savings > 0 && (
              <span className="text-red-600 font-semibold">· potentiel {fmt(savings)} XOF à économiser</span>
            )}
          </div>
          <div className={`flex items-center gap-1 ${badge.text}`}>
            <span className="text-xs opacity-70">{historical.sampleSize} réf.</span>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </div>
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div className={`mt-1 p-3 rounded-xl border ${badge.bg} space-y-2`}>
            {/* Price range bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Min historique</span>
                <span className="text-muted-foreground">Votre prix</span>
                <span className="text-muted-foreground">Max historique</span>
              </div>
              <div className="relative h-2 bg-white/60 rounded-full border">
                {/* Range fill */}
                <div className="absolute h-full bg-blue-200 rounded-full" style={{
                  left: `${Math.max(0, ((historical.min - historical.min) / (historical.max - historical.min + 1)) * 100)}%`,
                  right: `${Math.max(0, 100 - ((historical.max - historical.min) / (historical.max - historical.min + 1)) * 100)}%`,
                }} />
                {/* Avg marker */}
                <div className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 bg-blue-500 rounded-full"
                  style={{ left: `${Math.min(100, Math.max(0, ((historical.avg - historical.min) / Math.max(1, historical.max - historical.min)) * 100))}%` }}
                  title={`Moyenne: ${fmt(historical.avg)} XOF`} />
                {/* Your price marker */}
                <div className={`absolute top-1/2 -translate-y-1/2 h-4 w-1 rounded-full ${badge.dot}`}
                  style={{ left: `${Math.min(100, Math.max(0, ((unitPrice - historical.min) / Math.max(1, historical.max - historical.min)) * 100))}%` }}
                  title={`Votre prix: ${fmt(unitPrice)} XOF`} />
              </div>
              <div className="flex justify-between text-xs mt-1 font-medium">
                <span>{fmt(historical.min)}</span>
                <span className={badge.text}>{fmt(unitPrice)} XOF</span>
                <span>{fmt(historical.max)}</span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-white/60 rounded-lg p-2 text-center">
                <p className="text-muted-foreground">Moyenne</p>
                <p className="font-bold">{fmt(historical.avg)} XOF</p>
              </div>
              <div className="bg-white/60 rounded-lg p-2 text-center">
                <p className="text-muted-foreground">Dernier achat</p>
                <p className="font-bold">{fmt(historical.last)} XOF</p>
              </div>
              <div className="bg-white/60 rounded-lg p-2 text-center">
                <p className="text-muted-foreground">Meilleur prix</p>
                <p className="font-bold">{fmt(historical.min)} XOF</p>
              </div>
            </div>

            {/* Best vendor */}
            {historical.bestVendor && (
              <div className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <p className="text-xs">
                  <span className="font-medium">Meilleur fournisseur historique :</span>{" "}
                  {historical.bestVendor} à <span className="font-bold text-emerald-700">{fmt(historical.bestVendorPrice!)} XOF</span>
                </p>
              </div>
            )}

            {/* Alert if above threshold */}
            {aboveThreshold && (
              <div className="flex items-start gap-2 bg-red-100/80 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">
                  <span className="font-semibold">Prix élevé — négociation recommandée.</span>{" "}
                  Ramener au prix moyen économiserait <span className="font-bold">{fmt(savings)} XOF</span>{quantity && quantity > 1 ? ` sur ${quantity} unités` : ""}.
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Basé sur {historical.sampleSize} achat{historical.sampleSize > 1 ? "s" : ""} {historical.source === "actual" ? "réels (BCs approuvés)" : "estimés (DAs approuvées)"}
              {historical.lastDate && ` · Dernier : ${new Date(historical.lastDate).toLocaleDateString("fr-FR")}`}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── No historical data — offer AI estimate ───────────────────────────────
  return (
    <div className="mt-1.5">
      {!showAI ? (
        <button
          onClick={() => { setShowAI(true); aiMut.mutate({ itemName: itemName.trim(), description, unit, quantity }); }}
          className="flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg transition-colors w-full">
          <Sparkles className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          Pas de données historiques — estimer le prix marché avec l'IA
        </button>
      ) : aiMut.isPending ? (
        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-lg">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />Analyse du marché en cours...
        </div>
      ) : aiMut.data ? (
        <div className="mt-1 bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />Estimation IA du marché
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              aiMut.data.confidence === "high" ? "bg-emerald-100 text-emerald-700" :
              aiMut.data.confidence === "medium" ? "bg-amber-100 text-amber-700" :
              "bg-gray-100 text-gray-600"
            }`}>
              Confiance : {aiMut.data.confidence === "high" ? "élevée" : aiMut.data.confidence === "medium" ? "moyenne" : "faible"}
            </span>
          </div>

          {/* Price comparison */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/70 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Prix estimé marché</p>
              <p className="text-sm font-bold text-blue-800">{fmt(aiMut.data.estimatedUnitPrice)} XOF</p>
              <p className="text-xs text-muted-foreground">{fmt(aiMut.data.priceRange.min)} — {fmt(aiMut.data.priceRange.max)}</p>
            </div>
            <div className={`rounded-lg p-2 text-center ${
              unitPrice > aiMut.data.priceRange.max ? "bg-red-100" :
              unitPrice < aiMut.data.priceRange.min ? "bg-emerald-100" : "bg-white/70"
            }`}>
              <p className="text-xs text-muted-foreground">Votre prix</p>
              <p className={`text-sm font-bold ${
                unitPrice > aiMut.data.priceRange.max ? "text-red-700" :
                unitPrice < aiMut.data.priceRange.min ? "text-emerald-700" : "text-foreground"
              }`}>{fmt(unitPrice)} XOF</p>
              <p className="text-xs text-muted-foreground">
                {unitPrice > aiMut.data.priceRange.max ? "⚠️ Au-dessus fourchette" :
                 unitPrice < aiMut.data.priceRange.min ? "✓ En dessous fourchette" : "✓ Dans la fourchette"}
              </p>
            </div>
          </div>

          {aiMut.data.marketNotes && (
            <div className="flex items-start gap-2 bg-white/60 rounded-lg px-3 py-2">
              <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">{aiMut.data.marketNotes}</p>
            </div>
          )}

          {aiMut.data.negotiationTip && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Lightbulb className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800"><span className="font-semibold">Conseil négo :</span> {aiMut.data.negotiationTip}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">Estimation IA — aucune donnée historique pour cet article dans votre organisation.</p>
        </div>
      ) : aiMut.isError ? (
        <p className="text-xs text-muted-foreground px-1 mt-1">Estimation indisponible</p>
      ) : null}
    </div>
  );
}
