"use client";

import Link from "next/link";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { Card } from "@/components/ui/surfaces";
import { StatusBadge } from "@/components/ui/statusBadge";
import { NanttyIcon, type NanttyIconName } from "@/components/ui/nanttyIcon";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { accountsApi } from "@/services/accountsApi.service";
import { billingApi } from "@/services/billingApi.service";
import { campaignsApi } from "@/services/campaignsApi.service";
import { formatDateWithYear } from "@/utils/dateRange.util";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./needsAttentionPanel.module.css";

interface AttentionItem {
  readonly key: string;
  readonly iconName: NanttyIconName;
  readonly tone: "error" | "caution" | "info" | "accent";
  readonly title: string;
  readonly detail: string;
  readonly href: string;
  readonly actionLabel: string;
}

export function NeedsAttentionPanel() {
  const { accountId, canPerform, buildAccountPagePath } = useAdAccount();
  const canSeeBilling = canPerform("billing:view");
  const rejectedAdsQuery = useAdsQuery(() => campaignsApi.listAds(accountId, { reviewStatus: "rejected" }), `rejected-${accountId}`);
  const pendingAdsQuery = useAdsQuery(() => campaignsApi.listAds(accountId, { reviewStatus: "pending" }), `pending-${accountId}`);
  const billingQuery = useAdsQuery(() => billingApi.fetchBillingOverview(accountId), `billing-${accountId}`, canSeeBilling);
  const entitlementsQuery = useAdsQuery(() => accountsApi.fetchEntitlements(accountId), `entitlements-${accountId}`);

  const items: AttentionItem[] = [];
  for (const ad of rejectedAdsQuery.data?.items ?? []) {
    items.push({ key: `rejected-${ad.id}`, iconName: "warning20", tone: "error", title: `Rejected: ${ad.name}`, detail: ad.review.appeal?.status === "pending" ? "Appeal in progress." : ad.review.policyReason ?? "Did not pass review.", href: buildAccountPagePath(`/ads/${ad.id}`), actionLabel: ad.review.appeal ? "View appeal" : "Fix or appeal" });
  }
  for (const ad of pendingAdsQuery.data?.items ?? []) {
    items.push({ key: `pending-${ad.id}`, iconName: "eye20", tone: "info", title: `In review: ${ad.name}`, detail: "Usually checked within a few hours.", href: buildAccountPagePath(`/ads/${ad.id}`), actionLabel: "View ad" });
  }
  const billing = billingQuery.data;
  if (billing && billing.balance.amountMinor + billing.credits.available.amountMinor < billing.lowBalanceThreshold.amountMinor) {
    items.push({ key: "low-balance", iconName: "creditCard24", tone: "caution", title: "Balance is running low", detail: `${formatMoneyForDisplay(billing.balance)} left. Ads pause when it reaches zero.`, href: buildAccountPagePath("/billing"), actionLabel: "Top up" });
  } else if (billing?.estimatedDaysOfDelivery !== null && billing?.estimatedDaysOfDelivery !== undefined && billing.estimatedDaysOfDelivery <= 3) {
    items.push({ key: "days-left", iconName: "creditCard24", tone: "caution", title: `About ${billing.estimatedDaysOfDelivery} day${billing.estimatedDaysOfDelivery === 1 ? "" : "s"} of delivery left`, detail: "At today's budgets your balance runs out soon.", href: buildAccountPagePath("/billing"), actionLabel: "Top up" });
  }
  const entitlements = entitlementsQuery.data;
  const isLoading = rejectedAdsQuery.isLoading || pendingAdsQuery.isLoading;

  return (
    <Card title="Needs attention" description="Reviews, payments and credits for this account.">
      {entitlements?.goldPremium && entitlements.monthlyAdCredit ? (
        <div className={styles.creditNote}>
          <StatusBadge tone="accent">Gold Premium</StatusBadge>
          <p>
            <strong>{formatMoneyForDisplay(entitlements.monthlyAdCredit)}</strong> in ad credit every month
            {entitlements.creditRenewsAt ? `, next on ${formatDateWithYear(entitlements.creditRenewsAt)}` : ""}. Credit is spent before your balance.
          </p>
        </div>
      ) : null}
      {isLoading ? <p className={styles.quiet}>Checking…</p> : null}
      {!isLoading && items.length === 0 ? (
        <p className={styles.allClear}>
          <NanttyIcon name="check16" size={14} />
          Nothing needs your attention.
        </p>
      ) : null}
      <ul className={styles.list}>
        {items.slice(0, 6).map((item) => (
          <li key={item.key} className={styles.item}>
            <span className={`${styles.icon} ${styles[item.tone]}`}>
              <NanttyIcon name={item.iconName} size={16} />
            </span>
            <div className={styles.text}>
              <p className={styles.title}>{item.title}</p>
              <p className={styles.detail}>{item.detail}</p>
            </div>
            <Link href={item.href} className={styles.action}>
              {item.actionLabel}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
