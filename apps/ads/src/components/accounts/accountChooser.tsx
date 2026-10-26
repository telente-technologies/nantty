"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState, InlineNotice, LoadingBlock } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/statusBadge";
import { PageHeader } from "@/components/ui/surfaces";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { roleLabels } from "@/config/rolePermissions.config";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { accountsApi } from "@/services/accountsApi.service";
import { buildAccountForwardPath, isSafeAccountForwardPath } from "@/utils/accountForwardPath.util";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./accountChooser.module.css";

export function AccountChooser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountsQuery = useAdsQuery(() => accountsApi.listMyAdAccounts(), "accounts");
  const deniedAccountId = searchParams.get("denied");
  const requestedForwardPath = searchParams.get("next");
  const forwardPath = isSafeAccountForwardPath(requestedForwardPath) ? requestedForwardPath : null;
  const accounts = accountsQuery.data?.items ?? [];
  const onlyAccountId = accounts.length === 1 ? accounts[0]?.id : undefined;

  useEffect(() => {
    if (forwardPath && onlyAccountId && !deniedAccountId) router.replace(buildAccountForwardPath(onlyAccountId, forwardPath));
  }, [forwardPath, onlyAccountId, deniedAccountId, router]);

  return (
    <>
      <PageHeader
        title="Your ad accounts"
        description="Each ad account has its own currency, balance, people and campaigns."
        actions={
          <ButtonLink href="/accounts/new" variant="primary" iconName="plus16">
            New ad account
          </ButtonLink>
        }
      />
      {forwardPath && accounts.length > 1 ? <InlineNotice tone="info">Choose the ad account to continue with.</InlineNotice> : null}
      {deniedAccountId ? <InlineNotice tone="caution">You are not a member of that ad account. Ask one of its admins to invite you.</InlineNotice> : null}
      {accountsQuery.isLoading && !accountsQuery.data ? <LoadingBlock height={220} label="Loading ad accounts" /> : null}
      {accountsQuery.errorMessage ? <ErrorState error={accountsQuery.error} message={accountsQuery.errorMessage} onRetry={accountsQuery.reload} /> : null}
      {accountsQuery.data && accounts.length === 0 ? (
        <EmptyState
          iconName="speedometer24"
          title="Create your first ad account"
          description="Use a personal account to promote your own posts and clips, or a business account linked to your Nantty store."
          action={
            <ButtonLink href="/accounts/new" variant="primary">
              Create ad account
            </ButtonLink>
          }
        />
      ) : null}
      <ul className={styles.grid}>
        {accounts.map((account) => (
          <li key={account.id}>
            <Link href={buildAccountForwardPath(account.id, forwardPath)} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.initial} aria-hidden>
                  {account.name.slice(0, 1).toUpperCase()}
                </span>
                <div className={styles.identity}>
                  <span className={styles.name}>{account.name}</span>
                  <span className={styles.meta}>
                    {account.kind === "business" ? "Business" : "Personal"} · {account.currency} · {account.id}
                  </span>
                </div>
                <ZudoIcon name="caretRight24" size={16} className={styles.chevron} />
              </div>
              <div className={styles.badges}>
                <StatusBadge tone="info">{roleLabels[account.myRole]}</StatusBadge>
                {account.verifiedBusiness ? <StatusBadge tone="accent">Verified business</StatusBadge> : null}
                {account.status !== "active" ? <StatusBadge tone="error">{account.status === "disabled" ? "Disabled" : "Pending review"}</StatusBadge> : null}
              </div>
              <dl className={styles.stats}>
                <div>
                  <dt>Balance</dt>
                  <dd className="numeric">{formatMoneyForDisplay(account.balance)}</dd>
                </div>
                <div>
                  <dt>Active campaigns</dt>
                  <dd className="numeric">{account.activeCampaignCount}</dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
