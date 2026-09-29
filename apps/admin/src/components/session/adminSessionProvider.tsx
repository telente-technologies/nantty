"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { AdminPermission } from "@/constants/adminPermissions.constant";
import { rememberCsrfTokenForRequests } from "@/services/adminApiClient.service";
import type { AdminSessionView } from "@/types/admin.type";
import { doesAdminHaveAnyPermission, doesAdminHavePermission, isSuperadmin } from "@/utils/adminAccess.util";

const AdminSessionContext = createContext<AdminSessionView | null>(null);

export function AdminSessionProvider({ sessionView, csrfToken, children }: { readonly sessionView: AdminSessionView; readonly csrfToken: string | null; readonly children: ReactNode }) {
  rememberCsrfTokenForRequests(csrfToken);
  return <AdminSessionContext.Provider value={sessionView}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionView {
  const sessionView = useContext(AdminSessionContext);
  if (!sessionView) throw new Error("useAdminSession must be used inside AdminSessionProvider.");
  return sessionView;
}

export interface AdminPermissionChecks {
  readonly can: (permission: AdminPermission) => boolean;
  readonly canAny: (...permissions: AdminPermission[]) => boolean;
  readonly isSuperadmin: boolean;
}

export function useAdminPermissions(): AdminPermissionChecks {
  const { admin } = useAdminSession();
  return useMemo(
    () => ({
      can: (permission: AdminPermission) => doesAdminHavePermission(admin, permission),
      canAny: (...permissions: AdminPermission[]) => doesAdminHaveAnyPermission(admin, permissions),
      isSuperadmin: isSuperadmin(admin),
    }),
    [admin],
  );
}
