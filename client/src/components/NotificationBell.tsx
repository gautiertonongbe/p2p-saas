import { trpc } from "@/lib/trpc";
import {
  Bell, CheckCheck, X, Trash2, FileText, CheckCircle2,
  XCircle, AlertTriangle, Clock, CreditCard, ShoppingCart,
  Package, RefreshCw
} from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { toast } from "sonner";

const ICONS: Record<string, React.FC<any>> = {
  approved:          CheckCircle2,
  rejected:          XCircle,
  approval_required: Clock,
  approval_overdue:  AlertTriangle,
  contract_expiring: FileText,
  budget_alert:      AlertTriangle,
  rfq_response:      FileText,
  payment_processed: CreditCard,
  invoice_overdue:   AlertTriangle,
  po_issued:         ShoppingCart,
  low_stock:         Package,
  resubmitted:       RefreshCw,
};

const ICON_COLORS: Record<string, string> = {
  approved:          "text-emerald-600 bg-emerald-50",
  rejected:          "text-red-600 bg-red-50",
  approval_required: "text-amber-600 bg-amber-50",
  approval_overdue:  "text-orange-600 bg-orange-50",
  contract_expiring: "text-blue-600 bg-blue-50",
  budget_alert:      "text-red-600 bg-red-50",
  rfq_response:      "text-purple-600 bg-purple-50",
  payment_processed: "text-emerald-600 bg-emerald-50",
  invoice_overdue:   "text-orange-600 bg-orange-50",
  po_issued:         "text-blue-600 bg-blue-50",
  low_stock:         "text-amber-600 bg-amber-50",
};

const ENTITY_PATHS: Record<string, string> = {
  purchaseRequest: "/purchase-requests",
  purchaseOrder:   "/purchase-orders",
  invoice:         "/invoices",
  rfq:             "/rfqs",
  vendor:          "/vendors",
  budget:          "/budgets",
  contract:        "/contracts",
};

function timeAgo(date: Date | string): string {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60)    return "À l'instant";
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)}j`;
  return new Date(date).toLocaleDateString("fr-FR", { day:"numeric", month:"short" });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const invalidate = () => {
    utils.notifications.list.invalidate();
    utils.notifications.unreadCount.invalidate();
  };

  const { data: notifications = [], isLoading } = trpc.notifications.list.useQuery(
    { unreadOnly: tab === "unread" },
    { refetchInterval: 20_000, staleTime: 10_000 }
  );
  const { data: unreadCount = 0 } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 20_000,
  });

  const markRead     = trpc.notifications.markRead.useMutation({ onSuccess: invalidate });
  const markAllRead  = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => { invalidate(); toast.success("Toutes les notifications marquées comme lues"); }
  });
  const dismiss      = trpc.notifications.dismiss.useMutation({ onSuccess: invalidate });
  const clearRead    = trpc.notifications.clearRead.useMutation({
    onSuccess: () => { invalidate(); toast.success("Notifications lues supprimées"); }
  });
  const clearAll     = trpc.notifications.clearAll.useMutation({
    onSuccess: () => { invalidate(); toast.success("Toutes les notifications supprimées"); setOpen(false); }
  });

  const handleClick = (n: any) => {
    if (!n.isRead) markRead.mutate({ id: n.id });
    const basePath = n.entityType && ENTITY_PATHS[n.entityType];
    if (basePath && n.entityId) {
      setOpen(false);
      setLocation(`${basePath}/${n.entityId}`);
    }
  };

  const hasRead = notifications.some((n: any) => n.isRead);
  const count = unreadCount ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
          <Bell className="h-4.5 w-4.5 text-muted-foreground" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-background">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0 shadow-xl border" align="end" sideOffset={8}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Notifications</span>
            {count > 0 && (
              <span className="h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                {count}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {count > 0 && (
              <button onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Tout marquer comme lu">
                <CheckCheck className="h-3.5 w-3.5" />Tout lire
              </button>
            )}
            {hasRead && (
              <button onClick={() => clearRead.mutate()}
                disabled={clearRead.isPending}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Supprimer les notifications lues">
                <Trash2 className="h-3.5 w-3.5" />Effacer lues
              </button>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b">
          {(["all", "unread"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {t === "all" ? "Toutes" : `Non lues${count > 0 ? ` (${count})` : ""}`}
            </button>
          ))}
        </div>

        {/* ── List ── */}
        <ScrollArea className="max-h-[380px]">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
              Chargement...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Bell className="mx-auto h-10 w-10 mb-3 opacity-20" />
              <p className="font-medium">
                {tab === "unread" ? "Aucune notification non lue" : "Aucune notification"}
              </p>
              <p className="text-xs mt-1 text-muted-foreground/70">Vous êtes à jour !</p>
            </div>
          ) : (
            <div>
              {(notifications as any[]).map((n: any) => {
                const Icon = ICONS[n.type] ?? Bell;
                const iconStyle = ICON_COLORS[n.type] ?? "text-gray-500 bg-gray-100";
                const [iconColor, iconBg] = iconStyle.split(" ");
                return (
                  <div key={n.id}
                    className={`group relative flex items-start gap-3 px-4 py-3 border-b last:border-0 transition-colors ${
                      !n.isRead ? "bg-blue-50/40 hover:bg-blue-50/70" : "hover:bg-muted/40"
                    }`}>

                    {/* Icon */}
                    <div className={`h-8 w-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className={`h-4 w-4 ${iconColor}`} />
                    </div>

                    {/* Content — clickable */}
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleClick(n)}>
                      <p className={`text-sm leading-snug ${!n.isRead ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>

                    {/* Right: unread dot + dismiss */}
                    <div className="flex flex-col items-center gap-2 shrink-0 ml-1">
                      {!n.isRead && (
                        <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); dismiss.mutate({ id: n.id }); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all text-muted-foreground hover:text-red-500"
                        title="Supprimer">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* ── Footer ── */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {notifications.length} notification{notifications.length > 1 ? "s" : ""}
            </span>
            <button
              onClick={() => { if (confirm("Supprimer toutes les notifications ?")) clearAll.mutate(); }}
              disabled={clearAll.isPending}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors py-1">
              <Trash2 className="h-3 w-3" />
              Tout supprimer
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
