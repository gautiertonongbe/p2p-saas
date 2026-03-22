/**
 * E2E Test Checklist — admin only at /admin/checklist
 * Living document for systematic end-to-end testing
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2, XCircle, Circle, ChevronDown, ChevronRight,
  ArrowLeft, ExternalLink, RefreshCw, AlertTriangle, Database
} from "lucide-react";

type Status = "untested" | "pass" | "fail" | "skip";

interface TestCase {
  id: string;
  name: string;
  steps: string[];
  expected: string;
  url?: string;
}

interface TestGroup {
  id: string;
  name: string;
  icon: string;
  tests: TestCase[];
}

const TEST_GROUPS: TestGroup[] = [
  {
    id: "auth", name: "Authentification", icon: "🔐",
    tests: [
      { id: "auth-1", name: "Login admin", steps: ["Aller sur /", "Entrer admin@demo.com / Admin1234!"], expected: "Redirigé vers le dashboard", url: "/" },
      { id: "auth-2", name: "Login manager", steps: ["Se déconnecter", "Entrer manager@demo.com / Manager1234!"], expected: "Dashboard avec droits manager" },
      { id: "auth-3", name: "Login approver", steps: ["Se déconnecter", "Entrer approver@demo.com / Manager1234!"], expected: "Dashboard avec droits approbateur" },
      { id: "auth-4", name: "Login requester", steps: ["Se déconnecter", "Entrer requester@demo.com / Manager1234!"], expected: "Dashboard avec droits demandeur" },
      { id: "auth-5", name: "Accès refusé non-admin", steps: ["Connecté en tant que requester", "Aller sur /settings"], expected: "Accès refusé ou redirection" },
    ]
  },
  {
    id: "da", name: "Demandes d'achat (DA)", icon: "📋",
    tests: [
      { id: "da-1", name: "Créer une DA", steps: ["Aller sur /purchase-requests/new", "Remplir titre, urgence, articles", "Cliquer Soumettre"], expected: "DA créée, statut = Soumis", url: "/purchase-requests/new" },
      { id: "da-2", name: "Brouillon puis soumettre", steps: ["Créer DA", "Cliquer Brouillon", "Ouvrir la DA", "Cliquer Soumettre"], expected: "Statut passe de Brouillon à Soumis" },
      { id: "da-3", name: "Approuver une DA", steps: ["Connecté en tant qu'approver", "Aller sur /approvals", "Approuver une DA en attente"], expected: "DA passe à Approuvée, BC créable", url: "/approvals" },
      { id: "da-4", name: "Rejeter une DA", steps: ["Connecté en tant qu'approver", "Rejeter avec motif"], expected: "DA passe à Refusée, motif affiché" },
      { id: "da-5", name: "Corriger DA refusée", steps: ["DA refusée visible", "Cliquer Corriger & resoumettre", "Modifier et resoumettre"], expected: "DA repasse en Soumis" },
      { id: "da-6", name: "Modifier DA brouillon", steps: ["Ouvrir DA brouillon", "Cliquer Modifier", "Changer titre et montant", "Sauvegarder"], expected: "DA mise à jour, mêmes champs visibles" },
    ]
  },
  {
    id: "po", name: "Bons de commande (BC)", icon: "🛒",
    tests: [
      { id: "po-1", name: "Créer un BC depuis DA approuvée", steps: ["DA approuvée", "Cliquer Créer un BC", "Sélectionner fournisseur", "Créer"], expected: "BC créé, DA passe à Convertie", url: "/purchase-orders/new" },
      { id: "po-2", name: "Émettre un BC", steps: ["BC en brouillon", "Cliquer Émettre"], expected: "BC passe à Émis" },
      { id: "po-3", name: "Enregistrer réception complète", steps: ["BC approuvé", "Cliquer Enregistrer réception", "Toutes les quantités", "Confirmer"], expected: "BC passe à Réceptionné" },
      { id: "po-4", name: "Réception partielle", steps: ["BC approuvé avec 2 articles", "Réceptionner 50% du premier article"], expected: "BC passe à Partiellement réceptionné, reste visible" },
      { id: "po-5", name: "Réceptionner le reste", steps: ["BC partiellement reçu", "Cliquer Enregistrer réception", "Reste affiché en placeholder"], expected: "BC passe à Réceptionné" },
      { id: "po-6", name: "Taxes sur BC", steps: ["Créer BC", "Ajouter TVA 18%", "Vérifier total TTC"], expected: "Total HT + TVA = Total TTC affiché" },
    ]
  },
  {
    id: "invoice", name: "Factures", icon: "🧾",
    tests: [
      { id: "inv-1", name: "Créer facture depuis BC", steps: ["BC réceptionné", "Cliquer Créer une facture", "Remplir les champs"], expected: "Facture créée liée au BC, rapprochement lancé", url: "/invoices/new" },
      { id: "inv-2", name: "Rapprochement 3 voies", steps: ["Facture créée sur BC", "Cliquer Lancer le rapprochement"], expected: "Fournisseur ✅ Montant ✅ Réception ✅" },
      { id: "inv-3", name: "Approuver facture", steps: ["Facture en attente", "Approuver en tant qu'admin"], expected: "Facture passe à Approuvée" },
      { id: "inv-4", name: "Modifier facture pending", steps: ["Facture en attente", "Cliquer Modifier dans topbar"], expected: "Même page, champs éditables directement" },
      { id: "inv-5", name: "Marquer comme payée", steps: ["Facture approuvée", "Cliquer Marquer comme payée"], expected: "Facture passe à Payée, paiement créé" },
      { id: "inv-6", name: "Annuler facture", steps: ["Facture pending ou approuvée", "Cliquer Annuler la facture", "Entrer motif"], expected: "Facture annulée, historique mis à jour" },
      { id: "inv-7", name: "Facture directe (sans BC)", steps: ["Nouvelle facture", "Laisser BC vide", "Créer"], expected: "Facture créée sans BC associé" },
    ]
  },
  {
    id: "workflow", name: "Workflows d'approbation", icon: "⚡",
    tests: [
      { id: "wf-1", name: "Créer workflow", steps: ["Aller /workflow-builder", "Nouvelle politique", "Ajouter étape Approbateur", "Sauvegarder"], expected: "Workflow actif visible dans la liste", url: "/workflow-builder" },
      { id: "wf-2", name: "Modifier workflow", steps: ["Cliquer Modifier sur un workflow", "Changer le nom", "Sauvegarder"], expected: "Nom mis à jour" },
      { id: "wf-3", name: "Désactiver workflow", steps: ["Cliquer Désactiver"], expected: "Statut passe à Inactif, badge gris" },
      { id: "wf-4", name: "Supprimer workflow", steps: ["Cliquer Supprimer", "Confirmer"], expected: "Workflow disparu de la liste" },
      { id: "wf-5", name: "DA déclenche workflow", steps: ["Workflow actif pour tous montants", "Soumettre une DA"], expected: "Approbation créée, chaîne visible" },
    ]
  },
  {
    id: "vendors", name: "Fournisseurs", icon: "🏢",
    tests: [
      { id: "v-1", name: "Créer fournisseur", steps: ["Aller /vendors/new", "Remplir nom, pays, IFU"], expected: "Fournisseur créé, visible dans liste", url: "/vendors" },
      { id: "v-2", name: "Évaluation risque", steps: ["Ouvrir fournisseur", "Aller Risque", "Lancer évaluation"], expected: "Score calculé, niveau affiché" },
      { id: "v-3", name: "Désactiver fournisseur", steps: ["Fournisseur actif", "Cliquer Désactiver"], expected: "Statut Inactif, non sélectionnable dans BC" },
      { id: "v-4", name: "Tri asc/desc", steps: ["Liste fournisseurs", "Cliquer bouton tri Date"], expected: "Liste inversée" },
    ]
  },
  {
    id: "payments", name: "Paiements", icon: "💳",
    tests: [
      { id: "pay-1", name: "Voir détail paiement", steps: ["Liste paiements", "Cliquer Voir le paiement"], expected: "Page détail avec montant, mode, référence", url: "/payments" },
      { id: "pay-2", name: "Voir facture liée", steps: ["Détail paiement", "Cliquer Voir la facture"], expected: "Redirigé vers la facture" },
    ]
  },
  {
    id: "expenses", name: "Notes de frais", icon: "🧾",
    tests: [
      { id: "exp-1", name: "Créer note de frais", steps: ["Aller /expenses/new", "Remplir titre, lignes", "Sauvegarder brouillon"], expected: "Note créée, score compliance affiché", url: "/expenses/new" },
      { id: "exp-2", name: "Soumettre pour approbation", steps: ["Note brouillon", "Cliquer Soumettre"], expected: "Statut = Soumis" },
      { id: "exp-3", name: "Approuver note de frais", steps: ["Connecté manager", "Approuver note soumise"], expected: "Statut = Approuvé" },
      { id: "exp-4", name: "Rejeter note de frais", steps: ["Connecté manager", "Cliquer Rejeter"], expected: "Confirmation demandée, statut = Refusé" },
    ]
  },
  {
    id: "savings", name: "Économies", icon: "📈",
    tests: [
      { id: "sav-1", name: "Économie auto BC vs DA", steps: ["Créer DA 1 000 000 XOF", "Créer BC 800 000 XOF", "Aller /savings"], expected: "Économie 200 000 XOF (20%) enregistrée auto", url: "/savings" },
      { id: "sav-2", name: "Saisie manuelle", steps: ["Cliquer Saisie manuelle", "Budget 500 000, Réel 400 000"], expected: "Économie 100 000 XOF enregistrée" },
    ]
  },
  {
    id: "settings", name: "Paramètres", icon: "⚙️",
    tests: [
      { id: "set-1", name: "Changer couleur org", steps: ["Paramètres → Organisation", "Choisir Violet", "Sauvegarder"], expected: "Interface change de couleur", url: "/settings" },
      { id: "set-2", name: "Ajouter utilisateur", steps: ["Paramètres → Utilisateurs", "Inviter nouveau"], expected: "Utilisateur ajouté avec bon rôle" },
      { id: "set-3", name: "Configurer taux de taxe", steps: ["Paramètres → Finance → Taux de taxes", "Vérifier TVA 18%"], expected: "7 taux OHADA présents" },
      { id: "set-4", name: "Tri asc/desc sur listes", steps: ["N'importe quelle liste", "Cliquer bouton tri"], expected: "Liste inversée immédiatement" },
    ]
  },
];

function StatusIcon({ status }: { status: Status }) {
  if (status === "pass")     return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />;
  if (status === "fail")     return <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
  if (status === "skip")     return <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />;
  return <Circle className="h-5 w-5 text-gray-300 shrink-0" />;
}

export default function E2EChecklist() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [results, setResults] = useState<Record<string, Status>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ auth: true });
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  const { data: state } = trpc.seeder.getState.useQuery();

  if (user?.role !== "admin") return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <XCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <p className="font-semibold">Accès refusé — Admin uniquement</p>
      </div>
    </div>
  );

  const setResult = (id: string, status: Status) => {
    setResults(prev => ({ ...prev, [id]: status }));
  };

  const allTests = TEST_GROUPS.flatMap(g => g.tests);
  const passed = allTests.filter(t => results[t.id] === "pass").length;
  const failed = allTests.filter(t => results[t.id] === "fail").length;
  const skipped = allTests.filter(t => results[t.id] === "skip").length;
  const untested = allTests.length - passed - failed - skipped;
  const pct = Math.round((passed / allTests.length) * 100);

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* Topbar */}
      <div className="sticky top-0 z-30 bg-white border-b px-6 py-3 flex items-center gap-3">
        <button onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Dashboard
        </button>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
        <span className="text-sm font-medium">Checklist E2E</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{passed}/{allTests.length} tests passés</span>
          <div className="flex items-center gap-1">
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold text-emerald-700">{pct}%</span>
          </div>
          <button onClick={() => setLocation("/admin/seed")}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border text-muted-foreground hover:bg-muted transition-colors">
            <Database className="h-3.5 w-3.5" />Seeder
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total",    value: allTests.length, color: "text-gray-700",    bg: "bg-gray-100" },
            { label: "✅ Passé",  value: passed,          color: "text-emerald-700", bg: "bg-emerald-100" },
            { label: "❌ Échoué", value: failed,          color: "text-red-700",     bg: "bg-red-100" },
            { label: "⏭ Sauté",  value: skipped,         color: "text-amber-700",   bg: "bg-amber-100" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl p-4 text-center`}>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className={`text-xs font-medium ${color} mt-0.5`}>{label}</p>
            </div>
          ))}
        </div>

        {/* Data state */}
        {state && (
          <div className="bg-white rounded-2xl border p-4 flex items-center gap-4 text-sm">
            <Database className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Données actuelles:</span>
            <span><strong>{state.vendors}</strong> fournisseurs</span>
            <span><strong>{state.purchaseRequests}</strong> DAs</span>
            <span><strong>{state.purchaseOrders}</strong> BCs</span>
            <span><strong>{state.invoices}</strong> factures</span>
            <span><strong>{state.payments}</strong> paiements</span>
            {state.purchaseRequests === 0 && (
              <button onClick={() => setLocation("/admin/seed")}
                className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                Générer données test →
              </button>
            )}
          </div>
        )}

        {/* Test groups */}
        {TEST_GROUPS.map(group => {
          const groupTests = group.tests;
          const groupPassed = groupTests.filter(t => results[t.id] === "pass").length;
          const groupFailed = groupTests.filter(t => results[t.id] === "fail").length;
          const isExpanded = expanded[group.id];

          return (
            <div key={group.id} className="bg-white rounded-2xl border overflow-hidden">
              <button
                onClick={() => setExpanded(prev => ({ ...prev, [group.id]: !isExpanded }))}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors">
                <span className="text-lg">{group.icon}</span>
                <span className="font-semibold text-sm flex-1 text-left">{group.name}</span>
                <div className="flex items-center gap-2 text-xs">
                  {groupFailed > 0 && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">{groupFailed} échoué(s)</span>}
                  {groupPassed > 0 && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">{groupPassed}/{groupTests.length}</span>}
                  <span className="text-muted-foreground">{groupTests.length} tests</span>
                </div>
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>

              {isExpanded && (
                <div className="divide-y border-t">
                  {group.tests.map(test => {
                    const status = results[test.id] || "untested";
                    const isOpen = expandedTest === test.id;

                    return (
                      <div key={test.id} className={`${status === "fail" ? "bg-red-50/40" : status === "pass" ? "bg-emerald-50/20" : ""}`}>
                        <div className="flex items-center gap-3 px-5 py-3">
                          <StatusIcon status={status} />
                          <button
                            onClick={() => setExpandedTest(isOpen ? null : test.id)}
                            className="flex-1 text-left text-sm font-medium hover:text-blue-600 transition-colors">
                            {test.name}
                          </button>
                          {test.url && (
                            <button onClick={() => setLocation(test.url!)}
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" />Ouvrir
                            </button>
                          )}
                          <div className="flex items-center gap-1 shrink-0">
                            {(["pass","fail","skip","untested"] as Status[]).map(s => (
                              <button key={s} onClick={() => setResult(test.id, s)}
                                className={`text-xs px-2 py-1 rounded-lg border transition-colors font-medium ${
                                  status === s
                                    ? s === "pass"     ? "bg-emerald-500 border-emerald-500 text-white"
                                    : s === "fail"     ? "bg-red-500 border-red-500 text-white"
                                    : s === "skip"     ? "bg-amber-400 border-amber-400 text-white"
                                    :                    "bg-gray-200 border-gray-200 text-gray-600"
                                    : "border-gray-200 text-gray-400 hover:border-gray-300"
                                }`}>
                                {s === "pass" ? "✅" : s === "fail" ? "❌" : s === "skip" ? "⏭" : "○"}
                              </button>
                            ))}
                          </div>
                        </div>

                        {isOpen && (
                          <div className="px-14 pb-4 space-y-2">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Étapes</p>
                              <ol className="space-y-1">
                                {test.steps.map((step, i) => (
                                  <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                                    <span className="h-4 w-4 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center shrink-0 text-[10px] font-bold">{i+1}</span>
                                    {step}
                                  </li>
                                ))}
                              </ol>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Résultat attendu</p>
                              <p className="text-xs text-gray-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                                ✓ {test.expected}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
