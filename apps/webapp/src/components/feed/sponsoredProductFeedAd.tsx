"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { adEventsService } from "@/services/adEvents.service";
import { productsService } from "@/services/products.service";
import type { ID, SponsoredPlacement } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { MediaImage } from "@/components/ui/media";
import { qualifiesAsProductAdImpression, PRODUCT_AD_VIEWABILITY_THRESHOLD } from "@/utils/productAdViewability.util";

import { AdAction } from "./sponsoredAd";
import styles from "./sponsoredProductFeedAd.module.css";

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
  const product = productQuery.data;
  const price = product?.price;
  const productReady = Boolean(product && price);

  useEffect(() => {
    const element = impressionRef.current;
    if (!element || !productId || !productReady || typeof IntersectionObserver === "undefined") return;
    let visibleSince: number | null = null;
    let recorded = false;
    let intersectionRatio = 0;
    const recordIfViewable = () => {
      if (recorded || visibleSince === null || !qualifiesAsProductAdImpression({ productReady, pageVisible: document.visibilityState === "visible", intersectionRatio, visibleForMs: Date.now() - visibleSince })) return;
      recorded = true;
      void adEventsService.recordImpressionOncePerSession(sponsored, "feed", itemId);
      observer.disconnect();
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || entry.intersectionRatio < PRODUCT_AD_VIEWABILITY_THRESHOLD) {
        visibleSince = null;
        intersectionRatio = 0;
        return;
      }
      intersectionRatio = entry.intersectionRatio;
      if (visibleSince === null) visibleSince = Date.now();
      recordIfViewable();
    }, { threshold: [0, PRODUCT_AD_VIEWABILITY_THRESHOLD, 1] });
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        visibleSince = null;
        intersectionRatio = 0;
        return;
      }
      visibleSince = null;
      intersectionRatio = 0;
      observer.unobserve(element);
      observer.observe(element);
    };
    const timer = window.setInterval(recordIfViewable, 250);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [itemId, productId, productReady, sponsored]);

  if (!productId) return null;
  if (productQuery.isLoading) return <div><ListRowsSkeleton label="Loading sponsored product" rows={1} /></div>;
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
