/**
 * TaxSelector — reusable tax line component
 *
 * West Africa / OHADA default tax types:
 *   TVA 18%        — standard VAT (Bénin, Côte d'Ivoire, Sénégal...)
 *   TVA 0%         — exports, exempted
 *   Retenue source — withholding tax 5% (services) or 10% (liberal professions)
 *   AIB            — Acompte sur Impôt des BIC — 1% or 5% advance tax on purchases
 *   TOS            — Taxe sur les Opérations de Sous-traitance 5%
 *   Exonéré        — fully exempt
 */

import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";

export interface TaxLine {
  code: string;
  label: string;
  rate: number;
  type: "vat" | "withholding" | "other";
  amount: number; // calculated
  isWithholding: boolean; // withholding = deducted, not added
}

interface TaxSelectorProps {
  baseAmount: number; // pre-tax total
  value: TaxLine[];
  onChange: (lines: TaxLine[]) => void;
  readOnly?: boolean;
}

// Default OHADA West Africa tax catalogue
const DEFAULT_TAXES: Omit<TaxLine, "amount">[] = [
  { code: "TVA_18",   label: "TVA 18%",                    rate: 18,  type: "vat",         isWithholding: false },
  { code: "TVA_0",    label: "TVA 0% (Export / Exonéré)",  rate: 0,   type: "vat",         isWithholding: false },
  { code: "RS_5",     label: "Retenue source 5% (Services)",rate: 5,  type: "withholding",  isWithholding: true  },
  { code: "RS_10",    label: "Retenue source 10% (Libéral)",rate: 10, type: "withholding",  isWithholding: true  },
  { code: "AIB_1",    label: "AIB 1% (Achats courants)",   rate: 1,   type: "other",        isWithholding: false },
  { code: "AIB_5",    label: "AIB 5% (Marchés publics)",   rate: 5,   type: "other",        isWithholding: false },
  { code: "TOS_5",    label: "TOS 5% (Sous-traitance)",    rate: 5,   type: "other",        isWithholding: false },
  { code: "CUSTOM",   label: "Personnalisé",                rate: 0,   type: "other",        isWithholding: false },
];

const TYPE_LABELS: Record<string, string> = {
  vat: "TVA", withholding: "Retenue à la source", other: "Autre taxe"
};
const TYPE_COLORS: Record<string, string> = {
  vat: "bg-blue-100 text-blue-700",
  withholding: "bg-amber-100 text-amber-700",
  other: "bg-gray-100 text-gray-700",
};

function calcAmount(base: number, rate: number) {
  return Math.round((base * rate / 100) * 100) / 100;
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

export function TaxSelector({ baseAmount, value, onChange, readOnly }: TaxSelectorProps) {
  const [open, setOpen] = useState(false);

  // Get org-configured tax rates (merged with defaults)
  const { data: org } = trpc.settings.getOrganization.useQuery();
  const orgTaxRates = (org as any)?.settings?.taxRates ?? [];

  const catalogue: Omit<TaxLine, "amount">[] = [
    ...DEFAULT_TAXES,
    ...orgTaxRates
      .filter((r: any) => !DEFAULT_TAXES.find(d => d.code === r.code))
      .map((r: any) => ({ code: r.code, label: r.label, rate: r.rate, type: "other" as const, isWithholding: false })),
  ];

  const addTax = (template: Omit<TaxLine, "amount">) => {
    if (value.find(t => t.code === template.code)) return; // already added
    const newLine: TaxLine = { ...template, amount: calcAmount(baseAmount, template.rate) };
    onChange([...value, newLine]);
    setOpen(false);
  };

  // Auto-apply org default tax (or TVA 18%) on first mount
  useEffect(() => {
    if (value.length === 0 && baseAmount > 0) {
      const defaultTax = catalogue.find(t => orgTaxRates.find((r: any) => r.isDefault && r.code === t.code))
        || catalogue.find(t => t.code === "TVA_18");
      if (defaultTax) {
        onChange([{ ...defaultTax, amount: calcAmount(baseAmount, defaultTax.rate) }]);
      }
    }
  }, [baseAmount > 0]);  // only once when amount becomes known

  // Recalculate amounts when baseAmount changes
  useEffect(() => {
    if (value.length > 0) {
      onChange(value.map(t => ({ ...t, amount: calcAmount(baseAmount, t.rate) })));
    }
  }, [baseAmount]);

  const removeTax = (code: string) => onChange(value.filter(t => t.code !== code));
  const updateRate = (code: string, rate: number) => {
    onChange(value.map(t => t.code === code ? { ...t, rate, amount: calcAmount(baseAmount, rate) } : t));
  };

  // Totals
  const totalVAT = value.filter(t => !t.isWithholding).reduce((s, t) => s + t.amount, 0);
  const totalWithholding = value.filter(t => t.isWithholding).reduce((s, t) => s + t.amount, 0);
  const netTotal = baseAmount + totalVAT - totalWithholding;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Taxes</span>
        {!readOnly && (
          <button onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-colors font-medium">
            <Plus className="h-3.5 w-3.5" />
            {open ? "Fermer" : "Ajouter une taxe"}
          </button>
        )}
      </div>

      {/* Catalogue — shown inline when open */}
      {open && !readOnly && (
        <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="px-3 py-2 bg-gray-50 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Catalogue fiscal OHADA — Afrique de l'Ouest</p>
          </div>
          <div className="divide-y">
            {catalogue.map(tax => {
              const already = !!value.find(t => t.code === tax.code);
              return (
                <button key={tax.code} onClick={() => addTax(tax)} disabled={already}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed">
                  <div>
                    <p className="text-sm font-medium">{tax.label}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[tax.type]}`}>
                      {TYPE_LABELS[tax.type]}{tax.isWithholding ? " · à déduire" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-700">{tax.rate}%</span>
                    {already
                      ? <span className="text-xs text-emerald-600 font-medium">✓ Ajouté</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">+ Ajouter</span>
                    }
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Applied tax lines */}
      {value.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {value.map(tax => (
            <div key={tax.code} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${TYPE_COLORS[tax.type]}`}>
                {tax.isWithholding ? "↓ RS" : "TVA"}
              </span>
              <span className="text-sm flex-1 text-gray-700">{tax.label}</span>
              {tax.code === "CUSTOM" && !readOnly ? (
                <input type="number" value={tax.rate} min={0} max={100} step={0.1}
                  onChange={e => updateRate(tax.code, parseFloat(e.target.value) || 0)}
                  className="w-16 text-sm text-right border rounded px-2 py-0.5" />
              ) : (
                <span className="text-sm font-medium text-gray-600 w-12 text-right">{tax.rate}%</span>
              )}
              <span className={`text-sm font-semibold w-28 text-right ${tax.isWithholding ? "text-amber-700" : "text-blue-700"}`}>
                {tax.isWithholding ? "-" : "+"}{fmt(tax.amount)} XOF
              </span>
              {!readOnly && (
                <button onClick={() => removeTax(tax.code)}
                  className="text-muted-foreground hover:text-red-500 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {value.length > 0 && (
        <div className="border-t pt-3 space-y-1.5">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Montant HT</span>
            <span className="font-medium">{fmt(baseAmount)} XOF</span>
          </div>
          {totalVAT > 0 && (
            <div className="flex justify-between text-sm text-blue-700">
              <span>TVA / Taxes</span>
              <span className="font-medium">+{fmt(totalVAT)} XOF</span>
            </div>
          )}
          {totalWithholding > 0 && (
            <div className="flex justify-between text-sm text-amber-700">
              <span>Retenue à la source</span>
              <span className="font-medium">−{fmt(totalWithholding)} XOF</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold border-t pt-1.5">
            <span>Net à payer</span>
            <span className="text-gray-900">{fmt(netTotal)} XOF</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Simplified read-only tax display for detail pages
export function TaxSummary({ taxes, baseAmount }: { taxes: TaxLine[]; baseAmount: number }) {
  if (!taxes || taxes.length === 0) return null;
  return <TaxSelector baseAmount={baseAmount} value={taxes} onChange={() => {}} readOnly />;
}
