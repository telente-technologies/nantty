"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { MediaImage } from "@/components/ui/media";
import { adEventsService } from "@/services/adEvents.service";
import type { AdCard, AdPlacement, AdPlatform, AdTapTarget, ID, SponsoredPlacement } from "@/types";
import { detectAdPlatform, isSignedRedirect, resolveAdTapAction } from "@/utils/adDestination.util";

import styles from "./sponsoredAd.module.css";

interface AdActionProps {
  readonly sponsored: SponsoredPlacement;
  readonly placement: AdPlacement;
  readonly itemId: ID;
  readonly target: AdTapTarget;
  readonly className?: string;
  readonly label?: string;
  readonly children: ReactNode;
}

function useAdPlatform(): AdPlatform {
  const [platform, setPlatform] = useState<AdPlatform>("web");
  useEffect(() => setPlatform(detectAdPlatform(navigator.userAgent)), []);
  return platform;
}

export function AdAction({ sponsored, placement, itemId, target, className, label, children }: AdActionProps) {
  const platform = useAdPlatform();
  const action = resolveAdTapAction(sponsored, target, platform);
  const cardIndex = target.kind === "card" ? target.index : undefined;
  const recordClick = () => void adEventsService.recordClick(sponsored, placement, itemId, cardIndex);
  if (action.kind === "internal") {
    return (
      <Link href={action.href} className={className} aria-label={label} onClick={recordClick}>
        {children}
      </Link>
    );
  }
  if (action.kind === "external" || action.kind === "install") {
    return (
      <a href={action.url} className={className} aria-label={label} target="_blank" rel="noopener noreferrer sponsored" onClick={isSignedRedirect(sponsored, action.url) ? undefined : recordClick}>
        {children}
      </a>
    );
  }
  return <span className={className}>{children}</span>;
}

export function SponsoredMediaLink({ post, placement = "feed", children }: { readonly post: { readonly id: ID; readonly sponsored?: SponsoredPlacement | null }; readonly placement?: AdPlacement; readonly children: ReactNode }) {
  const sponsored = post.sponsored;
  const isTappable = sponsored && (sponsored.mediaClickable || sponsored.adType === "promoted_post" || sponsored.adType === "app_install");
  if (!sponsored || !isTappable) return <>{children}</>;
  return (
    <AdAction sponsored={sponsored} placement={placement} itemId={post.id} target={{ kind: "media" }} className={styles.mediaLink}>
      {children}
    </AdAction>
  );
}

function CarouselCard({ card, index, total, sponsored, placement, itemId }: { readonly card: AdCard; readonly index: number; readonly total: number; readonly sponsored: SponsoredPlacement; readonly placement: AdPlacement; readonly itemId: ID }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void adEventsService.recordCardViewOncePerSession(sponsored, placement, itemId, index);
          observer.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [sponsored, placement, itemId, index]);
  return (
    <div ref={ref} className={styles.card} role="group" aria-label={`Card ${index + 1} of ${total}`}>
      <AdAction sponsored={sponsored} placement={placement} itemId={itemId} target={{ kind: "card", index }} className={styles.mediaLink} label={`${card.headline}. ${card.ctaLabel ?? "Learn more"}`}>
        <span className={styles.cardMedia}>
          <MediaImage src={card.media.kind === "video" ? (card.media.posterUrl ?? card.media.url) : card.media.url} alt="" sizes="280px" />
        </span>
        <span className={styles.cardText}>
          <span className={styles.cardHeadline}>{card.headline}</span>
          {card.description ? <span className={styles.cardDescription}>{card.description}</span> : null}
        </span>
      </AdAction>
      <AdAction sponsored={sponsored} placement={placement} itemId={itemId} target={{ kind: "card", index }} className={`${styles.cta} ${styles.cardCta}`}>
        {card.ctaLabel ?? "Learn more"}
      </AdAction>
    </div>
  );
}

export function SponsoredCarousel({ sponsored, placement, itemId }: { readonly sponsored: SponsoredPlacement; readonly placement: AdPlacement; readonly itemId: ID }) {
  const cards = sponsored.cards ?? [];
  return (
    <div className={styles.carousel} data-swipe-ignore role="group" aria-label={`Carousel of ${cards.length} ads`}>
      {cards.map((card, index) => (
        <CarouselCard key={`${index}:${card.headline}`} card={card} index={index} total={cards.length} sponsored={sponsored} placement={placement} itemId={itemId} />
      ))}
    </div>
  );
}

export function SponsoredAppInstallRow({ sponsored, placement, itemId }: { readonly sponsored: SponsoredPlacement; readonly placement: AdPlacement; readonly itemId: ID }) {
  const app = sponsored.app;
  if (!app) return null;
  return (
    <div className={styles.appRow}>
      <span className={styles.appIcon}>{app.iconUrl ? <MediaImage src={app.iconUrl} alt="" sizes="44px" /> : null}</span>
      <span className={styles.appMeta}>
        <span className={styles.appName}>{app.appName}</span>
        {app.rating ? <span className={styles.appRating} aria-label={`Rated ${app.rating.toFixed(1)} out of 5`}>{app.rating.toFixed(1)} of 5</span> : null}
      </span>
      <AdAction sponsored={sponsored} placement={placement} itemId={itemId} target={{ kind: "cta" }} className={styles.cta} label={`${sponsored.ctaLabel ?? "Install"} ${app.appName}`}>
        {sponsored.ctaLabel ?? "Install"}
      </AdAction>
    </div>
  );
}

export function SponsoredAdBody({ post, placement = "feed" }: { readonly post: { readonly id: ID; readonly sponsored?: SponsoredPlacement | null }; readonly placement?: AdPlacement }) {
  const sponsored = post.sponsored;
  useEffect(() => {
    if (sponsored) void adEventsService.recordImpressionOncePerSession(sponsored, placement, post.id);
  }, [sponsored, placement, post.id]);
  if (!sponsored) return null;
  if (sponsored.adType === "carousel" && (sponsored.cards?.length ?? 0) > 0) return <SponsoredCarousel sponsored={sponsored} placement={placement} itemId={post.id} />;
  if (sponsored.adType === "app_install" && sponsored.app) return <SponsoredAppInstallRow sponsored={sponsored} placement={placement} itemId={post.id} />;
  if (!sponsored.ctaLabel) return null;
  return (
    <AdAction sponsored={sponsored} placement={placement} itemId={post.id} target={{ kind: "cta" }} className={`${styles.cta} ${styles.callToAction}`} label={`${sponsored.ctaLabel}, ${sponsored.advertiserName}`}>
      {sponsored.ctaLabel}
    </AdAction>
  );
}
