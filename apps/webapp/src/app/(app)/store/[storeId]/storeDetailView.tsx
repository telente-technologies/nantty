"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { ProductCard } from "@/components/commerce/productCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { StoreIcon } from "@/components/ui/icons";
import { Avatar, MediaImage } from "@/components/ui/media";
import { storesService } from "@/services/stores.service";
import type { StoreDetail } from "@/types/commerce.type";
import type { ProductSummary } from "@/types";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { buildStorePath } from "@/utils/seoPaths.util";

import styles from "./storeDetailView.module.css";
import { SearchScopeRegistrar } from "@/components/search/searchScopeRegistrar";

interface StoreDetailViewProps {
  readonly initialStore: StoreDetail;
  readonly initialProducts: readonly ProductSummary[];
}

export function StoreDetailView({ initialStore, initialProducts }: StoreDetailViewProps) {
  const storeQuery = useQuery({ queryKey: ["store", initialStore.id], queryFn: () => storesService.fetchStoreById(initialStore.id), initialData: initialStore, initialDataUpdatedAt: 0, retry: false });
  const productsQuery = useQuery({ queryKey: ["store", initialStore.id, "products"], queryFn: () => storesService.fetchStoreProducts(initialStore.id), initialData: [...initialProducts], initialDataUpdatedAt: 0, retry: false });
  const store = storeQuery.data ?? initialStore;
  const products = productsQuery.data ?? initialProducts;
  const [isFollowing, setIsFollowing] = useState(store.isFollowing);
  const follow = useMutation({
    mutationFn: (followNow: boolean) => (followNow ? storesService.followStore(store.id) : storesService.unfollowStore(store.id)),
    onMutate: (followNow) => setIsFollowing(followNow),
    onError: (_error, followNow) => setIsFollowing(!followNow),
  });

  return (
    <div className={styles.page}>
      <SearchScopeRegistrar scope={`store:${store.id}`} label={store.name} />
      <div className={styles.banner}>{store.bannerUrl ? <MediaImage src={store.bannerUrl} alt="" sizes="100vw" priority /> : null}</div>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.logoWrap}>
            <Avatar name={store.name} src={store.logoUrl} size="xl" />
          </span>
          <div className={styles.nameBlock}>
            <h1 className={styles.name}>{store.name}</h1>
            <span className={styles.handle}>@{store.handle}</span>
          </div>
        </div>
        <div className={styles.actions}>
          <Button size="sm" busy={follow.isPending} onClick={() => requireAuthThen(() => follow.mutate(!isFollowing), `Sign in to follow ${store.name}.`)}>
            {isFollowing ? "Following" : "Follow"}
          </Button>
          <ContentActionsMenu shareKind="store" reportTargetType="user" targetId={store.ownerUserId} canonicalPath={buildStorePath(store.id)} />
        </div>
      </header>
      {store.bio ? <p className={styles.bio}>{store.bio}</p> : null}
      <div className={styles.stats}>
        <span><strong>{formatCountWithThousandsSuffix(store.followers)}</strong>followers</span>
        <span><strong>{formatCountWithThousandsSuffix(store.productsCount)}</strong>products</span>
        <span><strong>{store.rating > 0 ? store.rating.toFixed(1) : "New"}</strong>{store.ratingCount > 0 ? `${formatCountWithThousandsSuffix(store.ratingCount)} ratings` : "rating"}</span>
      </div>
      <h2 className={styles.sectionTitle}>Products</h2>
      {products.length === 0 ? (
        <EmptyState icon={<StoreIcon size={28} />} title="No products yet" description="This store hasn't listed anything yet. Follow it to hear about new drops." />
      ) : (
        <div className={styles.grid}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
