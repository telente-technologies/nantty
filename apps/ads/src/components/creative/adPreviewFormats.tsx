import { LiveCardPreview } from "@/components/creative/adPreviewMarketplaceAndLive";
import { AppInstallRow, CarouselStrip, MediaWithTapHint } from "@/components/creative/adPreviewRichFormats";
import { IdentityAvatar, IdentitySeal, PreviewAvatar, PreviewMedia, SponsoredLabel, VerifiedSeal } from "@/components/creative/adPreviewParts";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { callToActionLabels } from "@/constants/campaignOptions.constant";
import type { Creative, PromotableDestinationKind, PromotedDestinationIdentity } from "@/types/creative.type";
import { isLandscapeMedia } from "@/utils/adPlacementRules.util";

import styles from "./adPreview.module.css";

const promotedDestinationButtonLabels: Record<PromotableDestinationKind, string> = { profile: "View profile", store: "View store" };

function CallToActionButton({ creative }: { readonly creative: Creative }) {
  return (
    <span className={styles.callToAction} role="presentation">
      {creative.promoted ? promotedDestinationButtonLabels[creative.promoted.kind] : callToActionLabels[creative.callToAction]}
    </span>
  );
}

function PromotedDestinationCard({ promoted, showsSponsoredLabel = false }: { readonly promoted: PromotedDestinationIdentity; readonly showsSponsoredLabel?: boolean }) {
  return (
    <div className={styles.storeHeader}>
      <IdentityAvatar name={promoted.name} avatarUrl={promoted.avatarUrl} size={40} />
      <div>
        <p className={styles.storeName}>
          {promoted.name} {promoted.verified ? <IdentitySeal label="Verified" /> : null}
        </p>
        <p className={styles.storeHandle}>
          @{promoted.handle}
          {promoted.private ? " · Private account" : ""}
          {showsSponsoredLabel ? <> · <SponsoredLabel /></> : null}
        </p>
      </div>
    </div>
  );
}

export function FeedCardPreview({ creative }: { readonly creative: Creative }) {
  const firstMedia = creative.media[0];
  const isWideVideo = firstMedia?.kind === "video" && isLandscapeMedia(firstMedia);
  return (
    <article className={styles.feedCard} aria-label="Feed ad preview">
      <div className={styles.authorRow}>
        <div className={styles.author}>
          <PreviewAvatar creative={creative} />
          <span className={styles.authorName}>{creative.identity.name}</span>
          <VerifiedSeal creative={creative} />
          <span className={styles.dot} aria-hidden />
          <span className={styles.postedTime}>Now</span>
          <SponsoredLabel />
        </div>
        <ZudoIcon name="dotsThreeVertical24" size={20} />
      </div>
      {creative.primaryText ? <p className={styles.bodyText}>{creative.primaryText}</p> : null}
      {creative.live ? (
        <div className={styles.feedLiveCard}>
          <LiveCardPreview creative={creative} variant="feed" />
        </div>
      ) : creative.type === "carousel" ? (
        <CarouselStrip creative={creative} />
      ) : (
        <MediaWithTapHint creative={creative}>
          <PreviewMedia media={firstMedia} altText={creative.headline} className={isWideVideo ? styles.wideMedia : styles.squareMedia} />
        </MediaWithTapHint>
      )}
      {creative.type === "app_install" ? <AppInstallRow creative={creative} /> : null}
      {creative.type === "carousel" ? <p className={styles.carouselHint}>Swipe for {creative.cards?.length ?? 0} cards</p> : creative.media.length > 1 ? <p className={styles.carouselHint}>1 / {creative.media.length}</p> : null}
      {creative.promoted ? (
        <div className={styles.promotedDestination}>
          <PromotedDestinationCard promoted={creative.promoted} />
        </div>
      ) : null}
      {creative.type === "app_install" || creative.type === "carousel" ? null : (
        <div className={styles.feedCallToAction}>
          <CallToActionButton creative={creative} />
        </div>
      )}
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
  if (creative.live && variant === "clip") return <LiveCardPreview creative={creative} variant="reels" />;
  const firstMedia = creative.media[0];
  const isLandscapeVideo = firstMedia?.kind === "video" && isLandscapeMedia(firstMedia);
  return (
    <article className={styles.fullScreen} aria-label={variant === "clip" ? "Reel ad preview" : "Story ad preview"}>
      {isLandscapeVideo ? (
        <div className={styles.letterbox}>
          <PreviewMedia media={firstMedia} altText={creative.headline} className={styles.wideMedia} />
          <span className={styles.viewFullScreen}>
            <ZudoIcon name="arrowsOutSimple24" size={14} />
            View full screen
          </span>
        </div>
      ) : (
        <PreviewMedia media={firstMedia} altText={creative.headline} className={styles.fullScreenMedia} />
      )}
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
        {creative.type === "app_install" ? <AppInstallRow creative={creative} inverted /> : <CallToActionButton creative={creative} />}
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

export function StoreCardPreview({ creative }: { readonly creative: Creative }) {
  return (
    <article className={styles.storeCard} aria-label="Store card preview">
      {creative.promoted ? (
        <PromotedDestinationCard promoted={creative.promoted} showsSponsoredLabel />
      ) : (
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
      )}
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
