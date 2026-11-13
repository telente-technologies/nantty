"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import type { Clip } from "@/types";
import { ProductCard } from "@/components/commerce/productCard";
import type { FeedModuleSlot } from "@/utils/feedModuleLayout.util";
import { rememberFeedScrollPosition } from "@/utils/feedScrollRestoration.util";

import type { FeedModules } from "./feedModules.hook";
import { GetVerifiedCard } from "./getVerifiedCard";
import { PeopleYouMayKnowRail } from "./peopleYouMayKnowRail";
import { SuggestedClipsRail } from "./suggestedClipsRail";
import { suggestedVideoStartQueryKey } from "./suggestedClipsStream.hook";
import styles from "./feedModules.module.css";

export function FeedModuleRow({ slot, modules }: { readonly slot: FeedModuleSlot; readonly modules: FeedModules }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  if (slot.kind === "getVerified") return <GetVerifiedCard model={modules.getVerified} />;
  if (slot.kind === "peopleYouMayKnow") return <PeopleYouMayKnowRail suggestions={modules.peopleForCarousel(slot.occurrence)} onDismiss={modules.people.dismiss} />;
  if (slot.kind === "productsYouMightLike") {
    const products = modules.recommendations.data?.products ?? [];
    if (products.length === 0) return null;
    return (
      <section className={styles.module} aria-label="Products you might like">
        <div className={styles.header}><h2 className={styles.title}>Products you might like</h2></div>
        <ul className={styles.productSlider}>
          {products.map((product, index) => (
            <li key={product.id}>
              <ProductCard product={product} showStoreDetails onClick={() => modules.trackInteraction("product.clicked", { productId: product.id, surface: "feed_recommendations", position: index })} />
            </li>
          ))}
        </ul>
      </section>
    );
  }
  const openSuggestedVideos = (clip: Clip) => {
    queryClient.setQueryData(suggestedVideoStartQueryKey(clip.id), clip);
    rememberFeedScrollPosition(window.scrollY);
    router.push(`/videos/suggested?start=${encodeURIComponent(clip.id)}`);
  };
  return <SuggestedClipsRail clips={modules.suggestedClips.railClipsFor(slot.occurrence)} onOpenClip={openSuggestedVideos} />;
}
