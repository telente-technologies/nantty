import { PreviewAvatar, PreviewMedia, VerifiedSeal } from "@/components/creative/adPreviewParts";
import { neighbourLiveCards, neighbourProductTiles } from "@/components/creative/previewNeighbourContent.constant";
import { NanttyIcon } from "@/components/ui/nanttyIcon";
import type { Creative } from "@/types/creative.type";
import { formatMoneyForDisplay } from "@/utils/money.util";
import { formatCompactCount } from "@/utils/numberFormatting.util";

import styles from "./adPreviewSurfaces.module.css";

function AdSign() {
  return (
    <span className={styles.adSign} aria-label="Advertisement">
      Ad
    </span>
  );
}

function SponsoredProductTile({ creative }: { readonly creative: Creative }) {
  const product = creative.product;
  return (
    <article className={`${styles.tile} ${styles.sponsoredTile}`} aria-label="Sponsored product tile">
      <div className={styles.tileImageFrame}>
        <PreviewMedia media={creative.media[0]} altText={product?.title ?? creative.headline} className={styles.tileImage} />
        <AdSign />
      </div>
      <div className={styles.tileBody}>
        <p className={styles.tileTitle}>{product?.title ?? creative.headline}</p>
        {product ? (
          <p className={styles.tilePrice}>
            {formatMoneyForDisplay(product.price)}
            {product.compareAtPrice ? <s className={styles.compareAt}>{formatMoneyForDisplay(product.compareAtPrice)}</s> : null}
          </p>
        ) : null}
        <p className={styles.tileMeta}>
          {product?.rating ? (
            <span className={styles.rating}>
              <NanttyIcon name="star16" size={12} />
              {product.rating.toFixed(1)}
            </span>
          ) : null}
          <span className={styles.storeLine}>
            {creative.identity.name}
            <VerifiedSeal creative={creative} />
          </span>
        </p>
      </div>
    </article>
  );
}

export function MarketplaceGridPreview({ creative, context }: { readonly creative: Creative; readonly context: "mart" | "search" }) {
  const referencePrice = creative.product?.price;
  const organicTiles = neighbourProductTiles.map((tile) => (
    <article key={tile.key} className={styles.tile} aria-hidden>
      <div className={styles.tileImageFrame}>
        <img className={styles.tileImage} src={tile.imageUrl} alt="" />
      </div>
      <div className={styles.tileBody}>
        <p className={styles.tileTitle}>{tile.title}</p>
        {referencePrice ? <p className={styles.tilePrice}>{formatMoneyForDisplay({ amountMinor: Math.round((referencePrice.amountMinor * tile.priceRatio) / 100) * 100, currency: referencePrice.currency })}</p> : null}
        <p className={styles.tileMeta}>
          <span className={styles.rating}>
            <NanttyIcon name="star16" size={12} />
            {tile.rating.toFixed(1)}
          </span>
        </p>
      </div>
    </article>
  ));
  return (
    <div className={styles.marketplace}>
      <div className={styles.marketplaceBar}>
        <NanttyIcon name={context === "search" ? "magnifyingGlass16" : "squaresFour24"} size={14} />
        <span>{context === "search" ? `Search: ${creative.product?.title.split(" ").slice(0, 2).join(" ").toLowerCase() ?? "products"}` : "Mart · For you"}</span>
      </div>
      <div className={styles.marketplaceGrid}>
        {organicTiles[0]}
        <SponsoredProductTile creative={creative} />
        {organicTiles[1]}
        {organicTiles[2]}
      </div>
      <p className={styles.slotNote}>Ads sit at fixed slots (2nd, 7th, 12th…) and are always marked Ad.</p>
    </div>
  );
}

function LiveBadge({ viewerCount, isScheduled }: { readonly viewerCount: number; readonly isScheduled: boolean }) {
  return (
    <span className={styles.liveBadgeRow}>
      <span className={isScheduled ? `${styles.liveBadge} ${styles.scheduledBadge}` : styles.liveBadge}>{isScheduled ? "Soon" : "LIVE"}</span>
      {isScheduled ? null : (
        <span className={styles.viewerCount}>
          <NanttyIcon name="eye16" size={12} />
          {formatCompactCount(viewerCount)}
        </span>
      )}
    </span>
  );
}

export function LiveCardPreview({ creative, variant }: { readonly creative: Creative; readonly variant: "feed" | "reels" }) {
  const live = creative.live;
  const isScheduled = live?.status === "scheduled";
  return (
    <article className={variant === "reels" ? `${styles.liveCard} ${styles.liveCardFullScreen}` : styles.liveCard} aria-label="Promoted live stream">
      <PreviewMedia media={creative.media[0]} altText={creative.headline} className={styles.liveCardMedia} />
      <div className={styles.liveCardTop}>
        <LiveBadge viewerCount={live?.viewerCount ?? 0} isScheduled={isScheduled} />
        <span className={styles.sponsoredOnDark}>Sponsored</span>
      </div>
      <div className={styles.liveCardBottom}>
        <span className={styles.liveHost}>
          <PreviewAvatar creative={creative} size={24} />
          {creative.identity.name}
          <VerifiedSeal creative={creative} />
        </span>
        <p className={styles.liveTitle}>{creative.headline}</p>
        {isScheduled && live ? <p className={styles.liveTime}>Starts {new Date(live.startsAt).toLocaleString("en-NG", { weekday: "short", hour: "numeric", minute: "2-digit" })}</p> : null}
        <span className={styles.liveButton}>{isScheduled ? "Remind me" : "Join live"}</span>
      </div>
    </article>
  );
}

export function LiveDiscoveryPreview({ creative }: { readonly creative: Creative }) {
  return (
    <div className={styles.liveDiscovery}>
      <div className={styles.marketplaceBar}>
        <NanttyIcon name="videoCamera24" size={14} />
        <span>Live now</span>
      </div>
      <div className={styles.liveGrid}>
        <LiveCardPreview creative={creative} variant="feed" />
        {neighbourLiveCards.map((card) => (
          <article key={card.key} className={styles.liveCard} aria-hidden>
            <img className={styles.liveCardMedia} src={card.posterUrl} alt="" />
            <div className={styles.liveCardTop}>
              <LiveBadge viewerCount={card.viewerCount} isScheduled={false} />
            </div>
            <div className={styles.liveCardBottom}>
              <span className={styles.liveHost}>{card.hostName}</span>
              <p className={styles.liveTitle}>{card.title}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function BlockedPlacementNotice({ placementLabel, reason }: { readonly placementLabel: string; readonly reason: string }) {
  return (
    <div className={styles.blockedNotice} role="note">
      <NanttyIcon name="warning20" size={22} />
      <p className={styles.blockedTitle}>Not shown in {placementLabel}</p>
      <p>{reason}</p>
    </div>
  );
}
