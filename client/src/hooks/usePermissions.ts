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
    staleTime: 60000,
  });

  const role = user?.role;

  // Role hierarchy
  const isStrictAdmin      = role === "admin";
  const isProcurement      = role === "admin" || role === "procurement_manager";
  const isApprover         = role === "approver";
  const isRequester        = role === "requester" || (!isProcurement && !isApprover);

  // Legacy — kept for backward compat (treats procurement as admin for most checks)
  const isAdmin = isProcurement;

  const hasPermission = (permission: Permission): boolean => {
    if (isProcurement) return true;
    return (groupPerms as string[]).includes(permission);
  };

  // Specific capabilities
  const canManageVendors       = isProcurement;
  const canManageBudgets       = isProcurement;
  const canManageContracts     = isProcurement;
  const canViewVendorRisk      = isProcurement || isApprover;   // ← approvers can VIEW
  const canEditVendorRisk      = isProcurement;                  // ← only procurement can EDIT
  const canManageWorkflows     = isStrictAdmin;                  // ← admin only
  const canManageGroups        = isStrictAdmin;                  // ← admin only
  const canAccessApprovals     = isProcurement || isApprover;
  const canCreateRequest       = true;                           // ← everyone
  const canAccessExpenses      = hasPermission("access_expenses");
  const canAccessCommunity     = true;                           // ← open to all
  const canAccessAnalytics     = isProcurement || hasPermission("access_analytics");
  const canAccessReports       = isProcurement || hasPermission("access_reports");
  const canApproveDocuments    = hasPermission("approve_documents") || isApprover || isProcurement;
  const canViewDocuments       = true;

  return {
    // Role flags
    role,
    isStrictAdmin,
    isProcurement,
    isApprover,
    isRequester,
    isAdmin, // legacy alias for isProcurement

    // Capabilities
    canManageVendors,
    canManageBudgets,
    canManageContracts,
    canViewVendorRisk,
    canEditVendorRisk,
    canManageWorkflows,
    canManageGroups,
    canAccessApprovals,
    canCreateRequest,
    canAccessExpenses,
    canAccessCommunity,
    canAccessAnalytics,
    canAccessReports,
    canApproveDocuments,
    canViewDocuments,

    hasPermission,
    groupPerms,
  };
}
