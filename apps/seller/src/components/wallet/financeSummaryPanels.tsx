"use client";

import Link from "next/link";

import { FeaturePlanBadge } from "@/components/billing/planGate";
import { Button } from "@/components/ui/button";
import { Callout, LoadingBlock, StatTile } from "@/components/ui/feedback";
import { Panel, ResponsiveGrid } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import type { FinanceSummary } from "@/types/finance.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./wallet.module.css";

export function FinancePeriodTiles({ summary }: { readonly summary: FinanceSummary }) {
  const { formatMoney } = useMoneyFormatter();
  return (
    <ResponsiveGrid minimumColumnWidth={200}>
      <StatTile label="Gross sales · 30 days" value={formatMoney(summary.grossSales)} detail={`${summary.ordersCount} orders`} />
      <StatTile label="Fees" value={formatMoney(summary.totalFees)} detail={<Link href="/wallet/fees">See the breakdown</Link>} />
      <StatTile label="Refunds" value={formatMoney(summary.refunds)} tone={summary.refunds.amountMinor > 0 ? "caution" : "neutral"} detail={<Link href="/wallet/refunds">See refunds</Link>} />
      <StatTile label="Net earnings" value={formatMoney(summary.netEarnings)} tone="positive" detail={`Paid out ${formatMoney(summary.paidOut)}`} />
    </ResponsiveGrid>
  );
}

export function UpcomingEscrowReleasesPanel({ summary }: { readonly summary: FinanceSummary }) {
  const { formatMoney } = useMoneyFormatter();
  return (
    <Panel title="Next escrow releases" description="Money moves to your wallet after the buyer confirms delivery." actions={<Link href="/wallet/escrow" className={styles.panelLink}>All escrow</Link>}>
      {summary.upcomingReleases.length === 0 ? (
        <p className={styles.muted}>Nothing is waiting in escrow right now.</p>
      ) : (
        <ul className={styles.releaseList}>
          {summary.upcomingReleases.map((entry) => (
            <li key={entry.orderId} className={styles.releaseRow}>
              <span className={styles.releaseMain}>
                <Link href={`/orders/${entry.orderId}`}>{entry.orderNumber}</Link>
                <span className={styles.muted}>
                  {entry.buyerName} · expected {formatDateTimeForDisplay(entry.releaseExpectedAt)}
                </span>
              </span>
              <strong>{formatMoney(entry.net)}</strong>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function AccountingExportPanel() {
  const { hasFeature } = usePlanFeatures();
  const { showToast } = useToast();
  const canConnect = hasFeature("accounting_integrations");
  return (
    <Panel title={<span className={styles.titleWithBadge}>Export to accounting software <FeaturePlanBadge feature="accounting_integrations" /></span>} description="Send settlements, fees and payouts to QuickBooks, Xero or Zoho Books every day.">
      <div className={styles.statementRow}>
        <Button iconName="export24" disabled={!canConnect} onClick={() => showToast("Connect your accounting software from Settings › Integrations.", "info")}>
          Connect accounting software
        </Button>
        {!canConnect ? <span className={styles.muted}>Part of the Business plan. You can still download statements and reports any time.</span> : null}
      </div>
    </Panel>
  );
}

export function FinanceSummarySection({ summary, isLoading, errorMessage, onRetry }: { readonly summary: FinanceSummary | null; readonly isLoading: boolean; readonly errorMessage: string | null; readonly onRetry: () => void }) {
  if (summary) return <FinancePeriodTiles summary={summary} />;
  if (errorMessage) return <Callout tone="error" action={<Button size="small" onClick={onRetry}>Try again</Button>}>{errorMessage}</Callout>;
  return isLoading ? <LoadingBlock label="Loading your numbers" /> : null;
}
