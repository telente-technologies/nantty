"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { doesRoleHavePermission, type AdsPermission } from "@/config/rolePermissions.config";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { accountsApi } from "@/services/accountsApi.service";
import type { AdAccount, AdAccountRole } from "@/types/adAccount.type";

interface AdAccountContextValue {
  readonly accountId: string;
  readonly account: AdAccount;
  readonly role: AdAccountRole;
  readonly currency: string;
  readonly canPerform: (permission: AdsPermission) => boolean;
  readonly reloadAccount: () => void;
  readonly buildAccountPagePath: (subPath: string) => string;
}

const AdAccountContext = createContext<AdAccountContextValue | null>(null);

export function AdAccountProvider({ accountId, role, children, fallbackFrame }: { readonly accountId: string; readonly role: AdAccountRole; readonly children: ReactNode; readonly fallbackFrame?: (content: ReactNode) => ReactNode }) {
  const accountQuery = useAdsQuery(() => accountsApi.fetchAdAccount(accountId), accountId);
  const canPerform = useCallback((permission: AdsPermission) => doesRoleHavePermission(role, permission), [role]);
  const buildAccountPagePath = useCallback((subPath: string) => `/accounts/${accountId}${subPath.startsWith("/") ? subPath : `/${subPath}`}`, [accountId]);
  const account = accountQuery.data;
  const contextValue = useMemo<AdAccountContextValue | null>(
    () => (account ? { accountId, account, role, currency: account.currency, canPerform, reloadAccount: accountQuery.reload, buildAccountPagePath } : null),
    [accountId, account, accountQuery.reload, role, canPerform, buildAccountPagePath],
  );
  const frame = fallbackFrame ?? ((content: ReactNode) => content);
  if (!contextValue) {
    if (accountQuery.errorMessage) return frame(<ErrorState variant="section" error={accountQuery.error} message={accountQuery.errorMessage} onRetry={accountQuery.reload} />);
    return frame(<LoadingBlock label="Loading ad account" height={240} />);
  }
  return <AdAccountContext.Provider value={contextValue}>{children}</AdAccountContext.Provider>;
}

export function useAdAccount(): AdAccountContextValue {
  const contextValue = useContext(AdAccountContext);
  if (!contextValue) throw new Error("useAdAccount must be used inside AdAccountProvider.");
  return contextValue;
}
