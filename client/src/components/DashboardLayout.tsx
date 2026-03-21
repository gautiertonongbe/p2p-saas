import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { usePermissions } from "@/hooks/usePermissions";
import { useTheme, COLOR_PRESETS } from "@/contexts/ThemeContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, Users, FileText, ShoppingCart, FileCheck, DollarSign, TrendingUp, Settings, CheckCircle, Languages, ClipboardList, Package, CreditCard, BarChart2, Receipt, Lock, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import ImpersonateBanner from "@/components/ImpersonateBanner";
import { NotificationBell } from "./NotificationBell";

type NavItem = { icon: any; label: string; path: string; color?: string };
type NavGroup = { label: string; color: string; bgColor: string; items: NavItem[] };

const getNavGroups = (t: (key: string) => string): NavGroup[] => [
  {
    label: t("navigation.dashboard"), color: "#2563eb", bgColor: "#eff6ff",
    items: [{ icon: LayoutDashboard, label: t("navigation.dashboard"), path: "/" }],
  },
  {
    label: t("common.purchases"), color: "#7c3aed", bgColor: "#f5f3ff",
    items: [
      { icon: FileText, label: t("purchaseRequests.title"), path: "/purchase-requests" },
      { icon: ShoppingCart, label: t("purchaseOrders.title"), path: "/purchase-orders" },
      { icon: ClipboardList, label: t("rfqs.title"), path: "/rfqs" },
    ],
  },
  {
    label: t("common.finance"), color: "#0891b2", bgColor: "#ecfeff",
    items: [
      { icon: FileCheck, label: t("invoices.title"), path: "/invoices" },
      { icon: CreditCard, label: t("payments.title"), path: "/payments" },
      { icon: Receipt, label: t("expenses.title"), path: "/expenses" },
    ],
  },
  {
    label: t("common.operations"), color: "#d97706", bgColor: "#fffbeb",
    items: [
      { icon: Users, label: t("vendors.title"), path: "/vendors" },
      { icon: Package, label: t("inventory.title"), path: "/inventory" },
      { icon: DollarSign, label: t("budgets.title"), path: "/budgets" },
    ],
  },
  {
    label: t("approvals.title"), color: "#dc2626", bgColor: "#fff1f2",
    items: [
      { icon: CheckCircle, label: t("approvals.queue"), path: "/approvals" },
    ],
  },
  {
    label: t("analytics.title"), color: "#059669", bgColor: "#f0fdf4",
    items: [
      { icon: TrendingUp, label: t("analytics.title"), path: "/analytics" },
      { icon: BarChart2, label: t("reports.title"), path: "/reports" },
    ],
  },
  {
    label: t("community.title"), color: "#db2777", bgColor: "#fdf2f8",
    items: [
      { icon: Users, label: t("navigation.community"), path: "/community" },
      { icon: Lock, label: t("groups.title"), path: "/groups" },
      { icon: Users, label: t("navigation.supplierPortal"), path: "/supplier-portal" },
    ],
  },
];

const getMenuItems = (t: (key: string) => string) =>
  getNavGroups(t).flatMap(g => g.items);

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              {t('auth.signInToContinue')}
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {t('auth.accessRequiresAuth')}
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = "/login";
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            {t('auth.signIn')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const menuItems = getMenuItems(t);
  const navGroups = getNavGroups(t);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();
  const { isAdmin, canAccessExpenses, canAccessCommunity, canAccessAnalytics, canAccessReports } = usePermissions();
  const { colorPreset } = useTheme();
  const activeColor = COLOR_PRESETS.find(p => p.id === colorPreset)?.primary || "221 83% 53%";
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Accueil","Achats","Finance","Opérations","Approbations","Insights","Communauté"]);
  const toggleGroup = (label: string) => setExpandedGroups(g => g.includes(label) ? g.filter(x => x !== label) : [...g, label]);
  const { data: impStatus } = trpc.impersonate.status.useQuery(undefined, { refetchOnWindowFocus: false });
  const { data: org } = trpc.settings.getOrganization.useQuery();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
    <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {(org as any)?.logoUrl ? (
                    <img
                      src={(org as any).logoUrl}
                      alt={(org as any).legalName || "Logo"}
                      className="h-8 max-w-[140px] object-contain"
                      onError={e => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.removeAttribute("style");
                      }}
                    />
                  ) : null}
                  <span className={`font-semibold tracking-tight truncate text-sm ${(org as any)?.logoUrl ? "hidden" : ""}`}>
                    {(org as any)?.legalName || (org as any)?.tradeName || t('navigation.dashboard')}
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <div className="px-2 py-2 space-y-0.5">
              {navGroups.map(group => {
                const isExpanded = expandedGroups.includes(group.label);
                const hasActive = group.items.some(i => i.path === location);
                const filteredItems = group.items.filter(item => {
                  if (item.path === "/expenses" && !isAdmin && !canAccessExpenses) return false;
                  if (item.path === "/community" && !isAdmin && !canAccessCommunity) return false;
                  if (item.path === "/analytics" && !isAdmin && !canAccessAnalytics) return false;
                  if (item.path === "/reports" && !isAdmin && !canAccessReports) return false;
                  return true;
                });
                if (filteredItems.length === 0) return null;
                return (
                  <div key={group.label}>
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary rounded-full" />
                        <span className={`text-xs font-semibold uppercase tracking-wider ${hasActive ? "" : "text-muted-foreground"}`}
                          style={hasActive ? { color: `hsl(${activeColor})` } : {}}>
                          {group.label}
                        </span>
                      </div>
                      <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                    </button>
                    {/* Group items */}
                    {isExpanded && (
                      <div className="ml-2 pl-3 border-l border-muted space-y-0.5 mb-1" style={{ borderColor: `hsl(${activeColor} / 0.25)` }}>
                        {filteredItems.map(item => {
                          const isActive = location === item.path;
                          return (
                            <button
                              key={item.path}
                              onClick={() => setLocation(item.path)}
                              className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all text-left ${isActive ? "font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                              style={isActive ? { backgroundColor: `hsl(${activeColor} / 0.12)`, color: `hsl(${activeColor})` } : {}}
                            >
                              <item.icon className="h-3.5 w-3.5 shrink-0" style={isActive ? { color: `hsl(${activeColor})` } : {}} />
                              <span className="truncate">{item.label}</span>
                              {isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: `hsl(${activeColor})` }} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SidebarContent>

          {/* Settings - pinned above footer like Linear/Stripe */}
          <div className="px-3 py-2 border-t">
            <button
              onClick={() => setLocation("/settings")}
              className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all ${
                location === "/settings"
                  ? "font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              style={location === "/settings" ? {
                backgroundColor: `hsl(${activeColor} / 0.12)`,
                color: `hsl(${activeColor})`
              } : {}}
            >
              <Settings className="h-4 w-4 shrink-0" style={location === "/settings" ? { color: `hsl(${activeColor})` } : {}} />
              <span>{t("navigation.settings")}</span>
            </button>
          </div>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`flex items-center gap-3 rounded-lg px-1 py-1 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${impStatus?.isImpersonating ? "hover:bg-amber-100 bg-amber-50" : "hover:bg-accent/50"}`}>
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarImage src={(user as any)?.avatarUrl || undefined} alt={user?.name || ""} />
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('auth.signOut')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
    </div>

    <SidebarInset>
        <ImpersonateBanner />
      {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <LanguageSwitcher />
            </div>
          </div>
        )}
        {!isMobile && (
          <div className="flex border-b h-14 items-center justify-end gap-1 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <NotificationBell />
            <LanguageSwitcher />
          </div>
        )}
        <main className="flex-1 p-4 sm:p-6 max-w-full overflow-x-hidden">{children}</main>
      </SidebarInset>
    </>
  );
}
// color theme fix Fri Mar 20 10:06:02 UTC 2026
