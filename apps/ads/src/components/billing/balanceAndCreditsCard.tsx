"use client";

import { Button } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card } from "@/components/ui/surfaces";
import type { AdsEntitlements } from "@/types/adAccount.type";
import type { BillingOverview } from "@/types/billing.type";
import type { Money } from "@/types/money.type";
import { formatDateWithYear } from "@/utils/dateRange.util";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./billingPage.module.css";

interface BalanceAndCreditsCardProps {
  readonly overview: BillingOverview;
  readonly entitlements: AdsEntitlements | null;
  readonly canManageBilling: boolean;
  readonly onRequestTopUp: () => void;
  readonly availableToWithdraw: Money | null;
  readonly onRequestPayFromBalance: () => void;
}

function describeEstimatedDaysOfDelivery(days: number | null): string {
  if (days === null) return "No active daily budgets, so nothing is being spent right now.";
  if (days <= 0) return "Your balance will not cover today's delivery. Top up to keep ads running.";
  return `At current daily budgets, this covers about ${days} day${days === 1 ? "" : "s"} of delivery.`;
}

export function BalanceAndCreditsCard({ overview, entitlements, canManageBilling, onRequestTopUp, availableToWithdraw, onRequestPayFromBalance }: BalanceAndCreditsCardProps) {
  const isBalanceLow = overview.balance.amountMinor < overview.lowBalanceThreshold.amountMinor;
  const monthlyCredit = entitlements?.monthlyAdCredit ?? overview.credits.monthlyGrant;
  const renewsAt = entitlements?.creditRenewsAt ?? overview.credits.expiresAt;
  return (
    <Card title="Balance" description="Prepaid funds and ad credits. Credits are used before your balance.">
      <div className={styles.balanceRow}>
        <div>
          <p className={styles.figureLabel}>Available balance</p>
          <p className={styles.bigFigure}>{formatMoneyForDisplay(overview.balance)}</p>
        </div>
        <div>
          <p className={styles.figureLabel}>Ad credits</p>
          <p className={styles.creditFigure}>{formatMoneyForDisplay(overview.credits.available)}</p>
        </div>
        {isBalanceLow ? <StatusBadge tone="caution">Low balance</StatusBadge> : null}
      </div>
      <p className={styles.muted} style={{ marginTop: 8 }}>
        {describeEstimatedDaysOfDelivery(overview.estimatedDaysOfDelivery)}
      </p>
      {entitlements?.goldPremium && monthlyCredit ? (
        <div style={{ marginTop: 12 }}>
          <InlineNotice tone="success" title="Gold Premium ad credit">
            You receive {formatMoneyForDisplay(monthlyCredit)} in ad credit every month{renewsAt ? `, next on ${formatDateWithYear(renewsAt)}` : ""}. Unused credit does not roll over.
          </InlineNotice>
        </div>
      ) : null}
      {canManageBilling ? (
        <div className={styles.actionsRow}>
          <Button variant="primary" iconName="plus16" onClick={onRequestTopUp}>
            Add funds
          </Button>
          <Button variant="secondary" disabled={!availableToWithdraw} onClick={onRequestPayFromBalance}>
            Pay from my Nantty balance
          </Button>
          <span className={styles.muted} style={{ alignSelf: "center" }}>
            Available to withdraw: {availableToWithdraw ? formatMoneyForDisplay(availableToWithdraw) : "—"}
          </span>
        </div>
      ) : (
        <p className={styles.muted} style={{ marginTop: 12 }}>
          Only admins and billing managers can add funds.
        </p>
      )}
    </Card>
  );
}
