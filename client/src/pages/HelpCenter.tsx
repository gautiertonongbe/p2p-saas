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

  // Article content — full written content for all 40 articles
  const CONTENT: Record<string, string[]> = {
    "gs-1": [
    "Une demande d'achat (DA) est le point de départ de tout processus d'achat dans l'organisation. Elle décrit ce dont vous avez besoin, pour quel budget, et déclenche automatiquement le workflow d'approbation.",
    "**Étape 1 — Accéder au formulaire**
Cliquez sur '+ Nouvelle demande' depuis le tableau de bord ou via le menu Achats > Demandes d'achat > Nouveau.",
    "**Étape 2 — Renseigner les informations générales**
Saisissez un titre clair et descriptif (ex: 'Achat ordinateurs bureau département IT — Q2 2026'). Évitez les titres vagues comme 'Fournitures'.",
    "**Étape 3 — Ajouter les articles**
Pour chaque article : nom, description, quantité, unité et prix unitaire estimé. Le total se calcule automatiquement.",
    "**Étape 4 — Compléter les informations administratives**
Sélectionnez votre département, le niveau d'urgence (Faible / Moyen / Élevé / Urgent / Critique) et la date de livraison souhaitée.",
    "**Étape 5 — Rédiger la justification**
Expliquez pourquoi cet achat est nécessaire. Mentionnez le projet concerné et l'impact si le besoin n'est pas satisfait.",
    "**Étape 6 — Enregistrer ou soumettre**
Cliquez sur 'Enregistrer brouillon' pour sauvegarder sans soumettre, ou 'Soumettre pour approbation' pour lancer le workflow.",
    "💡 Conseil : Vérifiez le budget disponible de votre département avant de soumettre. Si le montant dépasse votre budget, la demande peut être bloquée."
    ],
    "gs-2": [
    "Le workflow d'approbation définit qui valide votre demande, dans quel ordre, et avec quels seuils de montant.",
    "**Comment ça fonctionne**
Après soumission, le système identifie la politique d'approbation applicable et notifie le premier approbateur automatiquement.",
    "**Les statuts**
Brouillon → En attente d'approbation → Approuvé / Refusé → Converti en BC.",
    "**Approbation en cascade**
Ex : Manager (jusqu'à 500K XOF) → Directeur (jusqu'à 2M XOF) → DG (au-delà). Chaque niveau est notifié quand le précédent a approuvé.",
    "**Approbation parallèle**
Certaines politiques requièrent que plusieurs approbateurs valident simultanément. La demande n'avance que quand tous ont approuvé.",
    "**Demande refusée**
Vous recevez une notification avec le motif. Corrigez les points soulevés et créez une nouvelle demande (utilisez 'Copier' pour gagner du temps).",
    "💡 Conseil : Suivez l'état en temps réel dans le détail de la demande — la chaîne d'approbation montre les avatars et décisions de chaque approbateur."
    ],
    "gs-3": [
    "Le tableau de bord donne une vue d'ensemble instantanée de votre activité achats.",
    "**Les 4 cartes métriques**
Affichent vos KPIs clés : demandes actives, bons de commande, factures en attente, actions requises. Cliquez pour accéder directement.",
    "**Mes demandes récentes**
Vos 6 dernières demandes avec statut coloré. Vert = approuvé, orange = en attente, rouge = refusé.",
    "**Actions rapides**
Raccourcis vers les actions fréquentes : créer une demande, accéder aux approbations, gérer les fournisseurs.",
    "**Bandeau orange (approbations)**
Apparaît quand des documents attendent votre décision. Cliquez pour approuver ou refuser directement.",
    "**Section Alertes (admins)**
Affiche les dépassements budgétaires, contrats expirant, stocks bas et factures en litige.",
    "💡 Conseil : Le tableau de bord se rafraîchit en temps réel. Les compteurs se mettent à jour automatiquement."
    ],
    "gs-4": [
    "Votre profil contient vos informations personnelles visibles par vos collègues et utilisées pour les notifications.",
    "**Accéder au profil**
Cliquez sur votre avatar en bas du menu latéral > 'Mon profil'.",
    "**Modifier vos informations**
Nom complet, téléphone, département, photo de profil.",
    "**Photo de profil**
Cliquez sur votre avatar dans le profil > icône modification. JPG ou PNG, max 2 Mo. Apparaît dans la chaîne d'approbation.",
    "**Langue**
Paramètres > Langue : Français ou Anglais. L'interface bascule immédiatement.",
    "**Thème de couleur**
Paramètres > Apparence : 4 palettes (Bleu, Violet, Émeraude, Rose). Appliqué à votre session.",
    "**Notifications email**
Paramètres > Notifications : activez/désactivez les alertes pour nouvelles approbations, statuts de demande, alertes budgétaires.",
    "💡 Conseil : Ajoutez une photo de profil — ça facilite l'identification dans les longues chaînes d'approbation."
    ],
    "gs-5": [
    "Pour qu'un collègue utilise la plateforme, un administrateur doit créer son compte.",
    "**Prérequis**
Rôle Admin ou Manager RH requis pour inviter des utilisateurs.",
    "**Étape 1**
Paramètres > Utilisateurs > Inviter un utilisateur.",
    "**Étape 2 — Renseigner**
Email professionnel, nom complet, département, rôle.",
    "**Les rôles**
Employé (crée des DA) · Approbateur (valide les demandes) · Manager achats (accès complet sauf paramètres) · Admin (accès total).",
    "**Étape 3 — Invitation**
L'utilisateur reçoit un email avec un lien pour créer son mot de passe (valable 72h).",
    "**Permissions avancées**
Pour des accès granulaires (notes de frais, analyses), ajoutez l'utilisateur à un Groupe dans Communauté > Groupes & Accès.",
    "💡 Conseil : Définissez les limites d'approbation de chaque approbateur dans sa fiche utilisateur dès l'invitation."
    ],
    "pr-1": [
    "Une demande bien rédigée est traitée 3x plus vite qu'une demande incomplète.",
    "**Titre efficace**
Format : [Objet] — [Département] — [Période]. Ex: 'Maintenance climatiseurs — Bâtiment A — Juillet 2026'",
    "**Articles et quantités**
Soyez précis sur les spécifications. Pour les services : prestation, durée, livrables attendus.",
    "**Montant estimé**
Basez-vous sur un devis préalable si disponible. Un montant réaliste évite les allers-retours.",
    "**Justification**
Répondez à : Pourquoi ? (besoin) — Pour quoi ? (usage) — Pourquoi maintenant ? (urgence). Ex: 'Les climatiseurs tombent en panne régulièrement. La maintenance préventive évitera des arrêts de production avant la saison chaude.'",
    "**Pièces jointes**
Joignez les devis ou spécifications techniques si disponibles. Accélère considérablement l'approbation.",
    "**Codification comptable**
Renseignez le compte GL, centre de coûts et projet si applicable.",
    "💡 Conseil : Pour les achats récurrents, créez une demande modèle que vous copiez chaque mois."
    ],
    "pr-2": [
    "La liste d'articles est le cœur de votre demande. Chaque article devient une ligne du bon de commande.",
    "**Ajouter un article**
Cliquez sur '+ Ajouter un article'. Renseignez : nom, description, quantité, unité, prix unitaire.",
    "**Unités disponibles**
pcs, kg, g, L, mL, m, cm, m², boîte, carton, palette, lot, heure, jour, mois.",
    "**Calcul automatique**
Le total ligne (quantité × prix) et le total général se calculent automatiquement.",
    "**Modifier un article**
Cliquez directement sur la valeur dans le tableau.",
    "**Supprimer un article**
Icône poubelle à droite de la ligne. Minimum 1 article pour soumettre.",
    "💡 Conseil : Groupez les articles similaires dans une même demande — ça facilite la négociation avec le fournisseur."
    ],
    "pr-3": [
    "Seules les demandes en statut 'Brouillon' peuvent être modifiées.",
    "**Accéder à la modification**
Depuis la liste des demandes > cliquez sur la demande > bouton 'Modifier' dans la barre d'action.",
    "**Ce qui est modifiable**
Titre, description, articles, montant, date de livraison, justification, département, codification.",
    "**Enregistrement automatique**
Les modifications sont sauvegardées en brouillon. Vous pouvez quitter et revenir sans perdre vos données.",
    "**Demande soumise**
Ne peut pas être modifiée directement. Demandez à l'approbateur d'annuler, ou attendez le refus, puis créez une version corrigée.",
    "**Utiliser Copier**
Pour modifier une demande soumise, utilisez 'Copier' pour créer une nouvelle demande pré-remplie.",
    "💡 Conseil : Utilisez le brouillon comme espace de travail. Sauvegardez régulièrement."
    ],
    "pr-4": [
    "La soumission déclenche le workflow d'approbation.",
    "**Pré-requis**
Titre renseigné · Au moins 1 article avec prix · Justification (si obligatoire) · Département sélectionné.",
    "**Soumettre depuis le formulaire**
Cliquez sur 'Soumettre pour approbation'. Le système vérifie les pré-requis et signale les champs manquants.",
    "**Depuis le détail**
Si la demande est en brouillon, ouvrez-la et cliquez sur 'Soumettre' dans la barre d'action.",
    "**Après soumission**
Statut → 'En attente d'approbation' · Approbateurs notifiés · Demande verrouillée (non modifiable).",
    "**Suivre l'avancement**
Dans le détail : chaîne d'approbation visible avec avatars. Bleu = en attente · Vert = approuvé · Rouge = refusé.",
    "**Annuler après soumission**
Contactez l'approbateur pour qu'il refuse avec motif 'Annulation à la demande du requérant'.",
    "💡 Conseil : Prévenez verbalement votre approbateur pour les demandes urgentes."
    ],
    "pr-5": [
    "La fonction Copier crée rapidement une nouvelle demande à partir d'une existante. Idéale pour les achats récurrents.",
    "**Accéder à la fonction**
Ouvrez une demande (peu importe son statut) > bouton 'Copier' dans l'en-tête.",
    "**Ce qui est copié**
Titre (préfixé 'Copie —') · Articles avec quantités et prix · Département · Justification · Codification.",
    "**Ce qui n'est pas copié**
Date de livraison · Pièces jointes · Historique et commentaires.",
    "**Modifier avant de soumettre**
La copie s'ouvre en mode édition. Modifiez ce dont vous avez besoin.",
    "**Cas d'usage**
Commandes récurrentes · Demandes similaires pour différents départements · Correction d'une demande refusée.",
    "💡 Conseil : Créez une demande template avec tous les articles types de votre département. Copiez-la chaque mois et ajustez les quantités."
    ],
    "pr-6": [
    "Suivre votre demande vous permet d'anticiper les délais et de relancer si nécessaire.",
    "**Tableau de bord**
Section 'Mes demandes récentes' : statut coloré de vos 6 dernières demandes.",
    "**Liste complète**
Achats > Demandes d'achat > Mes demandes. Filtrez par statut, date ou montant.",
    "**Détail de la demande**
Chaîne d'approbation visuelle : chaque approbateur avec avatar, décision et date.",
    "**Notifications**
Vous êtes notifié quand : demande approuvée, refusée, ou commentaire ajouté.",
    "**Statuts**
Brouillon · En attente d'approbation · Approuvé · Refusé · Converti en BC · Annulé.",
    "**Historique**
En bas de chaque demande : toutes les actions avec date, heure et acteur.",
    "💡 Conseil : Demande en attente depuis plus de 48h ? Contactez directement l'approbateur désigné dans la chaîne."
    ],
    "ap-1": [
    "En tant qu'approbateur, voici comment traiter efficacement les demandes.",
    "**Accéder aux approbations**
Menu latéral > Approbations, ou depuis le bandeau orange du tableau de bord.",
    "**Examiner une demande**
Cliquez pour voir : titre, articles, montant, justification, département, pièces jointes. Lisez tout avant de décider.",
    "**Approuver**
Bouton vert 'Approuver'. Commentaire optionnel (ex: 'Approuvé sous réserve de choisir le fournisseur X').",
    "**Refuser**
Bouton 'Rejeter'. Motif obligatoire — soyez précis pour permettre au demandeur de corriger.",
    "**Déléguer**
Si absent ou non compétent, déléguez à un collègue via le bouton 'Déléguer'.",
    "**Approbation directe (admin)**
Les admins peuvent approuver en bypasser la chaîne normale via 'Approuver directement'. À utiliser avec discernement.",
    "💡 Conseil : Un approbateur réactif (< 24h) améliore considérablement l'expérience de toute l'équipe."
    ],
    "ap-2": [
    "Les politiques d'approbation définissent automatiquement qui approuve quoi. Paramètres > Politiques d'approbation.",
    "**Créer une politique**
Nom clair (ex: 'Achats IT > 1M XOF') + définir les étapes.",
    "**Par étape, définir**
L'approbateur (par rôle, utilisateur spécifique, ou manager hiérarchique) · Seuil de montant · Délai maximum.",
    "**Types d'approbateurs**
Par rôle · Utilisateur spécifique · Manager hiérarchique (manager du département du demandeur).",
    "**Exemple standard**
Étape 1 : Manager département (jusqu'à 500K XOF) · Étape 2 : Directeur Achats (jusqu'à 2M) · Étape 3 : DG (au-delà).",
    "**Assigner à un département**
Dans les paramètres du département, sélectionnez la politique applicable.",
    "**Politique par défaut**
Si aucune politique spécifique n'est configurée, la politique par défaut de l'organisation s'applique.",
    "💡 Conseil : Commencez simple (1-2 niveaux). Ajoutez de la complexité progressivement — une politique trop complexe ralentit les achats."
    ],
    "ap-3": [
    "La chaîne d'approbation est la représentation visuelle du chemin d'une demande.",
    "**Lire la chaîne**
Dans le détail d'une demande : section 'Chaîne d'approbation'. Chaque approbateur avec avatar, nom, rôle, décision.",
    "**Codes couleur**
Anneau bleu pulsant = en attente · Anneau vert + ✓ = approuvé · Anneau rouge + ✗ = refusé · Anneau gris = étape future.",
    "**Ligne de connexion**
Se colore en vert au fur et à mesure des approbations, comme une barre de progression.",
    "**Survol pour les détails**
Email de l'approbateur, limite d'approbation, politique appliquée, commentaire éventuel.",
    "**Approbation séquentielle vs parallèle**
Séquentielle : notifiés l'un après l'autre. Parallèle : tous notifiés simultanément, tous doivent approuver.",
    "**Sur PO et factures**
La chaîne est aussi visible sur les bons de commande et factures — elle trace le chemin depuis la demande d'origine.",
    "💡 Conseil : La politique appliquée est indiquée dans le survol du premier approbateur."
    ],
    "ap-4": [
    "L'approbation directe bypasse la chaîne normale. Réservée aux administrateurs.",
    "**Quand l'utiliser**
Urgence absolue · Erreur de configuration · Approbateur indisponible de façon prolongée.",
    "**Comment**
Ouvrez la demande > 'Approuver directement' (bouton orange) > Saisissez un motif obligatoire.",
    "**Sur les brouillons**
En tant qu'admin, vous pouvez approuver un brouillon directement — il passe au statut 'Approuvé' sans passer par 'En attente'.",
    "**Traçabilité complète**
Enregistré dans l'historique : 'Approuvé directement par [nom] — Motif : [motif]'. Essentiel pour les audits.",
    "**Bonne pratique**
L'approbation directe ne doit pas devenir la norme. Son usage fréquent signale un problème de configuration.",
    "💡 Conseil : Après chaque approbation directe, analysez pourquoi la chaîne normale n'a pas fonctionné."
    ],
    "ap-5": [
    "La délégation permet de confier temporairement vos responsabilités d'approbation à un collègue.",
    "**Accéder**
Détail d'une demande en attente de votre approbation > bouton 'Déléguer'.",
    "**Choisir le délégataire**
Sélectionnez un collègue ayant les droits appropriés. Ajoutez une note contextuelle.",
    "**Délégation globale**
Pour déléguer pendant vos congés : Paramètres > Mon compte > Délégations.",
    "**Notification**
Le délégataire reçoit un email avec les détails et votre note. La demande apparaît dans sa file.",
    "**Traçabilité**
Historique : 'Délégué par [nom] à [délégataire]'. La décision finale du délégataire est tracée avec son nom.",
    "💡 Conseil : Configurez votre délégation avant vos congés — ne le faites pas depuis la plage !"
    ],
    "po-1": [
    "Une fois une demande approuvée, créez le BC en un clic — toutes les données sont pré-remplies.",
    "**Accéder à la création**
Ouvrez la demande approuvée > 'Créer un bon de commande' dans la barre d'action. (Admins peuvent aussi le faire depuis un brouillon.)",
    "**Données pré-remplies**
Articles avec quantités et prix · Montant total · Codification comptable.",
    "**Compléter le BC**
Fournisseur · Date de livraison prévue · Conditions de paiement · Notes spéciales.",
    "**Statut initial**
Le BC est créé en 'Brouillon'. Il doit être émis pour être envoyé au fournisseur.",
    "**Un BC par fournisseur**
Si la demande concerne plusieurs fournisseurs, créez un BC séparé pour chacun.",
    "**Traçabilité**
Le BC reste lié à la demande d'origine. Les historiques sont interconnectés.",
    "💡 Conseil : Vérifiez les coordonnées bancaires du fournisseur avant de créer le BC."
    ],
    "po-2": [
    "Émettre un BC signifie l'envoyer officiellement au fournisseur — c'est l'engagement contractuel d'achat.",
    "**Pré-requis**
Fournisseur sélectionné · Articles avec prix · Date de livraison · Approbation obtenue (si configurée).",
    "**Émettre**
Ouvrez le BC en Brouillon > 'Émettre le bon' dans la barre d'action. Statut → 'Émis'.",
    "**Approbation BC**
Selon votre configuration, le BC peut nécessiter une approbation. Les boutons Approuver/Rejeter apparaissent pour les approbateurs.",
    "**Export PDF**
'Télécharger PDF' génère un document formel avec logo, détails fournisseur et liste des articles.",
    "**Envoi au fournisseur**
Téléchargez le PDF et envoyez par email. Le portail fournisseur (si activé) lui donne aussi accès.",
    "**Annulation**
Un BC émis ne peut plus être modifié. Pour corriger : annulez et recréez.",
    "💡 Conseil : Ajoutez dans les notes toute condition spéciale (emballage, livraison, facturation) pour éviter les litiges."
    ],
    "po-3": [
    "L'enregistrement de réception confirme la livraison. C'est la deuxième partie du rapprochement 3 voies.",
    "**Quand enregistrer**
Le jour même de la livraison — n'attendez pas. Un enregistrement tardif peut bloquer le paiement des factures.",
    "**Accéder à l'enregistrement**
Ouvrez le BC (Approuvé ou Confirmé) > 'Enregistrer réception' dans la barre d'action ou dans la section Articles.",
    "**Quantités reçues**
Pour chaque article : quantité effectivement reçue. Peut différer de la quantité commandée (livraison partielle).",
    "**Condition des marchandises**
Bon état · Endommagé · Partiel. En cas de dommage, photographiez avant de valider.",
    "**Réception partielle**
Enregistrez ce qui est reçu. BC → 'Partiellement reçu'. Enregistrez les livraisons suivantes de la même façon.",
    "**Réception totale**
BC → 'Totalement reçu'. Le bouton 'Créer une facture' devient disponible.",
    "💡 Conseil : Photographiez les livraisons endommagées — indispensable pour les litiges fournisseurs."
    ],
    "po-4": [
    "Créez la facture directement depuis le BC — toutes les données sont importées automatiquement.",
    "**Accéder à la création**
BC (Confirmé, Partiellement reçu ou Totalement reçu) > 'Créer une facture' dans la barre d'action.",
    "**Données importées**
Fournisseur · Articles commandés avec prix · Numéro de facture suggéré · Date d'échéance (+30 jours par défaut).",
    "**À compléter**
Numéro de facture fournisseur (sur la facture papier reçue) · Date de la facture · Ajustements si la facture diffère.",
    "**Rapprochement automatique**
La facture est rapprochée avec le BC et le bon de réception. Si tout correspond → statut 'Conforme'.",
    "**Écarts de montant**
Si la facture diffère du BC au-delà des tolérances → statut 'Exception' → validation manuelle requise.",
    "💡 Conseil : Créez la facture dès réception du document fournisseur pour respecter les délais de paiement."
    ],
    "inv-1": [
    "La saisie manuelle est utilisée quand vous n'avez pas de BC associé ou souhaitez entrer les données manuellement.",
    "**Accéder**
Finance > Factures > Nouvelle facture, ou 'Factures' dans les actions rapides.",
    "**Champs obligatoires**
Numéro de facture (unique par fournisseur) · Fournisseur · Date de facture · Au moins une ligne avec montant.",
    "**Lier à un BC (recommandé)**
Si la facture correspond à un BC, sélectionnez-le dans 'Bon de commande associé' → rapprochement automatique déclenché.",
    "**Lignes de facturation**
Description, quantité, prix unitaire. TVA saisie séparément.",
    "**Codification comptable**
Compte GL, centre de coûts, projet — obligatoire pour l'intégration comptable.",
    "**Enregistrement**
Cliquez 'Enregistrer' → facture créée au statut 'En attente' → entre dans la file d'approbation.",
    "💡 Conseil : Vérifiez que le numéro de facture est exact — le système détecte les doublons automatiquement."
    ],
    "inv-2": [
    "L'OCR analyse automatiquement une photo ou PDF de facture et extrait les données.",
    "**Accéder à l'OCR**
Formulaire Nouvelle facture > bouton 'Scanner (OCR)' en haut à droite.",
    "**Formats acceptés**
JPG, PNG, PDF — max 10 Mo. La qualité de l'image impacte la précision.",
    "**Ce qui est extrait**
Numéro de facture · Date de facture et d'échéance · Montant HT et TVA · Lignes de facturation.",
    "**Vérification obligatoire**
Vérifiez TOUJOURS chaque champ extrait. L'OCR n'est pas infaillible — une erreur de chiffre peut créer un paiement incorrect.",
    "**Améliorer la précision**
Bonne lumière, pas d'ombres, facture bien droite, image non compressée.",
    "**Gain de temps**
3 à 5 minutes économisées par facture. Idéal pour les factures papier, photos de tickets, PDFs par email.",
    "💡 Conseil : Après vérification des données extraites, liez la facture au BC pour déclencher le rapprochement automatique."
    ],
    "inv-3": [
    "Le rapprochement 3 voies vérifie automatiquement la cohérence entre commande, livraison et facture.",
    "**Les 3 documents**
BC (commandé au prix négocié) · Bon de réception (livré en quelle quantité) · Facture (réclamé au paiement).",
    "**Critères comparés**
Fournisseur identique sur BC et facture · Montants dans les tolérances · Quantités facturées ≤ reçues.",
    "**Résultats**
Conforme → approbation possible · Non conforme → révision nécessaire · Exception → validation manuelle obligatoire.",
    "**Tolérances configurables**
Paramètres > Tolérances de rapprochement : prix (±5%), quantité (±2%), montant total (±5%).",
    "**En cas d'exception**
1) Contester la facture (erreur fournisseur) · 2) Demander révision · 3) Approuver manuellement avec commentaire.",
    "**Auto-approbation**
Factures conformes sous un certain montant peuvent être auto-approuvées. Configurez dans Paramètres > Tolérances.",
    "💡 Conseil : Encouragez vos fournisseurs à facturer exactement selon le BC — un rapprochement réussi = paiement rapide."
    ],
    "inv-4": [
    "L'approbation confirme que la facture est correcte et autorise le paiement.",
    "**Approuver**
Ouvrez la facture 'En attente' > 'Approuver' dans la barre d'action. Commentaire optionnel.",
    "**Rejeter**
Bouton 'Rejeter' + motif précis obligatoire.",
    "**Approbation directe (admin)**
Bouton orange 'Approuver directement'. Toujours tracé dans l'historique.",
    "**Marquer comme payée**
Facture approuvée + paiement effectué > 'Marquer comme payée'. Sélectionnez la méthode (virement, mobile money, espèces) et la date de valeur.",
    "**Après le paiement**
Facture → 'Payée' · Enregistrement de paiement créé · Budget actualisé · Fournisseur notifié sur le portail.",
    "**Télécharger le PDF**
Document formel avec logo de votre organisation.",
    "💡 Conseil : Respectez les délais de paiement (Date d'échéance visible). Les retards peuvent entraîner des pénalités."
    ],
    "inv-5": [
    "Contester une facture signale un problème qui empêche son paiement.",
    "**Quand contester**
Montant incorrect · Articles non reçus · Qualité non conforme · Facture en double · Fournisseur incorrect.",
    "**Comment contester**
Ouvrez la facture > 'Contester' dans la barre d'action > Motif + détails.",
    "**Après la contestation**
Facture → 'Contestée' · Fournisseur notifié (si portail activé) · Historique enregistré.",
    "**Résoudre un litige**
Quand le fournisseur envoie une facture corrigée, créez une nouvelle facture. L'ancienne reste dans l'historique.",
    "**Demander une révision**
Différent de la contestation : demande au fournisseur de soumettre une version corrigée via 'Demander révision'.",
    "**Résolution (admin)**
Marquez le litige comme résolu depuis la facture contestée, saisissez la résolution, puis approuvez ou rejetez.",
    "💡 Conseil : Documentez chaque contestation avec des preuves (photos, emails, comparaison BC) — indispensable pour les litiges."
    ],
    "vnd-1": [
    "Un fournisseur bien renseigné facilite toutes les étapes du processus d'achat.",
    "**Accéder au formulaire**
Opérations > Fournisseurs > Nouveau fournisseur.",
    "**Champs obligatoires**
Raison sociale · Pays · Mode de paiement · Email de contact.",
    "**Champs importants**
IFU / Numéro fiscal · RCCM · Coordonnées bancaires (IBAN, BIC) · Numéro Mobile Money.",
    "**Catégorie fournisseur**
Fournitures, Services, IT, Travaux, Logistique, etc. Utile pour les rapports d'analyse.",
    "**Statut initial**
'En attente d'approbation'. Un admin doit valider pour qu'il soit sélectionnable dans les BC.",
    "**Portail fournisseur**
Activez l'accès depuis la fiche fournisseur pour lui permettre de soumettre ses factures directement.",
    "💡 Conseil : Vérifiez IFU et RCCM auprès des sources officielles avant d'approuver — indispensable pour la conformité fiscale."
    ],
    "vnd-2": [
    "L'évaluation de performance mesure objectivement la qualité de vos fournisseurs.",
    "**Accéder aux métriques**
Fiche fournisseur > onglet 'Performance'.",
    "**Indicateurs mesurés**
Taux de livraison à temps · Taux de conformité des factures · Délai moyen de livraison · Nombre de litiges · Montant total des achats.",
    "**Évaluation manuelle**
Notation 1 à 5 étoiles avec commentaire après chaque commande importante.",
    "**Lors de la création d'un BC**
Le score de performance est affiché pour vous aider à choisir le meilleur fournisseur.",
    "**Fournisseurs stratégiques**
Marquez vos partenaires clés comme 'Stratégiques' pour les suivre en priorité.",
    "💡 Conseil : Revue annuelle des fournisseurs sous-performants. Moins de 60% de livraisons à temps → mise en concurrence."
    ],
    "vnd-3": [
    "Les coordonnées bancaires sont critiques. Une erreur peut entraîner un paiement au mauvais destinataire.",
    "**Accéder**
Fiche fournisseur > section 'Informations financières'.",
    "**Virement bancaire**
Nom de la banque · Numéro de compte (IBAN) · BIC/SWIFT · Agence bancaire.",
    "**Mobile Money**
Numéro de téléphone · Opérateur (MTN ou Moov) · Nom du titulaire (doit correspondre à la raison sociale).",
    "**Validation**
Avant d'utiliser de nouvelles coordonnées, faites un virement test de 1 XOF et confirmez la réception.",
    "**Alerte fraude**
Soyez vigilant aux emails demandant un changement de RIB — vecteur courant de fraude. Vérifiez toujours par téléphone.",
    "💡 Conseil : Mettez en place un processus de double validation pour tout changement de coordonnées bancaires."
    ],
    "vnd-4": [
    "Le portail fournisseur leur donne un accès direct pour soumettre factures et suivre paiements.",
    "**Activer l'accès**
Fiche fournisseur > 'Inviter au portail'. Email d'invitation avec lien d'accès envoyé.",
    "**Ce que le fournisseur peut faire**
Soumettre des factures · Consulter le statut (en attente, approuvée, payée) · Voir l'historique des paiements · Mettre à jour ses coordonnées bancaires.",
    "**Avantages pour votre organisation**
Moins d'appels/emails sur les statuts · Factures mieux renseignées · Réduction des erreurs de saisie.",
    "**Sécurité**
Chaque fournisseur n'accède qu'à ses propres données.",
    "**Révoquer l'accès**
En cas de litige ou fin de collaboration, révoquez depuis la fiche fournisseur.",
    "💡 Conseil : Pour les fournisseurs émettant plus de 5 factures/mois, le portail économise 30 à 60 minutes de traitement mensuel."
    ],
    "bud-1": [
    "Les budgets contrôlent les dépenses par département et bloquent automatiquement les achats dépassant les allocations.",
    "**Créer un budget**
Finance > Budgets > Nouveau budget. Nom, exercice fiscal, département, montant alloué.",
    "**Types**
Par département · Par projet · Par catégorie (IT, déplacements, formation...).",
    "**Seuils d'alerte**
Paramètres > Politiques budgétaires : alerte à 80% (avertissement), alerte à 100% (blocage optionnel).",
    "**Engagement vs dépense réelle**
Engagement : montant réservé quand une DA est approuvée. Dépense réelle : montant dépensé quand la facture est payée.",
    "**Modifier un budget**
Ajustable en cours d'année. Toute modification tracée avec motif.",
    "💡 Conseil : Créez des budgets granulaires (par département ET catégorie) pour une meilleure visibilité."
    ],
    "bud-2": [
    "Les alertes budgétaires vous préviennent avant d'atteindre les limites.",
    "**Types d'alertes**
Orange (80%) : surveillez · Rouge (100%) : budget épuisé · Dépassement : si les blocages ne sont pas activés.",
    "**Où voir les alertes**
Tableau de bord (section Alertes) · Finance > Budgets (barre de progression colorée).",
    "**Notifications email**
Managers de département et admins reçoivent un email automatique à chaque seuil atteint.",
    "**Que faire**
Vérifier les dépenses en cours · Demander un réajustement · Reporter certains achats.",
    "**Réajustement**
Admin > Finance > Budgets > Modifier. Motif de réajustement obligatoire.",
    "**Sans blocage**
Décochez 'Bloquer les demandes dépassant le budget' pour être alerté sans bloquer.",
    "💡 Conseil : Des dépassements réguliers sur le même poste indiquent une sous-dotation à corriger au prochain exercice."
    ],
    "bud-3": [
    "L'analyse des dépenses par département est la clé pour optimiser vos achats.",
    "**Accéder**
Insights > Analyses > vue 'Dépenses par département'.",
    "**Filtres**
Période · Département · Catégorie · Fournisseur.",
    "**Graphique de tendance**
Évolution mois par mois. Identifiez les pics saisonniers et anomalies.",
    "**Top fournisseurs**
Quel % de vos dépenses va vers chaque fournisseur ? Une forte concentration sur un seul = risque.",
    "**Budget vs Réel**
Graphique comparatif côte à côte. Barres rouges = dépassements.",
    "**Export**
Cliquez 'Exporter' pour télécharger en PDF.",
    "💡 Conseil : Partagez le rapport mensuel avec les responsables de département. La transparence responsabilise."
    ],
    "ana-1": [
    "Le tableau d'analyse vous donne une vision 360° de votre activité achats.",
    "**Accéder**
Insights > Analyses.",
    "**Vue d'ensemble**
Indicateurs clés : total dépenses, nombre de BC, économies réalisées, délai moyen d'approbation.",
    "**Graphiques disponibles**
Dépenses par catégorie (camembert) · Par fournisseur (top 10) · Par département (barres) · Tendance mensuelle · Taux de conformité factures.",
    "**Interactivité**
Cliquez sur une tranche pour zoomer. Survolez les barres pour les valeurs exactes.",
    "**Filtrer par période**
Ce mois · Trimestre · 12 derniers mois · Période personnalisée.",
    "**KPIs de performance**
Délai moyen d'approbation · Taux de rapprochement automatique · Économies identifiées.",
    "💡 Conseil : Consultez les analyses en fin de mois avant de préparer les budgets du mois suivant."
    ],
    "ana-2": [
    "Les rapports personnalisés vous permettent de créer exactement l'analyse dont vous avez besoin.",
    "**Accéder**
Insights > Rapports > Nouveau rapport.",
    "**Types de rapports**
Rapport dépenses · Fournisseurs · Conformité · Activité.",
    "**Colonnes**
Choisissez exactement les informations à inclure : date, département, fournisseur, montant, statut, approbateur...",
    "**Filtres**
Période · Département(s) · Fournisseur(s) · Statut · Montant min/max.",
    "**Grouper et agréger**
Par département, fournisseur ou catégorie. Totaux, moyennes ou comptages.",
    "**Sauvegarder et planifier**
Sauvegardez pour réutiliser. Configurez un envoi email automatique (hebdomadaire ou mensuel).",
    "💡 Conseil : Créez un rapport mensuel automatique pour la direction avec les 5 KPIs clés — 10 minutes de config, 1 heure économisée par mois."
    ],
    "ana-3": [
    "L'export PDF génère des rapports professionnels pour la direction ou les audits.",
    "**Exporter**
Sur tout rapport ou document : bouton 'Exporter PDF' ou icône de téléchargement.",
    "**Contenu du PDF**
Logo de votre organisation · En-tête avec dates et filtres · Données et graphiques · Pied de page avec date de génération.",
    "**Bons de commande**
'Télécharger PDF' depuis le détail → document formel avec infos fournisseur et liste des articles.",
    "**Factures**
Même fonctionnement → document professionnel prêt à archiver.",
    "**Format**
A4, qualité impression. Utilisable directement pour audits ou archivage réglementaire.",
    "**Archivage**
Conservez BC et factures conformément aux obligations légales (10 ans en général).",
    "💡 Conseil : Archivez automatiquement les documents importants en fin de mois — bonne pratique pour la conformité et les audits."
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
