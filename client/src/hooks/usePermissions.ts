import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export type Permission =
  | "view_documents"
  | "approve_documents"
  | "access_expenses"
  | "access_community"
  | "access_analytics"
  | "access_reports";

export function usePermissions() {
  const { user } = useAuth();
  const { data: groupPerms = [] } = trpc.groups.myPermissions.useQuery(undefined, {
    staleTime: 60000, // Cache for 1 min
  });

  // Admins and procurement managers always have all permissions
  const isAdmin = user?.role === "admin" || user?.role === "procurement_manager";

  const hasPermission = (permission: Permission): boolean => {
    if (isAdmin) return true;
    return groupPerms.includes(permission);
  };

  const canAccessExpenses = hasPermission("access_expenses");
  const canAccessCommunity = hasPermission("access_community");
  const canAccessAnalytics = hasPermission("access_analytics");
  const canAccessReports = hasPermission("access_reports");
  const canApproveDocuments = hasPermission("approve_documents") || user?.role === "approver";
  const canViewDocuments = hasPermission("view_documents");

  return {
    hasPermission,
    canAccessExpenses,
    canAccessCommunity,
    canAccessAnalytics,
    canAccessReports,
    canApproveDocuments,
    canViewDocuments,
    isAdmin,
    groupPerms,
  };
}
