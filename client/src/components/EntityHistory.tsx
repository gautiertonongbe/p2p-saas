import {
  Clock, User, FileText, CheckCircle, XCircle, Send,
  Plus, Edit, Package, CreditCard, AlertTriangle, RefreshCw,
  ArrowRight, ShoppingCart, Banknote,
} from "lucide-react";

interface HistoryEntry {
  id: number;
  action: string;
  actorName: string | null;
  actorId: number;
  createdAt: Date;
  oldValue?: any;
  newValue?: any;
}

interface Props {
  entries: HistoryEntry[];
  isLoading?: boolean;
}

// Action config: icon, color, label, description builder
const ACTION_CONFIG: Record<string, {
  icon: any;
  color: string;
  bg: string;
  label: string;
  desc?: (e: HistoryEntry) => string;
}> = {
  created:   { icon: Plus,         color: "#2563eb", bg: "#eff6ff", label: "Créé",                    desc: () => "Document créé" },
  updated:   { icon: Edit,         color: "#6b7280", bg: "#f9fafb", label: "Modifié",                 desc: (e) => describeChanges(e) },
  submitted: { icon: Send,         color: "#d97706", bg: "#fffbeb", label: "Soumis",                  desc: () => "Soumis pour approbation" },
  approved:  { icon: CheckCircle,  color: "#059669", bg: "#f0fdf4", label: "Approuvé",                desc: (e) => e.newValue?.comment ? `"${e.newValue.comment}"` : "Approuvé" },
  rejected:  { icon: XCircle,      color: "#dc2626", bg: "#fff1f2", label: "Refusé",                  desc: (e) => e.newValue?.comment ? `"${e.newValue.comment}"` : "Refusé" },
  issued:    { icon: ShoppingCart, color: "#7c3aed", bg: "#f5f3ff", label: "Bon émis",                desc: () => "Bon de commande émis au fournisseur" },
  received:  { icon: Package,      color: "#0891b2", bg: "#ecfeff", label: "Réceptionné",             desc: (e) => e.newValue?.quantity ? `Qté reçue : ${e.newValue.quantity}` : "Réception confirmée" },
  paid:      { icon: Banknote,     color: "#059669", bg: "#f0fdf4", label: "Payé",                    desc: (e) => e.newValue?.amount ? `Montant : ${Number(e.newValue.amount).toLocaleString("fr-FR")} XOF` : "Paiement effectué" },
  cancelled: { icon: XCircle,      color: "#dc2626", bg: "#fff1f2", label: "Annulé",                  desc: (e) => e.newValue?.reason || "Annulé" },
  disputed:  { icon: AlertTriangle,color: "#d97706", bg: "#fffbeb", label: "Contesté",                desc: (e) => e.newValue?.reason || "Facture contestée" },
  revised:   { icon: RefreshCw,    color: "#6b7280", bg: "#f9fafb", label: "Révision demandée",       desc: (e) => e.newValue?.comment || "Révision demandée" },
  matched:   { icon: CheckCircle,  color: "#059669", bg: "#f0fdf4", label: "Rapprochement OK",        desc: () => "Rapprochement 3 voies réussi" },
  converted: { icon: ArrowRight,   color: "#7c3aed", bg: "#f5f3ff", label: "Converti en BC",          desc: () => "Converti en bon de commande" },
  closed:    { icon: CheckCircle,  color: "#6b7280", bg: "#f9fafb", label: "Clôturé",                 desc: () => "Document clôturé" },
};

const FIELD_LABELS: Record<string, string> = {
  status: "Statut", title: "Titre", amount: "Montant", totalAmount: "Montant total",
  vendorId: "Fournisseur", description: "Description", notes: "Notes",
  dueDate: "Date d'échéance", deliveryDate: "Date livraison",
  urgency: "Urgence", departmentId: "Département",
};

function describeChanges(entry: HistoryEntry): string {
  if (!entry.newValue || typeof entry.newValue !== "object") return "Document modifié";
  const keys = Object.keys(entry.newValue).filter(k => k !== "updatedAt");
  if (keys.length === 0) return "Document modifié";
  const labels = keys.slice(0, 2).map(k => FIELD_LABELS[k] || k);
  const rest = keys.length > 2 ? ` +${keys.length - 2}` : "";
  return `Modifié : ${labels.join(", ")}${rest}`;
}

function timeAgo(date: Date): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `il y a ${m} min`;
  if (h < 24) return `il y a ${h}h`;
  if (days < 7) return `il y a ${days}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: days > 365 ? "numeric" : undefined });
}

function fullDate(date: Date): string {
  return new Date(date).toLocaleString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getInitials(name: string | null, id: number): string {
  if (!name) return `#${id}`;
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export function EntityHistory({ entries, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 bg-muted rounded w-32" />
              <div className="h-3 bg-muted rounded w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-muted-foreground">
        <Clock className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">Aucun historique disponible</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline vertical line */}
      <div className="absolute left-4 top-4 bottom-4 w-px bg-border" />

      <div className="space-y-1">
        {entries.map((entry, idx) => {
          const cfg = ACTION_CONFIG[entry.action] || {
            icon: Clock, color: "#6b7280", bg: "#f9fafb",
            label: entry.action, desc: () => entry.action,
          };
          const Icon = cfg.icon;
          const isLast = idx === entries.length - 1;

          return (
            <div key={entry.id} className="relative flex gap-4 pl-2 py-2 group">
              {/* Icon bubble */}
              <div
                className="relative z-10 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ring-2 ring-background"
                style={{ backgroundColor: cfg.bg, border: `1.5px solid ${cfg.color}40` }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
              </div>

              {/* Content */}
              <div className={`flex-1 min-w-0 pb-3 ${!isLast ? "border-b border-border/50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Action pill */}
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}
                    >
                      {cfg.label}
                    </span>
                    {/* Description */}
                    <span className="text-sm text-foreground">
                      {cfg.desc ? cfg.desc(entry) : ""}
                    </span>
                  </div>
                  {/* Time */}
                  <span
                    className="text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-0.5"
                    title={fullDate(entry.createdAt)}
                  >
                    {timeAgo(entry.createdAt)}
                  </span>
                </div>

                {/* Actor */}
                <div className="flex items-center gap-1.5 mt-1">
                  <div
                    className="h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ backgroundColor: "#94a3b8" }}
                  >
                    {getInitials(entry.actorName, entry.actorId).slice(0, 1)}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {entry.actorName || `Utilisateur #${entry.actorId}`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
