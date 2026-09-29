import { PreviewAvatar, PreviewMedia, SponsoredLabel, VerifiedSeal } from "@/components/creative/adPreviewParts";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { callToActionLabels } from "@/constants/campaignOptions.constant";
import type { Creative } from "@/types/creative.type";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./adPreview.module.css";

function CallToActionButton({ creative }: { readonly creative: Creative }) {
  return (
    <span className={styles.callToAction} role="presentation">
      {callToActionLabels[creative.callToAction]}
    </span>
  );
}

export function FeedCardPreview({ creative }: { readonly creative: Creative }) {
  return (
    <article className={styles.feedCard} aria-label="Feed ad preview">
      <div className={styles.authorRow}>
        <div className={styles.author}>
          <PreviewAvatar creative={creative} />
          <span className={styles.authorName}>{creative.identity.name}</span>
          <VerifiedSeal creative={creative} />
          <span className={styles.dot} aria-hidden />
          <span className={styles.authorName}>Now</span>
          <SponsoredLabel />
        </div>
        <ZudoIcon name="dotsThreeVertical24" size={20} />
      </div>
      {creative.primaryText ? <p className={styles.bodyText}>{creative.primaryText}</p> : null}
      <PreviewMedia media={creative.media[0]} altText={creative.headline} className={styles.squareMedia} />
      {creative.media.length > 1 ? <p className={styles.carouselHint}>1 / {creative.media.length}</p> : null}
      <div className={styles.feedCallToAction}>
        <CallToActionButton creative={creative} />
      </div>
      <div className={styles.interactions} aria-hidden>
        <span className={styles.counter}>
          <ZudoIcon name="heart24Alt" size={20} />0
        </span>
        <span className={styles.counter}>
          <ZudoIcon name="brandLine24" size={20} />0
        </span>
        <span className={styles.counter}>
          <ZudoIcon name="refresh24" size={20} />0
        </span>
        <ZudoIcon name="share24" size={20} />
      </div>
    </article>
  );
}

export function ClipPreview({ creative, variant }: { readonly creative: Creative; readonly variant: "clip" | "story" }) {
  return (
    <article className={styles.fullScreen} aria-label={variant === "clip" ? "Clip ad preview" : "Story ad preview"}>
      <PreviewMedia media={creative.media[0]} altText={creative.headline} className={styles.fullScreenMedia} />
      {variant === "story" ? (
        <div className={styles.storyTop}>
          <span className={styles.storyProgress} />
          <div className={styles.author}>
            <PreviewAvatar creative={creative} size={28} />
            <span className={styles.overlayName}>{creative.identity.name}</span>
            <VerifiedSeal creative={creative} />
            <SponsoredLabel inverted />
          </div>
        </div>
      ) : null}
      <div className={styles.overlay}>
        {variant === "clip" ? (
          <div className={styles.author}>
            <PreviewAvatar creative={creative} size={28} />
            <span className={styles.overlayName}>{creative.identity.name}</span>
            <VerifiedSeal creative={creative} />
            <SponsoredLabel inverted />
          </div>
        ) : null}
        <p className={styles.overlayHeadline}>{creative.headline}</p>
        {creative.primaryText ? <p className={styles.overlayText}>{creative.primaryText}</p> : null}
        <CallToActionButton creative={creative} />
      </div>
      {variant === "clip" ? (
        <div className={styles.clipActions} aria-hidden>
          <ZudoIcon name="heart24" size={24} />
          <ZudoIcon name="chatCircle24" size={24} />
          <ZudoIcon name="share24" size={24} />
        </div>
      ) : null}
    </article>
  );
}

export function ProductTilePreview({ creative }: { readonly creative: Creative }) {
  const product = creative.product;
  return (
    <div className={styles.martGrid}>
      <article className={styles.productTile} aria-label="Mart product tile preview">
        <PreviewMedia media={creative.media[0]} altText={product?.title ?? creative.headline} className={styles.squareMedia} />
        <div className={styles.productBody}>
          <p className={styles.productTitle}>{product?.title ?? creative.headline}</p>
          {product ? (
            <p className={styles.productPrice}>
              {formatMoneyForDisplay(product.price)}
              {product.compareAtPrice ? <s className={styles.compareAt}>{formatMoneyForDisplay(product.compareAtPrice)}</s> : null}
            </p>
          ) : null}
          <p className={styles.productMeta}>
            {product?.rating ? (
              <span className={styles.rating}>
                <ZudoIcon name="star16" size={12} />
                {product.rating.toFixed(1)}
              </span>
            ) : null}
            <SponsoredLabel />
          </p>
        </div>
      </article>
      <div className={styles.ghostTile} aria-hidden />
    </div>
  );
}

export function StoreCardPreview({ creative }: { readonly creative: Creative }) {
  return (
    <article className={styles.storeCard} aria-label="Store card preview">
      <div className={styles.storeHeader}>
        <PreviewAvatar creative={creative} size={40} />
        <div>
          <p className={styles.storeName}>
            {creative.identity.name} <VerifiedSeal creative={creative} />
          </p>
          <p className={styles.storeHandle}>
            @{creative.identity.handle} · <SponsoredLabel />
          </p>
        </div>
      </div>
      <div className={styles.storeStrip}>
        {creative.media.slice(0, 3).map((media) => (
          <PreviewMedia key={media.id} media={media} altText={creative.headline} className={styles.storeThumb} />
        ))}
        {creative.media.length === 0 ? <PreviewMedia media={undefined} altText="" className={styles.storeThumb} /> : null}
      </div>
      <p className={styles.bodyText}>{creative.primaryText || creative.headline}</p>
      <div className={styles.feedCallToAction}>
        <CallToActionButton creative={creative} />
      </div>
    </article>
  );
}
