"use client";

import Link from "next/link";
import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { PlusIcon, WalletIcon } from "@/components/ui/icons";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { adsHubService } from "@/services/adsHub.service";
import type { Boost } from "@/types/boost.type";
import { AD_STATUS_FILTERS, destinationNounFor, keyResultForBoost, statusesForAdFilter, type AdStatusFilterKey } from "@/utils/adsHub.util";
import { boostDestinationOf } from "@/utils/boostDestination.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import { AdSpendMeter, AdStatusChip, AdsManagerOptionalLink, formatAdDate } from "./adsHubParts";
import styles from "./adsHub.module.css";

export function AdsHubHome() {
  const [filter, setFilter] = useState<AdStatusFilterKey>("all");
  const statuses = statusesForAdFilter(filter);
  const boosts = useInfiniteQuery({
    queryKey: ["ads", "boosts", filter],
    queryFn: ({ pageParam }) => adsHubService.listMyBoosts(statuses, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const balance = useQuery({ queryKey: ["ads", "balance"], queryFn: () => adsHubService.fetchAdBalance(), retry: false });
  const items = boosts.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Ads</h1>
        <Link className={styles.linkButton} href="/ads/create"><PlusIcon size={16} /> Create ad</Link>
      </div>
      {balance.data ? (
        <Link href="/ads/balance" className={`${styles.card} ${styles.rowLink}`} aria-label={`Ad credit and balance: ${formatMoneyForDisplay(balance.data.spendable)} to spend. Open ad balance`}>
          <span className={styles.cardRow}>
            <span className={styles.label}><WalletIcon size={16} /> Ad credit &amp; balance</span>
            <span className={styles.amount}>{formatMoneyForDisplay(balance.data.spendable)} to spend</span>
          </span>
        </Link>
      ) : null}
      <div className={styles.chips} role="group" aria-label="Filter ads by status">
        {AD_STATUS_FILTERS.map((option) => (
          <button key={option.key} type="button" className={[styles.chip, filter === option.key ? styles.chipActive : ""].filter(Boolean).join(" ")} aria-pressed={filter === option.key} onClick={() => setFilter(option.key)}>
            {option.label}
          </button>
        ))}
      </div>
      {boosts.isLoading ? <ListRowsSkeleton label="Loading your ads" rows={4} /> : null}
      {boosts.isError ? <ErrorState description="We couldn't load your ads." error={boosts.error} onRetry={() => void boosts.refetch()} /> : null}
      {boosts.isSuccess && items.length === 0 ? (
        filter === "all" ? (
          <EmptyState kind="generic" title="No ads yet" description="Promote a post, product, your store or your profile to reach more people." action={<Link className={styles.linkButton} href="/ads/create">Create ad</Link>} />
        ) : (
          <p className={styles.note}>No ads with this status.</p>
        )
      ) : null}
      {items.length > 0 ? (
        <ul className={styles.list} aria-label="Your ads">
          {items.map((boost) => <AdListRow key={boost.id} boost={boost} />)}
        </ul>
      ) : null}
      {boosts.hasNextPage ? (
        <button type="button" className={styles.linkButton} disabled={boosts.isFetchingNextPage} onClick={() => void boosts.fetchNextPage()}>
          {boosts.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      ) : null}
      <AdsManagerOptionalLink />
    </div>
  );
}

function AdListRow({ boost }: { readonly boost: Boost }) {
  const destination = boostDestinationOf(boost);
  const keyResult = keyResultForBoost(boost);
  const endsOn = formatAdDate(boost.endsAt);
  return (
    <li>
      <Link href={`/ads/${encodeURIComponent(boost.id)}`} className={`${styles.row} ${styles.rowLink}`}>
        <span className={styles.rowMain}>
          <span className={styles.cardRow}>
            <span className={styles.rowTitle}>{destinationNounFor(destination.type)} ad</span>
            <AdStatusChip status={boost.status} />
          </span>
          <AdSpendMeter spent={boost.spent} budget={boost.totalBudget} />
          <span className={styles.rowMeta}>
            {keyResult.label}: {keyResult.value.toLocaleString()}
            {endsOn ? ` · Ends ${endsOn}` : boost.status === "in_review" ? " · Starts after review" : ""}
          </span>
          {boost.status === "rejected" && boost.rejectionReason ? <span className={styles.error}>{boost.rejectionReason}</span> : null}
        </span>
      </Link>
    </li>
  );
}
