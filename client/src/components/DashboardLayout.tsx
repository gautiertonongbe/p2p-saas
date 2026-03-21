import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { usePermissions } from "@/hooks/usePermissions";
import { useTheme, COLOR_PRESETS } from "@/contexts/ThemeContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { LayoutDashboard, LogOut, PanelLeft, Users, FileText, ShoppingCart, FileCheck, DollarSign, TrendingUp, Settings, CheckCircle, Languages, ClipboardList, Package, CreditCard, BarChart2, Receipt, Lock, ChevronDown, HelpCircle, TrendingDown, ClipboardCheck, ShieldCheck, CalendarDays, GitBranch} from "lucide-react";
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
      { icon: DollarSign, label: t("budgets.title"), path: "/budgets" },
      { icon: TrendingDown, label: "Économies", path: "/savings" },
    ],
  },
  {
    label: "Contrats", color: "#0e7490", bgColor: "#ecfeff",
    items: [
      { icon: FileText, label: "Contrats", path: "/contracts" },
      { icon: CalendarDays, label: "Renouvellements", path: "/renewal-calendar" },
    ],
  },
  {
    label: t("common.operations"), color: "#d97706", bgColor: "#fffbeb",
    items: [
      { icon: Users, label: t("vendors.title"), path: "/vendors" },
      { icon: Users, label: t("navigation.supplierPortal"), path: "/supplier-portal" },
      { icon: ClipboardCheck, label: "Qualification", path: "/vendor-onboarding" },
      { icon: ShieldCheck, label: "Risques fournisseurs", path: "/vendor-risk" },
      { icon: Package, label: t("inventory.title"), path: "/inventory" },
    ],
  },
  {
    label: t("approvals.title"), color: "#dc2626", bgColor: "#fff1f2",
    items: [
      { icon: CheckCircle, label: t("approvals.queue"), path: "/approvals" },
      { icon: GitBranch, label: "Workflows", path: "/workflow-builder" },
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
      { icon: HelpCircle, label: "Centre d'aide", path: "/help" },
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
          <SidebarHeader className="h-[72px] justify-center">
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
                      className="h-10 max-w-[160px] object-contain"
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
                  // Role-based visibility — hide items users cannot act on
                  const role = user?.role;
                  const isProcurement = isAdmin || role === "procurement_manager";
                  const isApprover = role === "approver";
                  const isRequester = role === "requester" || (!isAdmin && !isApprover);

                  // Admin-only pages
                  if (["/vendor-onboarding", "/vendor-risk", "/workflow-builder", "/groups", "/contracts", "/savings", "/renewal-calendar"].includes(item.path) && !isProcurement) return false;

                  // Finance pages — admin/procurement only
                  if (["/payments", "/budgets", "/rfqs"].includes(item.path) && !isProcurement) return false;

                  // Approvals — approvers and admins only
                  if (item.path === "/approvals" && !isApprover && !isAdmin) return false;

                  // Supplier portal — hide for regular users
                  if (item.path === "/supplier-portal" && !isProcurement) return false;

                  // Group-permission gated pages
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
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
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
                              <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 transition-colors"
                                style={{
                                  backgroundColor: isActive ? group.color : `${group.color}18`,
                                }}>
                                <item.icon className="h-3.5 w-3.5" style={{ color: isActive ? "#fff" : group.color }} />
                              </div>
                              <span className="truncate">{item.label}</span>
                              {isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />}
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
              <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 transition-colors"
                style={{ backgroundColor: location === "/settings" ? `hsl(${activeColor})` : `hsl(${activeColor} / 0.12)` }}>
                <Settings className="h-3.5 w-3.5" style={{ color: location === "/settings" ? "#fff" : `hsl(${activeColor})` }} />
              </div>
              <span>{t("navigation.settings")}</span>
            </button>}
          </div>

          <SidebarFooter className="p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`flex items-center gap-3 rounded-xl px-2 py-2 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${impStatus?.isImpersonating ? "hover:bg-amber-100 bg-amber-50" : "hover:bg-muted/60"}`}>
                  <Avatar className="h-10 w-10 border-2 border-muted shrink-0">
                    <AvatarImage src={(user as any)?.avatarUrl || undefined} alt={user?.name || ""} />
                    <AvatarFallback className="text-sm font-semibold" style={{ backgroundColor: `hsl(${activeColor} / 0.15)`, color: `hsl(${activeColor})` }}>
                      {(user?.name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0,2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-semibold truncate leading-tight">
                      {user?.name || "-"}
                    </p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-0.5 inline-block ${
                        user?.role === "admin" ? "bg-red-100 text-red-700" :
                        user?.role === "procurement_manager" ? "bg-blue-100 text-blue-700" :
                        user?.role === "approver" ? "bg-amber-100 text-amber-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{
                        user?.role === "admin" ? "Administrateur" :
                        user?.role === "procurement_manager" ? "Resp. Achats" :
                        user?.role === "approver" ? "Approbateur" :
                        "Demandeur"
                      }</span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5 border-b mb-1">
                  <p className="text-xs font-semibold truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuItem
                  onClick={() => setLocation("/settings?section=profile")}
                  className="cursor-pointer"
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span>Mon profil</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
