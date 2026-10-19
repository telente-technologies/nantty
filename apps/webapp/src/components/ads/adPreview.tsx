"use client";

import { useQuery } from "@tanstack/react-query";

import { ProductCard } from "@/components/commerce/productCard";
import { PostCard } from "@/components/feed/postCard";
import { PromotedEntityAdCard } from "@/components/feed/promotedEntityAdCard";
import { useSession } from "@/components/providers/sessionProvider";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { AD_PREVIEW_CAMPAIGN_ID } from "@/services/adEvents.service";
import { postsService } from "@/services/posts.service";
import { sellerService } from "@/services/seller.service";
import { storesService } from "@/services/stores.service";
import type { SponsoredPlacement } from "@/types";
import type { BoostDestination } from "@/utils/boostDestination.util";

import styles from "./adsHub.module.css";

const previewPlacement = (advertiserName: string, extra: Partial<SponsoredPlacement> = {}): SponsoredPlacement => ({ campaignId: AD_PREVIEW_CAMPAIGN_ID, label: "Boosted", advertiserName, ...extra });

export function AdPreview({ destination }: { readonly destination: BoostDestination }) {
  return (
    <section className={styles.section} aria-label="Ad preview">
      <h2 className={styles.sectionTitle}>Preview</h2>
      <p className={styles.note}>This is how your ad looks in the feed. People see it with a Boosted label.</p>
      <div className={styles.preview} inert>
        <AdPreviewBody destination={destination} />
      </div>
    </section>
  );
}

function AdPreviewBody({ destination }: { readonly destination: BoostDestination }) {
  const { viewer } = useSession();
  const post = useQuery({ queryKey: ["post", destination.targetId], queryFn: () => postsService.fetchPostById(destination.targetId), enabled: destination.type === "post", retry: false });
  const store = useQuery({ queryKey: ["store", destination.targetId], queryFn: () => storesService.fetchStoreById(destination.targetId), enabled: destination.type === "store", retry: false });
  const product = useQuery({ queryKey: ["seller", "product", destination.targetId], queryFn: () => sellerService.fetchStoreProductById(destination.targetId), enabled: destination.type === "product", retry: false });
  const failed = post.isError || store.isError || product.isError;
  if (failed) return <p className={styles.note}>We couldn&apos;t load the preview. Your ad can still be submitted.</p>;

  if (destination.type === "post") {
    if (!post.data) return <ListRowsSkeleton label="Loading preview" rows={2} />;
    return <PostCard post={{ ...post.data, sponsored: previewPlacement(post.data.author.name, { adType: "promoted_post" }) }} surface="profile" />;
  }
  if (destination.type === "product") {
    if (!product.data) return <ListRowsSkeleton label="Loading preview" rows={2} />;
    const price = product.data.variants[0]?.price;
    if (!price) return <p className={styles.note}>Add a price to this product to preview it.</p>;
    return (
      <div className={styles.picker}>
        <ProductCard product={{ id: product.data.id, name: product.data.name, price, imageUrl: product.data.images[0]?.url ?? null, sponsored: previewPlacement(product.data.name) }} />
      </div>
    );
  }
  if (destination.type === "store") {
    if (!store.data) return <ListRowsSkeleton label="Loading preview" rows={2} />;
    const promoted = { kind: "store" as const, id: store.data.id, name: store.data.name, handle: store.data.handle, avatarUrl: store.data.logoUrl ?? null, verified: store.data.verified, private: false };
    return <PromotedEntityAdCard sponsored={{ ...previewPlacement(store.data.name), promoted }} placement="feed" itemId={AD_PREVIEW_CAMPAIGN_ID} media={[]} primaryText="" />;
  }
  if (!viewer) return null;
  const promoted = { kind: "profile" as const, id: viewer.id, name: viewer.name, handle: viewer.username, avatarUrl: viewer.avatarUrl ?? null, verified: false, private: viewer.isPrivate === true };
  return <PromotedEntityAdCard sponsored={{ ...previewPlacement(viewer.name), promoted }} placement="feed" itemId={AD_PREVIEW_CAMPAIGN_ID} media={[]} primaryText="" />;
}
