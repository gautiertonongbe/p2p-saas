import { trpc } from "@/lib/trpc";
import { Bell, CheckCheck, X, FileText, CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { Button } from "./ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { toast } from "sonner";

const ICONS: Record<string, React.FC<any>> = {
  approved: CheckCircle2,
  rejected: XCircle,
  approval_required: Clock,
  approval_overdue: AlertTriangle,
  contract_expiring: FileText,
  budget_alert: AlertTriangle,
  rfq_response: FileText,
  payment_processed: CheckCircle2,
  invoice_overdue: AlertTriangle,
};

const ICON_COLORS: Record<string, string> = {
  approved: "text-green-600",
  rejected: "text-red-600",
  approval_required: "text-yellow-600",
  approval_overdue: "text-orange-600",
  contract_expiring: "text-blue-600",
  budget_alert: "text-red-600",
  rfq_response: "text-purple-600",
  payment_processed: "text-green-600",
  invoice_overdue: "text-orange-600",
};

const ENTITY_PATHS: Record<string, string> = {
  purchaseRequest: "/purchase-requests",
  purchaseOrder: "/purchase-orders",
  invoice: "/invoices",
  rfq: "/rfqs",
  vendor: "/vendors",
};

function timeAgo(date: Date | string): string {
  const d = new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  return `Il y a ${Math.floor(diff / 86400)}j`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: notifications } = trpc.notifications.list.useQuery(undefined, {
    refetchInterval: 30_000, // poll every 30s
  });
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      toast.success("Toutes les notifications marquées comme lues");
    },
  });

  const handleNotificationClick = (n: any) => {
    if (!n.isRead) {
      markReadMutation.mutate({ id: n.id });
    }
    if (n.entityType && n.entityId) {
      const basePath = ENTITY_PATHS[n.entityType];
      if (basePath) {
        setOpen(false);
        setLocation(`${basePath}/${n.entityId}`);
      }
    }
  };

  const count = unreadCount ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-medium text-sm">Notifications</span>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Tout marquer lu
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="max-h-[400px]">
          {!notifications?.length ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <Bell className="mx-auto h-8 w-8 mb-2 opacity-30" />
              <p>Aucune notification</p>
            </div>
          ) : (
            <div>
              {notifications.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                const iconColor = ICON_COLORS[n.type] ?? "text-muted-foreground";
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 border-b last:border-0 transition-colors ${!n.isRead ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!n.isRead ? "font-medium" : ""}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
