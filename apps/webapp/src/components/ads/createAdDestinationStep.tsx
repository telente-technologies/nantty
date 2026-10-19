"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useSession } from "@/components/providers/sessionProvider";
import { ErrorState } from "@/components/ui/feedback";
import { MediaImage } from "@/components/ui/media";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { sellerService } from "@/services/seller.service";
import { storesService } from "@/services/stores.service";
import { usersService } from "@/services/users.service";
import type { BoostDestinationType } from "@/types/boost.type";
import { destinationNounFor } from "@/utils/adsHub.util";
import type { BoostDestination } from "@/utils/boostDestination.util";

import styles from "./adsHub.module.css";

const ROLES_THAT_CAN_PROMOTE = new Set(["owner", "manager"]);
const DESTINATION_HINTS: Record<BoostDestinationType, string> = {
  post: "Show one of your posts to more people.",
  product: "Bring shoppers to a product in your store.",
  store: "Bring shoppers to your store page.",
  profile: "Help people find and follow you.",
};

export function usePromotableStore() {
  const { viewer } = useSession();
  const stores = useQuery({ queryKey: ["seller", "stores", "mine"], queryFn: () => storesService.fetchMyStores(), enabled: Boolean(viewer), retry: false });
  const promotable = stores.data?.find((store) => store.isCurrent && ROLES_THAT_CAN_PROMOTE.has(store.role)) ?? stores.data?.find((store) => ROLES_THAT_CAN_PROMOTE.has(store.role)) ?? null;
  return { store: promotable, isLoading: stores.isLoading };
}

interface CreateAdDestinationStepProps {
  readonly destinationType: BoostDestinationType;
  readonly destination: BoostDestination | null;
  readonly onDestinationTypeChange: (type: BoostDestinationType) => void;
  readonly onDestinationChange: (destination: BoostDestination) => void;
}

export function CreateAdDestinationStep({ destinationType, destination, onDestinationTypeChange, onDestinationChange }: CreateAdDestinationStepProps) {
  const { viewer } = useSession();
  const { store } = usePromotableStore();
  const types: readonly BoostDestinationType[] = store ? ["post", "product", "store", "profile"] : ["post", "profile"];
  return (
    <section className={styles.section} aria-label="What to promote">
      <h2 className={styles.sectionTitle}>What do you want to promote?</h2>
      <div className={styles.options} role="radiogroup" aria-label="Promotion type">
        {types.map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={destinationType === type}
            className={[styles.option, destinationType === type ? styles.optionSelected : ""].filter(Boolean).join(" ")}
            onClick={() => {
              onDestinationTypeChange(type);
              if (type === "store" && store) onDestinationChange({ type, targetId: store.storeId });
              if (type === "profile" && viewer) onDestinationChange({ type, targetId: viewer.id });
            }}
          >
            <span className={styles.optionTitle}>{type === "store" || type === "profile" ? `My ${destinationNounFor(type).toLowerCase()}` : `A ${destinationNounFor(type).toLowerCase()}`}</span>
            <span className={styles.optionHint}>{type === "store" && store ? `${store.storeName}. ${DESTINATION_HINTS[type]}` : DESTINATION_HINTS[type]}</span>
          </button>
        ))}
      </div>
      {destinationType === "post" && viewer ? <MyPostsPicker userId={viewer.id} selectedId={destination?.type === "post" ? destination.targetId : null} onPick={(postId) => onDestinationChange({ type: "post", targetId: postId })} /> : null}
      {destinationType === "product" ? <MyProductsPicker selectedId={destination?.type === "product" ? destination.targetId : null} onPick={(productId) => onDestinationChange({ type: "product", targetId: productId })} /> : null}
      {!store && (destinationType === "store" || destinationType === "product") ? <p className={styles.note}>Only store owners and managers can promote a store or its products.</p> : null}
    </section>
  );
}

function MyPostsPicker({ userId, selectedId, onPick }: { readonly userId: string; readonly selectedId: string | null; readonly onPick: (postId: string) => void }) {
  const posts = useInfiniteQuery({
    queryKey: ["ads", "myPosts", userId],
    queryFn: ({ pageParam }) => usersService.fetchPostsByUserId(userId, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  if (posts.isLoading) return <ListRowsSkeleton label="Loading your posts" rows={3} />;
  if (posts.isError) return <ErrorState description="We couldn't load your posts." error={posts.error} onRetry={() => void posts.refetch()} />;
  const items = posts.data?.pages.flatMap((page) => page.data) ?? [];
  if (items.length === 0) return <p className={styles.note}>You haven&apos;t posted anything yet. Share a post first, then promote it.</p>;
  return (
    <div className={styles.section}>
      <div className={styles.picker} role="radiogroup" aria-label="Choose a post">
        {items.map((post) => {
          const cover = post.media[0]?.posterUrl ?? post.media[0]?.url ?? null;
          const summary = post.text.trim() || (post.media.length > 0 ? `${post.media.length} media item${post.media.length === 1 ? "" : "s"}` : "Post");
          return (
            <button key={post.id} type="button" role="radio" aria-checked={selectedId === post.id} aria-label={`Post: ${summary}`} className={[styles.pickerItem, selectedId === post.id ? styles.optionSelected : ""].filter(Boolean).join(" ")} onClick={() => onPick(post.id)}>
              {cover ? <span className={styles.pickerThumb}><MediaImage src={cover} alt="" sizes="160px" /></span> : null}
              <span className={styles.pickerText}>{summary}</span>
            </button>
          );
        })}
      </div>
      {posts.hasNextPage ? <button type="button" className={styles.linkButton} disabled={posts.isFetchingNextPage} onClick={() => void posts.fetchNextPage()}>{posts.isFetchingNextPage ? "Loading…" : "Show more posts"}</button> : null}
    </div>
  );
}

function MyProductsPicker({ selectedId, onPick }: { readonly selectedId: string | null; readonly onPick: (productId: string) => void }) {
  const products = useQuery({ queryKey: ["seller", "products"], queryFn: () => sellerService.listMyStoreProducts(), retry: false });
  if (products.isLoading) return <ListRowsSkeleton label="Loading your products" rows={3} />;
  if (products.isError) return <ErrorState description="We couldn't load your products." error={products.error} onRetry={() => void products.refetch()} />;
  const active = (products.data ?? []).filter((product) => product.status === "active");
  if (active.length === 0) return <p className={styles.note}>You have no active products. Publish a product first, then promote it.</p>;
  return (
    <div className={styles.picker} role="radiogroup" aria-label="Choose a product">
      {active.map((product) => (
        <button key={product.id} type="button" role="radio" aria-checked={selectedId === product.id} aria-label={`Product: ${product.name}`} className={[styles.pickerItem, selectedId === product.id ? styles.optionSelected : ""].filter(Boolean).join(" ")} onClick={() => onPick(product.id)}>
          <span className={styles.pickerThumb}><MediaImage src={product.images[0]?.url ?? null} alt="" sizes="160px" /></span>
          <span className={styles.pickerText}>{product.name}</span>
        </button>
      ))}
    </div>
  );
}
