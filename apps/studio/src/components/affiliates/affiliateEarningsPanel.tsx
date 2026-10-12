"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, Muted, StatGrid } from "@/components/ui/studioPage";
import { affiliatesService } from "@/services/affiliates.service";
import type { AffiliateEarning, AffiliateEarningStatus } from "@/types/affiliate.type";
import { affiliatePayoutLabels, attributionSourceLabels, describeAffiliateReversal, formatMoneyList } from "@/utils/affiliateLabels.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "./affiliates.module.css";

const tabs = [
  { value: "pending", label: "Pending" },
  { value: "earned", label: "Earned" },
  { value: "reversed", label: "Reversed" },
] as const;

const emptyCopy: Record<AffiliateEarningStatus, string> = {
  pending: "Sales show here once the buyer pays. They move to Earned when the order completes.",
  earned: "Commissions land here when an order you drove completes.",
  reversed: "Sales refunded, cancelled or returned before completion show here. Nothing was paid for them.",
};

const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

function EarningRow({ earning }: { readonly earning: AffiliateEarning }) {
  const order = earning.orderNumber ? `order #${earning.orderNumber.replace(/^#/, "")}` : "order";
  const amount = earning.status === "reversed" ? earning.reversed : earning.commission;
  return (
    <li className={styles.item}>
      <span className={styles.meta}>{shortDate(earning.orderedAt ?? earning.createdAt)}</span>
      <div className={styles.body}>
        <p className={styles.name}>{`Affiliate commission from ${earning.store.name || "the store"}, ${order} (${earning.product.name || "product"})`}</p>
        <span className={styles.meta}>
          <span>{`${earning.commissionPercent}% of ${formatMoneyForDisplay(earning.sale)}`}</span>
          <span>{attributionSourceLabels[earning.source.source] ?? earning.source.source}</span>
          <span>{earning.status === "reversed" ? describeAffiliateReversal(earning.reason) : affiliatePayoutLabels[earning.payoutStatus]}</span>
        </span>
      </div>
      <strong>{earning.status === "reversed" ? `-${formatMoneyForDisplay(amount)}` : formatMoneyForDisplay(amount)}</strong>
    </li>
  );
}

export function AffiliateEarningsPanel() {
  const [status, setStatus] = useState<AffiliateEarningStatus>("pending");
  const earnings = useInfiniteQuery({
    queryKey: ["affiliates", "earnings", status],
    queryFn: ({ pageParam }) => affiliatesService.listEarnings(status, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const summary = earnings.data?.pages[0]?.summary;
  const rows = earnings.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <Card title="Affiliate earnings">
      <Muted>Commission is paid only when the order completes, never while it is in escrow, shipped or delivered. Refunds, cancellations and disputes settled before completion pay nothing.</Muted>
      {summary ? (
        <StatGrid label="Affiliate earnings totals" stats={[
          { label: "Pending", value: formatMoneyList(summary.pending), hint: "Orders not completed yet" },
          { label: "Earned", value: formatMoneyList(summary.earned), hint: `${formatMoneyList(summary.paid)} already in your wallet` },
          { label: "Reversed", value: formatMoneyList(summary.reversed), hint: "Refunded or cancelled" },
        ]} />
      ) : null}
      <SegmentedControl label="Earnings status" options={tabs} value={status} onChange={setStatus} />
      {earnings.isPending ? <Skeleton height={140} /> : null}
      {earnings.isError ? <ErrorState title="Earnings didn't load" error={earnings.error} onRetry={() => void earnings.refetch()} /> : null}
      {earnings.isSuccess && rows.length === 0 ? <EmptyState title={`No ${status} commissions`} description={emptyCopy[status]} /> : null}
      {rows.length > 0 ? <ul className={styles.list}>{rows.map((earning) => <EarningRow key={earning.id} earning={earning} />)}</ul> : null}
      {earnings.hasNextPage ? <Button variant="secondary" busy={earnings.isFetchingNextPage} onClick={() => void earnings.fetchNextPage()}>Show more</Button> : null}
    </Card>
  );
}
