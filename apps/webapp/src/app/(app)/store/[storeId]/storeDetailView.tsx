"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { confirmFollowChange } from "@/components/follow/useFollowUser.hook";
import { ProductCard } from "@/components/commerce/productCard";
import { MessageStoreButton } from "@/components/messages/messageStoreButton";
import { useSession } from "@/components/providers/sessionProvider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { StoreIcon } from "@/components/ui/icons";
import { Avatar, MediaImage } from "@/components/ui/media";
import { storesService } from "@/services/stores.service";
import type { StoreDetail } from "@/types/commerce.type";
import type { ProductSummary } from "@/types";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { followConfirmationCopy } from "@/utils/followToggle.util";
import { buildStorePath } from "@/utils/seoPaths.util";
import { canPromoteStore, promoteHrefFor } from "@/utils/promotedEntityAd.util";

import styles from "./storeDetailView.module.css";
import { SearchScopeRegistrar } from "@/components/search/searchScopeRegistrar";

interface StoreDetailViewProps {
  readonly initialStore: StoreDetail;
  readonly initialProducts: readonly ProductSummary[];
}

export function StoreDetailView({ initialStore, initialProducts }: StoreDetailViewProps) {
  const queryClient = useQueryClient();
  const storeQuery = useQuery({ queryKey: ["store", initialStore.id], queryFn: () => storesService.fetchStoreById(initialStore.id), initialData: initialStore, initialDataUpdatedAt: 0, retry: false });
  const productsQuery = useQuery({ queryKey: ["store", initialStore.id, "products"], queryFn: () => storesService.fetchStoreProducts(initialStore.id), initialData: [...initialProducts], initialDataUpdatedAt: 0, retry: false });
  const store = storeQuery.data ?? initialStore;
  const products = productsQuery.data ?? initialProducts;
  const router = useRouter();
  const { viewer } = useSession();
  const myStores = useQuery({ queryKey: ["my-stores"], queryFn: () => storesService.fetchMyStores(), enabled: Boolean(viewer), retry: false, staleTime: 5 * 60_000 });
  const showsPromoteStore = canPromoteStore({ storeId: store.id, storeOwnerUserId: store.ownerUserId, signedInUserId: viewer?.id, myStores: myStores.data });
  const follow = useMutation({
    mutationFn: (followNow: boolean) => (followNow ? storesService.followStore(store.id) : storesService.unfollowStore(store.id)),
    onMutate: async (followNow) => {
      const queryKey = ["store", store.id] as const;
      await queryClient.cancelQueries({ queryKey });
      const previousStore = queryClient.getQueryData<StoreDetail>(queryKey);
      queryClient.setQueryData<StoreDetail>(queryKey, (current) => current ? {
        ...current,
        isFollowing: followNow,
        followers: Math.max(0, current.followers + (followNow ? 1 : -1)),
      } : current);
      return { previousStore, queryKey };
    },
    onError: (_error, _followNow, context) => {
      if (context?.previousStore) queryClient.setQueryData(context.queryKey, context.previousStore);
    },
    onSuccess: (state, _followNow, context) => {
      queryClient.setQueryData<StoreDetail>(context?.queryKey ?? ["store", store.id], (current) => current ? {
        ...current,
        isFollowing: state.isFollowing,
        followers: state.followers,
      } : current);
    },
  });
  const isFollowing = store.isFollowing;
  const confirmAndToggleFollow = async () => {
    if (follow.isPending) return;
    const copy = isFollowing ? followConfirmationCopy("unfollow", store.handle) : null;
    if (copy !== null && !(await confirmFollowChange(copy))) return;
    follow.mutate(!isFollowing);
  };
  const toggleFollow = () => requireAuthThen(() => {
    follow.reset();
    void confirmAndToggleFollow();
  }, `Sign in to follow ${store.name}.`);

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
          <Button size="sm" busy={follow.isPending} onClick={toggleFollow}>
            {isFollowing ? "Following" : "Follow"}
          </Button>
          <MessageStoreButton storeId={store.id} storeName={store.name} />
          {showsPromoteStore ? <Button size="sm" variant="secondary" onClick={() => router.push(promoteHrefFor({ type: "store", targetId: store.id }))}>Promote store</Button> : null}
          <ContentActionsMenu shareKind="store" reportTargetType="user" targetId={store.ownerUserId} canonicalPath={buildStorePath(store.id)} />
        </div>
      </header>
      {follow.isError ? <p className={styles.followError} role="alert">Couldn’t update this store. Check your connection and try again.</p> : null}
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
