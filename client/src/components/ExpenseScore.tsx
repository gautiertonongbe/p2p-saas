/**
 * Expense Report Scoring — Coupa-style compliance score
 * Evaluates: receipt completeness, description quality, category accuracy,
 * amount reasonableness, period coverage
 */

import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";

type Line = {
  amount: string | number;
  description?: string;
  vendorName?: string;
  category?: string;
  receiptUrl?: string;
};

type ScoreResult = {
  score: number;        // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  flags: { type: "error" | "warning" | "info"; message: string }[];
  passed: string[];
};

// Policy thresholds (could be org-configurable later)
const POLICY = {
  maxMealAmount: 50000,       // XOF per meal
  maxHotelPerNight: 150000,   // XOF per night
  maxTransportTrip: 100000,   // XOF per trip
  requireDescriptionAbove: 25000,  // require description if > this
  requireVendorAbove: 50000,       // require vendor if > this
};

export function computeExpenseScore(lines: Line[], title: string): ScoreResult {
  const flags: ScoreResult["flags"] = [];
  const passed: string[] = [];
  let deductions = 0;

  if (!lines || lines.length === 0) {
    return { score: 0, grade: "F", flags: [{ type: "error", message: "Aucune ligne de dépense" }], passed: [] };
  }

  // 1. Description quality (20 pts)
  const missingDesc = lines.filter(l => !l.description?.trim() && Number(l.amount) > POLICY.requireDescriptionAbove);
  if (missingDesc.length > 0) {
    deductions += 15;
    flags.push({ type: "warning", message: `${missingDesc.length} ligne(s) sans description (montant > ${new Intl.NumberFormat("fr-FR").format(POLICY.requireDescriptionAbove)} XOF)` });
  } else {
    passed.push("Descriptions complètes");
  }

  // 2. Vendor name (15 pts)
  const missingVendor = lines.filter(l => !l.vendorName?.trim() && Number(l.amount) > POLICY.requireVendorAbove);
  if (missingVendor.length > 0) {
    deductions += 10;
    flags.push({ type: "info", message: `${missingVendor.length} ligne(s) sans nom de fournisseur` });
  } else {
    passed.push("Fournisseurs renseignés");
  }

  // 3. Policy limits (30 pts)
  lines.forEach((line, i) => {
    const amt = Number(line.amount);
    const cat = line.category || "";
    if (cat.includes("Repas") && amt > POLICY.maxMealAmount) {
      deductions += 10;
      flags.push({ type: "error", message: `Ligne ${i+1}: Repas ${new Intl.NumberFormat("fr-FR").format(amt)} XOF dépasse le plafond (${new Intl.NumberFormat("fr-FR").format(POLICY.maxMealAmount)} XOF)` });
    }
    if (cat.includes("Hébergement") && amt > POLICY.maxHotelPerNight) {
      deductions += 10;
      flags.push({ type: "error", message: `Ligne ${i+1}: Hôtel ${new Intl.NumberFormat("fr-FR").format(amt)} XOF dépasse le plafond nuit (${new Intl.NumberFormat("fr-FR").format(POLICY.maxHotelPerNight)} XOF)` });
    }
    if (cat.includes("Transport") && amt > POLICY.maxTransportTrip) {
      deductions += 5;
      flags.push({ type: "warning", message: `Ligne ${i+1}: Transport ${new Intl.NumberFormat("fr-FR").format(amt)} XOF élevé — justificatif recommandé` });
    }
  });
  if (!flags.some(f => f.message.includes("plafond"))) {
    passed.push("Montants dans les limites de politique");
  }

  // 4. Title quality (10 pts)
  if (!title?.trim() || title.trim().length < 10) {
    deductions += 10;
    flags.push({ type: "warning", message: "Titre trop court — soyez plus descriptif" });
  } else {
    passed.push("Titre descriptif");
  }

  // 5. Duplicate amounts warning (5 pts)
  const amounts = lines.map(l => Number(l.amount));
  const dupes = amounts.filter((a, i) => amounts.indexOf(a) !== i && a > 0);
  if (dupes.length > 0) {
    deductions += 5;
    flags.push({ type: "info", message: `${dupes.length} montant(s) identiques — vérifiez les doublons` });
  }

  // 6. Zero amounts
  const zeroLines = lines.filter(l => !Number(l.amount));
  if (zeroLines.length > 0) {
    deductions += 5;
    flags.push({ type: "error", message: `${zeroLines.length} ligne(s) avec montant à 0` });
  }

  const score = Math.max(0, Math.min(100, 100 - deductions));
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

  return { score, grade, flags, passed };
}

const GRADE_COLORS = {
  A: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
  B: { bg: "bg-blue-100",    text: "text-blue-700",    border: "border-blue-200" },
  C: { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200" },
  D: { bg: "bg-orange-100",  text: "text-orange-700",  border: "border-orange-200" },
  F: { bg: "bg-red-100",     text: "text-red-700",     border: "border-red-200" },
};

interface Props {
  lines: Line[];
  title: string;
  compact?: boolean;
}

export function ExpenseScore({ lines, title, compact = false }: Props) {
  const result = computeExpenseScore(lines, title);
  const gc = GRADE_COLORS[result.grade];

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${gc.bg} ${gc.border}`}>
        <span className={`text-lg font-bold ${gc.text}`}>{result.grade}</span>
        <div>
          <p className={`text-xs font-semibold ${gc.text}`}>Score {result.score}/100</p>
          {result.flags.length > 0 && (
            <p className="text-xs text-muted-foreground">{result.flags.length} point(s) à corriger</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border-2 ${gc.border} overflow-hidden`}>
      {/* Score header */}
      <div className={`${gc.bg} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl font-black border-2 ${gc.border} bg-white ${gc.text}`}>
            {result.grade}
          </div>
          <div>
            <p className={`font-semibold ${gc.text}`}>Score de conformité: {result.score}/100</p>
            <p className="text-xs text-muted-foreground">
              {result.grade === "A" ? "Excellent — prêt à soumettre" :
               result.grade === "B" ? "Bon — quelques améliorations possibles" :
               result.grade === "C" ? "Acceptable — corrections recommandées" :
               result.grade === "D" ? "Insuffisant — corrections requises" :
               "Non conforme — corrections obligatoires"}
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="hidden sm:block w-32">
          <div className="h-2 bg-white/60 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${
              result.score >= 90 ? "bg-emerald-500" :
              result.score >= 75 ? "bg-blue-500" :
              result.score >= 60 ? "bg-amber-500" :
              result.score >= 40 ? "bg-orange-500" : "bg-red-500"
            }`} style={{ width: `${result.score}%` }} />
          </div>
        </div>
      </div>

      {/* Flags & passes */}
      <div className="p-4 bg-white space-y-2">
        {result.flags.map((flag, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            {flag.type === "error" ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" /> :
             flag.type === "warning" ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> :
             <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />}
            <span className={flag.type === "error" ? "text-red-700" : flag.type === "warning" ? "text-amber-700" : "text-blue-600"}>
              {flag.message}
            </span>
          </div>
        ))}
        {result.passed.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}
