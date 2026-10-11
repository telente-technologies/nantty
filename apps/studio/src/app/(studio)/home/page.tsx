"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { usePayoutStateQuery } from "@/components/payouts/payoutStateQuery.hook";
import { SegmentedControl } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, DataRows, Muted, NextActionList, PageHeader, StatGrid, pageStyles } from "@/components/ui/studioPage";
import { accountHealthService } from "@/services/accountHealth.service";
import { creatorService } from "@/services/creator.service";
import { livesService } from "@/services/lives.service";
import { subscriptionsService } from "@/services/subscriptions.service";
import { walletService } from "@/services/wallet.service";
import type { DashboardPeriod } from "@/types/creator.type";
import { buildCreatorNextActions } from "@/utils/creatorNextActions.util";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const periodOptions = [
  { value: "today", label: "Today" },
  { value: "week", label: "7 days" },
  { value: "month", label: "30 days" },
  { value: "all", label: "All time" },
] as const;

export default function StudioHomePage() {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const dashboard = useQuery({ queryKey: ["creator", "dashboard", period], queryFn: () => creatorService.fetchDashboard(period) });
  const status = useQuery({ queryKey: ["creator", "status"], queryFn: creatorService.fetchStatus });
  const health = useQuery({ queryKey: ["account", "status"], queryFn: accountHealthService.fetchMine, staleTime: 60_000 });
  const wallet = useQuery({ queryKey: ["wallet", "me"], queryFn: walletService.fetchMine });
  const plans = useQuery({ queryKey: ["subscription-plans"], queryFn: subscriptionsService.listPlans });
  const lives = useQuery({ queryKey: ["lives"], queryFn: () => livesService.listLives() });
  const payout = usePayoutStateQuery();
  const actions = buildCreatorNextActions({ health: health.data, status: status.data, wallet: wallet.data, payout: payout.data, plans: plans.data, lives: lives.data });
  const signalsLoading = health.isLoading || wallet.isLoading || plans.isLoading || lives.isLoading;

  return (
    <div className={pageStyles.page}>
      <PageHeader title="Home" subtitle="What needs you now, and how you're earning." />
      <Card title="Do next">
        {signalsLoading ? <Skeleton height={72} /> : actions.length > 0 ? <NextActionList actions={actions} /> : <Muted>Nothing needs you right now. Post a clip or schedule your next live to keep growing.</Muted>}
      </Card>
      <Card title="Earnings" action={<SegmentedControl label="Period" options={periodOptions} value={period} onChange={setPeriod} />}>
        {dashboard.isError ? (
          <ErrorState title="Earnings didn't load" error={dashboard.error} onRetry={() => void dashboard.refetch()} />
        ) : !dashboard.data ? (
          <Skeleton height={120} />
        ) : (
          <>
            <StatGrid
              label="Earnings in period"
              stats={[
                { label: "Total earned", value: formatMoneyForDisplay(dashboard.data.earnings.total) },
                { label: "Gifts and tips", value: formatMoneyForDisplay(dashboard.data.earnings.gifts) },
                { label: "Subscriptions", value: formatMoneyForDisplay(dashboard.data.earnings.subscriptions) },
                { label: "Affiliate commission", value: formatMoneyForDisplay(dashboard.data.earnings.affiliateCommissions) },
              ]}
            />
            <StatGrid
              label="Balances"
              stats={[
                { label: "Available", value: formatMoneyForDisplay(dashboard.data.availableBalance), hint: "Creator earnings you can withdraw" },
                { label: "Coins not yet cashed", value: formatMoneyForDisplay(dashboard.data.pendingBalance), hint: `${formatCountWithThousandsSuffix(dashboard.data.coins.earned)} earned coins` },
                { label: "Followers", value: formatCountWithThousandsSuffix(dashboard.data.followers.total), hint: dashboard.data.followers.gainedInPeriod !== null ? `+${formatCountWithThousandsSuffix(dashboard.data.followers.gainedInPeriod)} in period` : undefined },
              ]}
            />
            <Link href="/earnings" className={pageStyles.textLink}>See every earning and payout</Link>
          </>
        )}
      </Card>
      <Card title="Top lives by gifts">
        {dashboard.data && dashboard.data.topContent.length > 0 ? (
          <DataRows rows={dashboard.data.topContent.map((item) => ({ key: item.id, label: <Link href={`/lives/${item.id}`}>{item.title || "Untitled live"}</Link>, value: formatMoneyForDisplay(item.earnings) }))} />
        ) : dashboard.data ? (
          <EmptyState title="No gifts in this period" description="Gifts sent during your lives show here, ranked by what they earned you." />
        ) : (
          <Skeleton height={80} />
        )}
      </Card>
    </div>
  );
}
