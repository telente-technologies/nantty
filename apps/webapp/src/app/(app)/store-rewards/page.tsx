"use client";

import { useQuery } from "@tanstack/react-query";

import { Avatar } from "@/components/ui/media";
import { InlineLink } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { StoreIcon } from "@/components/ui/icons";
import { storeRewardsService } from "@/services/storeRewards.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "./page.module.css";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";

export default function StoreRewardsPage() {
  const balancesQuery = useQuery({ queryKey: ["store-rewards", "me"], queryFn: () => storeRewardsService.listMyStoreCreditBalances() });

  if (balancesQuery.isLoading) return <ListRowsSkeleton label="Loading store rewards" rows={4} />;
  if (balancesQuery.isError || !balancesQuery.data) {
    return <ErrorState description="We couldn't load your store rewards." error={balancesQuery.error} onRetry={() => void balancesQuery.refetch()} />;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Store rewards</h1>
      <p className={styles.note}>Store credit is funded by each seller. It can only be used at that store, as a discount on a future order. It is not cash and cannot be withdrawn.</p>
      {balancesQuery.data.length === 0 ? (
        <EmptyState icon={<StoreIcon size={28} />} title="No store credit yet" description="Shop at stores that offer rewards and your credit will show up here." action={<InlineLink href="/mart">Browse the mart</InlineLink>} />
      ) : (
        <ul className={styles.list}>
          {balancesQuery.data.map((entry) => (
            <li key={entry.storeId} className={styles.row}>
              <Avatar name={entry.storeName} src={entry.logoUrl} size="md" />
              <span className={styles.text}>
                <span className={styles.name}>{entry.storeName}</span>
                {entry.expiresAt ? <span className={styles.meta}>Expires {new Date(entry.expiresAt).toLocaleDateString()}</span> : null}
              </span>
              <span className={styles.amount}>{formatMoneyForDisplay(entry.balance)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
