"use client";

import { useEffect, useMemo, useRef } from "react";

import { AppIcon } from "@/components/ui/appIcon";
import { Avatar, MediaImage } from "@/components/ui/media";
import { AdAction, SponsoredAppInstallRow, SponsoredCarousel } from "@/components/feed/sponsoredAd";
import { adEventsService } from "@/services/adEvents.service";
import { sponsoredPlacementFromDecidedAd } from "@/utils/adCreativeMapping.util";
import type { ThreadDecidedAd } from "@/types/postThread.type";

import styles from "./thread.module.css";

const IMPRESSION_VISIBLE_RATIO = 0.5;
const IMPRESSION_VISIBLE_MS = 1_000;

export function SponsoredThreadItem({ ad, postId }: { readonly ad: ThreadDecidedAd; readonly postId: string }) {
  const rootRef = useRef<HTMLElement | null>(null);
  const { creative } = ad;
  const image = creative.media.find((item) => item.kind === "image");
  const sponsored = useMemo(() => sponsoredPlacementFromDecidedAd(ad), [ad]);
  const isCarousel = sponsored.adType === "carousel" && (sponsored.cards?.length ?? 0) > 0;
  const isInstall = sponsored.adType === "app_install" && Boolean(sponsored.app);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !timer) {
          timer = setTimeout(() => {
            void adEventsService.recordImpressionOncePerSession(sponsored, "feedCommentThread", postId);
            observer.disconnect();
          }, IMPRESSION_VISIBLE_MS);
        } else if (!entry?.isIntersecting && timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: IMPRESSION_VISIBLE_RATIO },
    );
    observer.observe(element);
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [sponsored, postId]);

  return (
    <article ref={rootRef} className={[styles.row, styles.sponsored].join(" ")} aria-label={`Promoted by ${creative.identity.name}`}>
      <div className={styles.rail}>
        <Avatar name={creative.identity.name} src={creative.identity.avatarUrl} size="md" />
      </div>
      <div className={styles.body}>
        <p className={styles.meta}>
          <span className={styles.name}>{creative.identity.name}</span>
          {creative.identity.verifiedBusiness ? (
            <span className={styles.verified} aria-label="Verified business">
              <AppIcon name="check16" size={10} />
            </span>
          ) : null}
          <span className={styles.handle}>@{creative.identity.handle}</span>
        </p>
        <p className={styles.text}>{creative.primaryText}</p>
        {isCarousel ? <SponsoredCarousel sponsored={sponsored} placement="feedCommentThread" itemId={postId} /> : null}
        {isInstall ? <SponsoredAppInstallRow sponsored={sponsored} placement="feedCommentThread" itemId={postId} /> : null}
        {isCarousel || isInstall ? null : (
          <AdAction sponsored={sponsored} placement="feedCommentThread" itemId={postId} target={{ kind: "cta" }} className={styles.adCard} label={`${creative.headline}, ${sponsored.ctaLabel}`}>
            {image ? (
              <span className={styles.adMedia} style={{ aspectRatio: `${image.width} / ${Math.max(image.height, 1)}` }}>
                <MediaImage src={image.url} alt="" sizes="(max-width: 768px) 80vw, 520px" />
              </span>
            ) : null}
            <span className={styles.adFooter}>
              <span className={styles.adHeadline}>{creative.headline}</span>
              <span className={styles.adCta}>{sponsored.ctaLabel}</span>
            </span>
          </AdAction>
        )}
        <p className={styles.promoted}>{ad.label}</p>
      </div>
    </article>
  );
}
