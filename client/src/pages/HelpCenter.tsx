import { useState } from "react";
import { Link } from "wouter";
import {
  Search, BookOpen, Video, MessageSquare, ChevronRight,
  FileText, ShoppingCart, Receipt, Users, CheckCircle,
  DollarSign, BarChart2, Package, Zap, ArrowRight,
  ThumbsUp, ThumbsDown, ExternalLink, ChevronDown, Star,
  HelpCircle, PlayCircle, Book, Lightbulb, Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";

// ── Data ─────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    id: "getting-started",
    label: "Démarrage rapide",
    icon: Zap,
    color: "blue",
    description: "Premiers pas sur la plateforme",
    articles: [
      { id: "gs-1", title: "Créer votre première demande d'achat", duration: "3 min", popular: true },
      { id: "gs-2", title: "Comprendre le workflow d'approbation", duration: "5 min", popular: true },
      { id: "gs-3", title: "Naviguer dans le tableau de bord", duration: "2 min" },
      { id: "gs-4", title: "Configurer votre profil et préférences", duration: "2 min" },
      { id: "gs-5", title: "Inviter des collègues dans votre organisation", duration: "4 min" },
    ]
  },
  {
    id: "purchase-requests",
    label: "Demandes d'achat",
    icon: FileText,
    color: "purple",
    description: "Créer et gérer vos réquisitions",
    articles: [
      { id: "pr-1", title: "Créer une demande d'achat", duration: "4 min", popular: true },
      { id: "pr-2", title: "Ajouter des articles à une demande", duration: "3 min" },
      { id: "pr-3", title: "Modifier une demande en brouillon", duration: "2 min" },
      { id: "pr-4", title: "Soumettre pour approbation", duration: "2 min" },
      { id: "pr-5", title: "Copier une demande existante", duration: "2 min" },
      { id: "pr-6", title: "Suivre le statut de votre demande", duration: "3 min" },
    ]
  },
  {
    id: "approvals",
    label: "Approbations",
    icon: CheckCircle,
    color: "amber",
    description: "Gérer les flux d'approbation",
    articles: [
      { id: "ap-1", title: "Approuver ou refuser une demande", duration: "3 min", popular: true },
      { id: "ap-2", title: "Configurer une politique d'approbation", duration: "6 min" },
      { id: "ap-3", title: "Comprendre la chaîne d'approbation", duration: "4 min" },
      { id: "ap-4", title: "Approbation directe (admin)", duration: "2 min" },
      { id: "ap-5", title: "Déléguer une approbation", duration: "3 min" },
    ]
  },
  {
    id: "purchase-orders",
    label: "Bons de commande",
    icon: ShoppingCart,
    color: "cyan",
    description: "Émettre et suivre vos commandes",
    articles: [
      { id: "po-1", title: "Créer un bon de commande depuis une demande", duration: "4 min", popular: true },
      { id: "po-2", title: "Émettre un bon de commande", duration: "3 min" },
      { id: "po-3", title: "Enregistrer une réception de marchandises", duration: "4 min" },
      { id: "po-4", title: "Créer une facture depuis un BC", duration: "3 min" },
    ]
  },
  {
    id: "invoices",
    label: "Factures",
    icon: Receipt,
    color: "emerald",
    description: "Traiter et approuver les factures",
    articles: [
      { id: "inv-1", title: "Saisir une facture fournisseur", duration: "5 min", popular: true },
      { id: "inv-2", title: "Scanner une facture avec l'OCR", duration: "3 min" },
      { id: "inv-3", title: "Comprendre le rapprochement 3 voies", duration: "6 min" },
      { id: "inv-4", title: "Approuver et marquer comme payée", duration: "3 min" },
      { id: "inv-5", title: "Contester une facture", duration: "4 min" },
    ]
  },
  {
    id: "vendors",
    label: "Fournisseurs",
    icon: Users,
    color: "pink",
    description: "Gérer votre base fournisseurs",
    articles: [
      { id: "vnd-1", title: "Ajouter un nouveau fournisseur", duration: "5 min" },
      { id: "vnd-2", title: "Évaluer la performance fournisseur", duration: "4 min" },
      { id: "vnd-3", title: "Gérer les coordonnées bancaires", duration: "3 min" },
      { id: "vnd-4", title: "Utiliser le portail fournisseur", duration: "5 min" },
    ]
  },
  {
    id: "budgets",
    label: "Budgets & Finances",
    icon: DollarSign,
    color: "orange",
    description: "Contrôle budgétaire et dépenses",
    articles: [
      { id: "bud-1", title: "Créer et allouer un budget", duration: "5 min" },
      { id: "bud-2", title: "Comprendre les alertes budgétaires", duration: "3 min" },
      { id: "bud-3", title: "Analyser les dépenses par département", duration: "4 min" },
    ]
  },
  {
    id: "analytics",
    label: "Rapports & Analyses",
    icon: BarChart2,
    color: "indigo",
    description: "Tableaux de bord et indicateurs",
    articles: [
      { id: "ana-1", title: "Naviguer dans le tableau d'analyse", duration: "4 min" },
      { id: "ana-2", title: "Créer un rapport personnalisé", duration: "6 min" },
      { id: "ana-3", title: "Exporter des données en PDF", duration: "2 min" },
    ]
  },
];

const FAQS = [
  {
    q: "Comment fonctionne le workflow d'approbation ?",
    a: "Lorsqu'une demande d'achat est soumise, elle suit automatiquement la politique d'approbation configurée pour votre organisation. Chaque approbateur reçoit une notification et peut approuver, refuser ou déléguer. Le statut est mis à jour en temps réel."
  },
  {
    q: "Puis-je modifier une demande après soumission ?",
    a: "Une demande en statut 'En attente d'approbation' ne peut plus être modifiée directement. Vous pouvez contacter l'approbateur pour l'annuler, puis créer une nouvelle demande ou copier l'existante."
  },
  {
    q: "Comment fonctionne le rapprochement 3 voies ?",
    a: "Le rapprochement 3 voies compare automatiquement le bon de commande, le bon de réception et la facture. Si les montants et quantités correspondent (dans les tolérances configurées), la facture est marquée 'Conforme'. Sinon, une révision manuelle est requise."
  },
  {
    q: "Comment configurer les limites d'approbation ?",
    a: "Dans Paramètres > Politiques d'approbation, vous pouvez définir des étapes d'approbation avec des montants seuils. Par exemple : le manager approuve jusqu'à 500 000 XOF, le directeur jusqu'à 2 000 000 XOF, le DG au-delà."
  },
  {
    q: "Qu'est-ce que la codification comptable ?",
    a: "La codification comptable (compte GL, centre de coûts, projet) permet d'imputer les dépenses aux bons comptes dans votre système comptable. Elle est configurable dans Paramètres > Codification comptable."
  },
  {
    q: "Comment inviter un fournisseur sur le portail ?",
    a: "Dans la fiche fournisseur, cliquez sur 'Portail fournisseur' et envoyez une invitation par email. Le fournisseur pourra y soumettre des factures et suivre le statut de ses paiements."
  },
];

const COLOR_MAP: Record<string, { bg: string; icon: string; text: string; border: string }> = {
  blue:    { bg: "bg-blue-50",    icon: "text-blue-600",    text: "text-blue-700",    border: "border-blue-200" },
  purple:  { bg: "bg-purple-50",  icon: "text-purple-600",  text: "text-purple-700",  border: "border-purple-200" },
  amber:   { bg: "bg-amber-50",   icon: "text-amber-600",   text: "text-amber-700",   border: "border-amber-200" },
  cyan:    { bg: "bg-cyan-50",    icon: "text-cyan-600",    text: "text-cyan-700",    border: "border-cyan-200" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", text: "text-emerald-700", border: "border-emerald-200" },
  pink:    { bg: "bg-pink-50",    icon: "text-pink-600",    text: "text-pink-700",    border: "border-pink-200" },
  orange:  { bg: "bg-orange-50",  icon: "text-orange-600",  text: "text-orange-700",  border: "border-orange-200" },
  indigo:  { bg: "bg-indigo-50",  icon: "text-indigo-600",  text: "text-indigo-700",  border: "border-indigo-200" },
};

// ── Article Detail Modal ──────────────────────────────────────────────────────
function ArticleModal({ article, category, onClose }: { article: any; category: any; onClose: () => void }) {
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const c = COLOR_MAP[category.color] || COLOR_MAP.blue;

  // Article content map
  const CONTENT: Record<string, string[]> = {
    "gs-1": [
      "Une demande d'achat (DA) est le point de départ de tout achat dans l'organisation.",
      "1. Cliquez sur **Nouvelle demande** depuis le tableau de bord ou le menu Achats.",
      "2. Saisissez un **titre clair** décrivant l'objet de l'achat (ex: 'Achat fournitures bureau Q2').",
      "3. Ajoutez les **articles** avec leur quantité et prix unitaire estimé.",
      "4. Renseignez le **département**, le niveau d'**urgence** et la **justification**.",
      "5. Cliquez sur **Enregistrer brouillon** pour sauvegarder, ou **Soumettre pour approbation** pour lancer le workflow.",
      "💡 Conseil : Soyez précis dans la justification — cela accélère le processus d'approbation."
    ],
    "inv-3": [
      "Le rapprochement 3 voies est une vérification automatique qui compare :",
      "• **Le bon de commande (BC)** : ce qui a été commandé et à quel prix",
      "• **Le bon de réception** : ce qui a réellement été reçu",
      "• **La facture fournisseur** : ce qui est réclamé au paiement",
      "Si les trois documents concordent dans les tolérances configurées (ex: ±5%), la facture est automatiquement marquée **Conforme** et peut être approuvée.",
      "En cas d'écart, la facture passe en **Révision manuelle**. Vous pouvez alors :",
      "• Contester la facture et demander une correction au fournisseur",
      "• Approuver manuellement si l'écart est justifié",
      "💡 Conseil : Configurez les tolérances dans Paramètres > Tolérances de rapprochement."
    ],
  };

  const steps = CONTENT[article.id] || [
    `Cette fonctionnalité vous permet de ${article.title.toLowerCase()}.`,
    "Naviguez vers la section correspondante dans le menu latéral.",
    "Suivez les étapes indiquées à l'écran.",
    "En cas de doute, contactez votre administrateur système.",
    "💡 Conseil : La plupart des actions peuvent être annulées depuis l'historique du document."
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-background rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`${c.bg} px-6 py-5 rounded-t-2xl border-b ${c.border}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-xl bg-white/80 flex items-center justify-center`}>
                <category.icon className={`h-5 w-5 ${c.icon}`} />
              </div>
              <div>
                <p className={`text-xs font-medium ${c.icon} mb-0.5`}>{category.label}</p>
                <h2 className="text-lg font-bold text-foreground">{article.title}</h2>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl font-light mt-1">×</button>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />{article.duration} de lecture
            </span>
            {article.popular && (
              <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                <Star className="h-3 w-3" />Populaire
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-3">
          {steps.map((step, i) => (
            <p key={i} className="text-sm text-foreground leading-relaxed">
              {step.replace(/\*\*(.*?)\*\*/g, '$1')}
            </p>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 rounded-b-2xl">
          {helpful === null ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Cet article vous a-t-il été utile ?</span>
              <button onClick={() => setHelpful(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-emerald-50 hover:border-emerald-200 text-sm transition-colors">
                <ThumbsUp className="h-3.5 w-3.5 text-emerald-600" />Oui
              </button>
              <button onClick={() => setHelpful(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-red-50 hover:border-red-200 text-sm transition-colors">
                <ThumbsDown className="h-3.5 w-3.5 text-red-500" />Non
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {helpful ? "✅ Merci pour votre retour !" : "📝 Merci. Nous améliorerons cet article."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FAQ Item ──────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b last:border-0">
      <button className="w-full flex items-center justify-between py-4 text-left gap-4" onClick={() => setOpen(!open)}>
        <span className="text-sm font-medium">{q}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="text-sm text-muted-foreground pb-4 leading-relaxed">{a}</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HelpCenter() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<{ article: any; category: any } | null>(null);

  const filtered = search.trim().length > 1
    ? CATEGORIES.flatMap(cat =>
        cat.articles
          .filter(a => a.title.toLowerCase().includes(search.toLowerCase()))
          .map(a => ({ article: a, category: cat }))
      )
    : [];

  const popular = CATEGORIES.flatMap(cat =>
    cat.articles.filter(a => a.popular).map(a => ({ article: a, category: cat }))
  ).slice(0, 6);

  const activeCategory = CATEGORIES.find(c => c.id === selectedCategory);

  return (
    <div className="max-w-5xl space-y-6 pb-12">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 px-8 py-10 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
            <HelpCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Centre d'aide</h1>
            <p className="text-blue-100 text-sm">Trouvez rapidement les réponses à vos questions</p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-300" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un article, une procédure..."
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/15 border border-white/30 text-white placeholder-blue-200 focus:outline-none focus:bg-white/25 text-sm"
          />
        </div>
        {/* Search results */}
        {search.trim().length > 1 && (
          <div className="mt-3 bg-white rounded-xl shadow-lg overflow-hidden">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">Aucun résultat pour "{search}"</p>
            ) : (
              filtered.slice(0, 6).map(({ article, category }) => {
                const c = COLOR_MAP[category.color] || COLOR_MAP.blue;
                return (
                  <button key={article.id} onClick={() => { setSelectedArticle({ article, category }); setSearch(""); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-left border-b last:border-0 transition-colors">
                    <div className={`h-7 w-7 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
                      <category.icon className={`h-3.5 w-3.5 ${c.icon}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{article.title}</p>
                      <p className={`text-xs ${c.text}`}>{category.label} · {article.duration}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Popular articles */}
      {!selectedCategory && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Star className="h-3.5 w-3.5 text-amber-500" />Articles populaires
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {popular.map(({ article, category }) => {
              const c = COLOR_MAP[category.color] || COLOR_MAP.blue;
              return (
                <button key={article.id} onClick={() => setSelectedArticle({ article, category })}
                  className="text-left p-4 rounded-xl border hover:shadow-md transition-all group bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-7 w-7 rounded-lg ${c.bg} flex items-center justify-center`}>
                      <category.icon className={`h-3.5 w-3.5 ${c.icon}`} />
                    </div>
                    <span className={`text-xs font-medium ${c.text}`}>{category.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-blue-700 transition-colors leading-snug">{article.title}</p>
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />{article.duration}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Categories grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Book className="h-3.5 w-3.5" />Parcourir par thème
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CATEGORIES.map(cat => {
            const c = COLOR_MAP[cat.color] || COLOR_MAP.blue;
            const isActive = selectedCategory === cat.id;
            return (
              <button key={cat.id}
                onClick={() => setSelectedCategory(isActive ? null : cat.id)}
                className={`text-left p-4 rounded-xl border transition-all ${isActive ? `${c.bg} ${c.border} border-2` : "bg-card hover:shadow-md"}`}>
                <div className={`h-9 w-9 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
                  <cat.icon className={`h-4.5 w-4.5 ${c.icon}`} style={{width:"18px",height:"18px"}} />
                </div>
                <p className={`text-sm font-semibold ${isActive ? c.text : "text-foreground"}`}>{cat.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{cat.articles.length} articles</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category articles */}
      {activeCategory && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className={`text-base flex items-center gap-2 ${COLOR_MAP[activeCategory.color]?.text}`}>
                <activeCategory.icon className="h-5 w-5" />
                {activeCategory.label}
              </CardTitle>
              <button onClick={() => setSelectedCategory(null)} className="text-xs text-muted-foreground hover:text-foreground">Fermer ×</button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {activeCategory.articles.map(article => (
              <button key={article.id} onClick={() => setSelectedArticle({ article, category: activeCategory })}
                className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-muted/50 text-left transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-md ${COLOR_MAP[activeCategory.color]?.bg} flex items-center justify-center shrink-0`}>
                    <FileText className={`h-3 w-3 ${COLOR_MAP[activeCategory.color]?.icon}`} />
                  </div>
                  <span className="text-sm font-medium group-hover:text-blue-700 transition-colors">{article.title}</span>
                  {article.popular && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Populaire</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{article.duration}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* FAQ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-amber-700">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Questions fréquentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {FAQS.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} />)}
        </CardContent>
      </Card>

      {/* Contact support */}
      <div className="rounded-2xl border-2 border-dashed border-muted p-6 text-center">
        <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
          <MessageSquare className="h-6 w-6 text-blue-600" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">Vous n'avez pas trouvé votre réponse ?</h3>
        <p className="text-sm text-muted-foreground mb-4">Posez votre question à la communauté ou contactez votre administrateur système.</p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/community">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted/50 text-sm font-medium transition-colors">
              <Users className="h-4 w-4 text-blue-600" />Poser une question
            </button>
          </Link>
        </div>
      </div>

      {/* Article modal */}
      {selectedArticle && (
        <ArticleModal
          article={selectedArticle.article}
          category={selectedArticle.category}
          onClose={() => setSelectedArticle(null)}
        />
      )}
    </div>
  );
}
