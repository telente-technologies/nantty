"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, DataRows } from "@/components/ui/studioPage";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { creatorService } from "@/services/creator.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const kindLabels: Record<string, string> = { gift: "Gift", tip: "Tip", subscription: "Subscription", affiliate: "Affiliate", ad_revenue: "Ad share" };
const statusLabels: Record<string, string> = { pending: "Pending", available: "Available", reversed: "Reversed (refunded or charged back)" };
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function EarningsHistoryCard() {
  const earnings = useInfiniteQuery({
    queryKey: ["creator", "earnings"],
    queryFn: ({ pageParam }) => creatorService.listEarnings(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const items = earnings.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <Card title="Earnings history">
      {earnings.isError ? <ErrorState title="Earnings history didn't load" description={readErrorMessageForDisplay(earnings.error)} onRetry={() => void earnings.refetch()} /> : null}
      {earnings.isLoading ? <Skeleton height={120} /> : null}
      {earnings.isSuccess && items.length === 0 ? <EmptyState title="No earnings yet" description="Each gift, tip, subscription and commission appears here with when it becomes available to withdraw." /> : null}
      <DataRows
        rows={items.map((item) => ({
          key: item.id,
          label: item.description || kindLabels[item.kind] || item.kind,
          detail: `${kindLabels[item.kind] ?? item.kind} · ${shortDate(item.createdAt)} · ${statusLabels[item.status] ?? item.status}${item.status === "pending" && item.availableAt ? `, available ${shortDate(item.availableAt)}` : ""}`,
          value: formatMoneyForDisplay(item.amount),
        }))}
      />
      {earnings.hasNextPage ? <Button variant="secondary" busy={earnings.isFetchingNextPage} onClick={() => void earnings.fetchNextPage()}>Load older earnings</Button> : null}
    </Card>
  );
}

const withdrawalLabels: Record<string, string> = { pending_review: "In safety review", on_hold: "On hold", queued: "Queued", processing: "Sending", paid: "Paid", failed: "Failed", cancelled: "Cancelled" };

export function WithdrawalsCard() {
  const withdrawals = useQuery({ queryKey: ["wallet", "withdrawals"], queryFn: creatorService.listWithdrawals });
  return (
    <Card title="Withdrawals">
      {withdrawals.isError ? <ErrorState title="Withdrawals didn't load" description={readErrorMessageForDisplay(withdrawals.error)} onRetry={() => void withdrawals.refetch()} /> : null}
      {withdrawals.isLoading ? <Skeleton height={80} /> : null}
      {withdrawals.data && withdrawals.data.data.length === 0 ? <EmptyState title="No withdrawals yet" description="Once your payout details are verified, withdraw any available balance to your bank." /> : null}
      <DataRows
        rows={(withdrawals.data?.data ?? []).map((item) => ({
          key: item.id,
          label: `${formatMoneyForDisplay(item.netAmount)} to your bank`,
          detail: `${shortDate(item.createdAt)} · ${withdrawalLabels[item.withdrawalStatus] ?? item.withdrawalStatus} · fee ${formatMoneyForDisplay(item.fee)} · ref ${item.reference}${item.failureReason ? ` · ${item.failureReason}` : ""}`,
          value: formatMoneyForDisplay(item.amount),
        }))}
      />
    </Card>
  );
}

export function RevenueRulesCard() {
  const rules = useQuery({ queryKey: ["creator", "revenue-rules"], queryFn: creatorService.fetchRevenueRules, staleTime: 10 * 60_000 });
  const status = useQuery({ queryKey: ["creator", "status"], queryFn: creatorService.fetchStatus });
  if (rules.isError) return <ErrorState title="Revenue shares didn't load" description={readErrorMessageForDisplay(rules.error)} onRetry={() => void rules.refetch()} />;
  if (!rules.data) return <Skeleton height={160} />;
  const data = rules.data;
  return (
    <Card title="What you keep">
      <DataRows
        rows={[
          { key: "gift", label: "Gifts", detail: status.data?.giftSharePercent ? `Your tier: ${status.data.giftSharePercent}%` : undefined, value: `up to ${data.giftCreatorSharePercentUpTo}%` },
          { key: "tip", label: "Tips", value: `${data.tipCreatorSharePercent}%` },
          { key: "subscription", label: "Subscriptions", detail: data.subscriptionShareBasis === "net_of_store_fee" ? "After Apple or Google's fee on in-app purchases" : undefined, value: `${data.subscriptionCreatorSharePercent}%` },
          { key: "ads", label: "Ad revenue on your content", value: `${data.adsRevenueCreatorSharePercent}%` },
          { key: "affiliate", label: "Affiliate commission", detail: data.affiliateCommissionReleasedAfterEscrow ? "Paid after the buyer confirms delivery" : undefined, value: `up to ${data.affiliateCommissionMaximumPercent}%` },
          { key: "coin", label: "Value of 1 earned coin", value: formatMoneyForDisplay(data.coinCashValue) },
          { key: "minimum", label: "Minimum withdrawal", value: formatMoneyForDisplay(data.minimumPayout) },
          { key: "fee", label: "Withdrawal fee", value: data.withdrawalFeeDescription },
        ]}
      />
    </Card>
  );
}
