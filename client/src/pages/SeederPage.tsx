/**
 * Demo Data Seeder — admin only
 * Resets the environment to a known, realistic state for E2E testing
 * Access: /admin/seed
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Database, Play, Trash2, CheckCircle2, XCircle, AlertTriangle,
  ShoppingCart, Building2, FileText, BarChart2, Receipt, Scale,
  Zap, ArrowLeft, RefreshCw, Package
} from "lucide-react";

type Scenario = "vendors" | "budgets" | "full_cycle" | "rfq_cycle" | "expenses" | "contracts" | "edge_cases";

const SCENARIOS: { id: Scenario; label: string; desc: string; icon: any; color: string; default: boolean }[] = [
  { id: "vendors",    label: "Fournisseurs",    desc: "6 fournisseurs actifs avec scores et niveaux de risque", icon: Building2,    color: "text-blue-600",   default: true },
  { id: "budgets",    label: "Budgets",         desc: "3 budgets annuels (IT, Fournitures, Opérationnel)",      icon: BarChart2,    color: "text-purple-600", default: true },
  { id: "full_cycle", label: "Cycle P2P complet",desc: "DA → BC → Réception → Facture → Paiement (cycle complet)", icon: Zap,      color: "text-emerald-600",default: true },
  { id: "rfq_cycle",  label: "Appel d'offres",  desc: "AO avec 3 fournisseurs invités, 2 réponses reçues",     icon: Scale,        color: "text-amber-600",  default: false },
  { id: "expenses",   label: "Notes de frais",  desc: "2 notes (en attente, approuvée)",                        icon: Receipt,      color: "text-orange-600", default: false },
  { id: "contracts",  label: "Contrats",        desc: "3 contrats dont 1 expirant dans 30 jours",               icon: FileText,     color: "text-cyan-600",   default: false },
  { id: "edge_cases", label: "Cas limites",     desc: "Facture en retard, DA refusée, facture contestée",       icon: AlertTriangle,color: "text-red-600",    default: false },
];

export default function SeederPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [clearExisting, setClearExisting] = useState(false);
  const [selected, setSelected] = useState<Scenario[]>(
    SCENARIOS.filter(s => s.default).map(s => s.id)
  );
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const { data: state, refetch: refetchState } = trpc.seeder.getState.useQuery();

  const seedMut = trpc.seeder.seed.useMutation({
    onSuccess: (data) => {
      setLog(data.log);
      setDone(true);
      refetchState();
      toast.success(data.summary);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="font-semibold">Accès refusé</p>
          <p className="text-sm text-muted-foreground mt-1">Réservé aux administrateurs</p>
        </div>
      </div>
    );
  }

  const toggle = (id: Scenario) => {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleSeed = () => {
    if (selected.length === 0) { toast.error("Sélectionnez au moins un scénario"); return; }
    setLog([]);
    setDone(false);
    seedMut.mutate({ clearExisting, scenarios: selected });
  };

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* Topbar */}
      <div className="sticky top-0 z-30 bg-white border-b px-6 py-3 flex items-center gap-3">
        <button onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Tableau de bord
        </button>
        <span className="text-muted-foreground/40">›</span>
        <span className="text-sm font-medium">Données de démonstration</span>
        <div className="ml-auto">
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
            Admin uniquement
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
            <Database className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Données de démonstration</h1>
            <p className="text-muted-foreground mt-1">
              Réinitialise l'environnement avec des données réalistes pour les tests end-to-end.
              Idéal avant une démo client ou une session de QA.
            </p>
          </div>
        </div>

        {/* Current state */}
        {state && (
          <div className="bg-white rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">État actuel de l'environnement</h2>
              <button onClick={() => refetchState()}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RefreshCw className="h-3.5 w-3.5" />Rafraîchir
              </button>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: "Fournisseurs", value: state.vendors,          icon: Building2 },
                { label: "Demandes",     value: state.purchaseRequests, icon: FileText },
                { label: "Bons de cmd",  value: state.purchaseOrders,   icon: ShoppingCart },
                { label: "Factures",     value: state.invoices,         icon: Receipt },
                { label: "Paiements",    value: state.payments,         icon: Package },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="text-center">
                  <Icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Options */}
        <div className="bg-white rounded-2xl border p-5 space-y-4">
          <h2 className="font-semibold">Configuration</h2>

          {/* Clear option */}
          <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            clearExisting ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-gray-300"
          }`}>
            <input type="checkbox" checked={clearExisting} onChange={e => setClearExisting(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-red-500" />
            <div>
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-red-500" />
                <span className="font-medium text-sm">Effacer les données existantes</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Supprime toutes les DA, BC, factures, paiements et fournisseurs avant de générer les nouvelles données.
                Les utilisateurs et workflows sont conservés.
              </p>
            </div>
          </label>

          {/* Scenarios */}
          <div>
            <p className="text-sm font-medium mb-3">Scénarios à générer</p>
            <div className="space-y-2">
              {SCENARIOS.map(s => {
                const Icon = s.icon;
                const isSelected = selected.includes(s.id);
                return (
                  <label key={s.id} className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected ? "border-blue-300 bg-blue-50/40" : "border-gray-200 hover:border-gray-300"
                  }`}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(s.id)}
                      className="mt-0.5 h-4 w-4 accent-blue-600" />
                    <div className="flex items-start gap-2.5 flex-1">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${s.color}`} />
                      <div>
                        <span className="font-medium text-sm">{s.label}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action */}
        <button onClick={handleSeed} disabled={seedMut.isPending || selected.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl btn-primary text-white font-semibold text-sm disabled:opacity-50 transition-opacity">
          {seedMut.isPending
            ? <><RefreshCw className="h-4 w-4 animate-spin" />Génération en cours...</>
            : <><Play className="h-4 w-4" />Générer les données de démonstration</>}
        </button>

        {/* Log output */}
        {(log.length > 0 || done) && (
          <div className="bg-gray-900 rounded-2xl p-5 font-mono text-sm">
            <div className="flex items-center gap-2 mb-3 text-gray-400 text-xs uppercase tracking-wide">
              <Database className="h-3.5 w-3.5" />
              Journal d'exécution
            </div>
            <div className="space-y-1.5">
              {log.map((entry, i) => (
                <div key={i} className={`flex items-start gap-2 ${
                  entry.startsWith("✅") ? "text-emerald-400" :
                  entry.startsWith("⚠️") ? "text-amber-400" :
                  entry.startsWith("❌") ? "text-red-400" : "text-gray-300"
                }`}>
                  <span className="shrink-0">›</span>
                  <span>{entry}</span>
                </div>
              ))}
            </div>
            {done && (
              <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-semibold">Données générées avec succès</span>
                </div>
                <button onClick={() => setLocation("/dashboard")}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                  Aller au tableau de bord →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
