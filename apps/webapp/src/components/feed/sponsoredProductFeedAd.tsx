"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { adEventsService } from "@/services/adEvents.service";
import { productsService } from "@/services/products.service";
import type { ID, SponsoredPlacement } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { MediaImage } from "@/components/ui/media";

import { AdAction } from "./sponsoredAd";
import styles from "./sponsoredProductFeedAd.module.css";

const VIEWABILITY_THRESHOLD = 0.5;
const MINIMUM_VIEW_MS = 1_000;

export function SponsoredProductFeedAd({ sponsored, itemId, primaryText }: { readonly sponsored: SponsoredPlacement; readonly itemId: ID; readonly primaryText: string }) {
  const productId = sponsored.destination?.type === "product" ? sponsored.destination.targetId : null;
  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: () => productsService.fetchProductDetailById(productId!),
    enabled: Boolean(productId),
    staleTime: 60_000,
    retry: false,
  });
  const impressionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = impressionRef.current;
    if (!element || !productId || typeof IntersectionObserver === "undefined") return;
    let visibleSince: number | null = null;
    let recorded = false;
    const recordIfViewable = () => {
      if (recorded || visibleSince === null || Date.now() - visibleSince < MINIMUM_VIEW_MS) return;
      recorded = true;
      void adEventsService.recordImpressionOncePerSession(sponsored, "feed", itemId);
      observer.disconnect();
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || entry.intersectionRatio < VIEWABILITY_THRESHOLD) {
        visibleSince = null;
        return;
      }
      if (visibleSince === null) visibleSince = Date.now();
      recordIfViewable();
    }, { threshold: [0, VIEWABILITY_THRESHOLD, 1] });
    const timer = window.setInterval(recordIfViewable, 250);
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [itemId, productId, productQuery.data?.id, sponsored]);

  if (!productId) return null;
  if (productQuery.isLoading) return <div ref={(element) => { impressionRef.current = element; }}><ListRowsSkeleton label="Loading sponsored product" rows={1} /></div>;
  const product = productQuery.data;
  const price = product?.price;
  if (!product || !price) return null;

  return (
    <article ref={(element) => { impressionRef.current = element; }} className={styles.card} aria-label={`Sponsored product: ${product.title}`}>
      <header className={styles.header}>
        <span className={styles.advertiser}>{sponsored.advertiserName}</span>
        <span className={styles.label}>{sponsored.label}</span>
      </header>
      {primaryText ? <p className={styles.copy}>{primaryText}</p> : null}
      <AdAction sponsored={sponsored} placement="feed" itemId={itemId} target={{ kind: "media" }} className={styles.product} label={`${sponsored.ctaLabel ?? "Shop now"}: ${product.title}`}>
        <span className={styles.media}>
          <MediaImage src={product.images[0] ?? null} alt={product.title} sizes="(max-width: 640px) 100vw, 600px" />
        </span>
        <span className={styles.details}>
          <span className={styles.name}>{product.title}</span>
          <span className={styles.price}>{formatMoneyForDisplay(price)}</span>
        </span>
      </AdAction>
      <AdAction sponsored={sponsored} placement="feed" itemId={itemId} target={{ kind: "cta" }} className={styles.cta} label={`${sponsored.ctaLabel ?? "Shop now"}: ${product.title}`}>
        {sponsored.ctaLabel ?? "Shop now"}
      </AdAction>
    </article>
  );
}
