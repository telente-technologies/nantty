"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Skeleton } from "@nantty/web-kit";

import { useFollowUser } from "@/components/follow/useFollowUser.hook";
import { useSession } from "@/components/providers/sessionProvider";
import { CoinIcon, TrendingIcon } from "@/components/ui/icons";
import { Avatar, MediaImage } from "@/components/ui/media";
import { cartsService } from "@/services/carts.service";
import { discoveryService } from "@/services/discovery.service";
import { walletsService } from "@/services/wallets.service";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import type { UserSummary } from "@/types";

import styles from "./rightRail.module.css";

function RailModuleSkeleton({ rows }: { readonly rows: number }) {
  return (
    <div className={styles.skeletonRows}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={36} />
      ))}
    </div>
  );
}

export function WalletSummaryModule() {
  const { viewer } = useSession();
  const walletQuery = useQuery({ queryKey: ["rail", "wallet"], queryFn: walletsService.fetchMyWalletSummary, retry: false, staleTime: 60_000 });
  const coinsQuery = useQuery({ queryKey: ["rail", "coins"], queryFn: walletsService.fetchMyCoinBalance, retry: false, staleTime: 60_000 });
  if (walletQuery.isError && coinsQuery.isError) return null;
  return (
    <section className={[styles.module, styles.walletModule].join(" ")} aria-labelledby="rail-wallet-title">
      <h2 id="rail-wallet-title" className={styles.moduleTitle}>
        Wallet
      </h2>
      {walletQuery.isLoading ? (
        <RailModuleSkeleton rows={2} />
      ) : (
        <dl className={styles.walletFigures}>
          <div>
            <dt>Available</dt>
            <dd className={styles.walletAmount}>{walletQuery.data ? formatMoneyForDisplay(walletQuery.data.available) : "—"}</dd>
          </div>
          <div>
            <dt>In escrow</dt>
            <dd>{walletQuery.data ? formatMoneyForDisplay(walletQuery.data.pending) : "—"}</dd>
          </div>
          <div>
            <dt>Coins</dt>
            <dd className={styles.coinFigure}>
              <CoinIcon size={16} />
              {coinsQuery.data ? formatCountWithThousandsSuffix(coinsQuery.data.coins) : "—"}
            </dd>
          </div>
        </dl>
      )}
      <Link href={viewer?.isCreator ? "/creator" : "/orders"} className={styles.moduleLink}>
        {viewer?.isCreator ? "Earnings and payouts" : "Orders and escrow"}
      </Link>
    </section>
  );
}

function SuggestedAccountRow({ account }: { readonly account: UserSummary }) {
  const follow = useFollowUser({ userId: account.id, username: account.username, displayName: account.name, initialState: "none" });
  return (
    <li className={styles.accountRow}>
      <Link href={`/${account.username}`} className={styles.accountLink}>
        <Avatar name={account.name} src={account.avatarUrl} size="sm" />
        <span className={styles.accountText}>
          <span className={styles.accountName}>{account.name}</span>
          <span className={styles.accountHandle}>@{account.username}</span>
        </span>
      </Link>
      <button
        type="button"
        className={[styles.followButton, follow.isActive ? styles.followButtonActive : ""].join(" ")}
        aria-pressed={follow.isActive}
        aria-label={`${follow.isActive ? "Unfollow" : "Follow"} ${account.name}`}
        disabled={follow.isPending}
        onClick={follow.toggle}
      >
        {follow.label}
      </button>
    </li>
  );
}

export function SuggestedAccountsModule() {
  const { viewer } = useSession();
  const accountsQuery = useQuery({ queryKey: ["rail", "suggestedAccounts"], queryFn: discoveryService.fetchSuggestedAccounts, retry: false, staleTime: 5 * 60_000, enabled: viewer !== null });
  if (viewer === null || accountsQuery.isError || (accountsQuery.data && accountsQuery.data.length === 0)) return null;
  return (
    <section className={styles.module} aria-labelledby="rail-suggested-title">
      <h2 id="rail-suggested-title" className={styles.moduleTitle}>
        Who to follow
      </h2>
      {accountsQuery.isLoading ? (
        <RailModuleSkeleton rows={4} />
      ) : (
        <ul className={styles.list}>
          {accountsQuery.data?.map((account) => (
            <SuggestedAccountRow key={account.id} account={account} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function TrendingModule() {
  const trendingQuery = useQuery({ queryKey: ["rail", "trending"], queryFn: discoveryService.fetchTrendingTopics, retry: false, staleTime: 5 * 60_000 });
  if (trendingQuery.isError) return null;
  return (
    <section className={styles.module} aria-labelledby="rail-trending-title">
      <h2 id="rail-trending-title" className={styles.moduleTitle}>
        <TrendingIcon size={18} /> Trending in Nigeria
      </h2>
      {trendingQuery.isLoading ? (
        <RailModuleSkeleton rows={4} />
      ) : (
        <ol className={styles.list}>
          {trendingQuery.data?.map((topic) => (
            <li key={topic.tag}>
              <Link href={`/explore?q=${encodeURIComponent(topic.tag)}`} className={styles.trendLink}>
                <span className={styles.trendCategory}>{topic.category}</span>
                <span className={styles.trendTag}>{topic.tag}</span>
                <span className={styles.trendCount}>{formatCountWithThousandsSuffix(topic.postCount)} posts</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function CartSummaryModule() {
  const cartQuery = useQuery({ queryKey: ["shell", "cart"], queryFn: () => cartsService.fetchMyCart(), retry: false, staleTime: 20_000 });
  const items = cartQuery.data?.items ?? [];
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  return (
    <section className={styles.module} aria-labelledby="rail-cart-title">
      <h2 id="rail-cart-title" className={styles.moduleTitle}>
        Your cart
      </h2>
      {cartQuery.isLoading ? (
        <RailModuleSkeleton rows={3} />
      ) : items.length === 0 ? (
        <p className={styles.mutedText}>Your cart is empty. Items you add show up here.</p>
      ) : (
        <>
          <ul className={styles.cartThumbs}>
            {items.slice(0, 4).map((item) => (
              <li key={item.id} className={styles.cartThumb}>
                <MediaImage src={item.product.imageUrl} alt={item.product.name} sizes="56px" />
              </li>
            ))}
          </ul>
          <p className={styles.cartTotalRow}>
            <span>
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            <strong>{cartQuery.data ? formatMoneyForDisplay(cartQuery.data.total) : ""}</strong>
          </p>
          <Link href="/cart" className={styles.primaryLink}>
            Review cart
          </Link>
        </>
      )}
    </section>
  );
}
