import { PreviewAvatar, PreviewMedia, SponsoredLabel, VerifiedSeal } from "@/components/creative/adPreviewParts";
import { NanttyIcon } from "@/components/ui/nanttyIcon";
import { callToActionLabels } from "@/constants/campaignOptions.constant";
import type { Creative } from "@/types/creative.type";

import feedStyles from "./adPreview.module.css";
import styles from "./adPreviewRich.module.css";

export function CarouselStrip({ creative }: { readonly creative: Creative }) {
  const cards = creative.cards ?? [];
  if (cards.length === 0) return <PreviewMedia media={undefined} altText="" className={feedStyles.squareMedia} />;
  return (
    <div className={styles.carouselStrip} role="group" aria-label={`Carousel with ${cards.length} cards`}>
      {cards.map((card, index) => (
        <div key={`${card.media.id}-${index}`} className={styles.carouselCard}>
          <PreviewMedia media={card.media.url ? card.media : undefined} altText={card.headline} className={styles.cardMedia} />
          <div className={styles.cardText}>
            <span className={styles.cardHeadline}>{card.headline}</span>
            {card.description ? <span className={styles.cardDescription}>{card.description}</span> : null}
          </div>
          <span className={`${feedStyles.callToAction} ${styles.cardAction}`} role="presentation">
            {callToActionLabels[card.callToAction]}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AppInstallRow({ creative, inverted = false }: { readonly creative: Creative; readonly inverted?: boolean }) {
  const app = creative.app;
  if (!app) return null;
  return (
    <div className={inverted ? `${styles.appRow} ${styles.appRowInverted}` : styles.appRow}>
      {app.iconUrl ? <img className={styles.appIcon} src={app.iconUrl} alt="" /> : <span className={styles.appIcon} aria-hidden />}
      <div className={styles.appMeta}>
        <span className={styles.appName}>{app.appName || "Your app"}</span>
        {app.rating !== null ? (
          <span className={styles.appRating}>
            <NanttyIcon name="star16" size={12} />
            {app.rating.toFixed(1)}
          </span>
        ) : null}
      </div>
      <span className={styles.appButton} role="presentation">
        {callToActionLabels[creative.callToAction]}
      </span>
    </div>
  );
}

export function MediaWithTapHint({ creative, children }: { readonly creative: Creative; readonly children: React.ReactNode }) {
  const isTappable = creative.mediaClickable || creative.type === "promoted_post" || creative.type === "app_install";
  if (!isTappable) return <>{children}</>;
  return (
    <div className={styles.mediaTap}>
      {children}
      <span className={styles.mediaTapHint}>
        <NanttyIcon name="arrowUpRight24" size={12} />
        {creative.type === "promoted_post" ? "Opens post" : creative.type === "app_install" ? "Opens store" : "Opens link"}
      </span>
    </div>
  );
}

export function CommentThreadPreview({ creative }: { readonly creative: Creative }) {
  const firstMedia = creative.type === "carousel" ? creative.cards?.[0]?.media : creative.media[0];
  return (
    <article className={styles.thread} aria-label="Comment thread ad preview">
      <p className={styles.threadTitle}>Comments</p>
      <div className={styles.comment}>
        <span className={styles.appIcon} aria-hidden />
        <div className={styles.commentBody}>
          <span className={styles.commentName}>A neighbour</span>
          <span className={styles.commentText}>Where did you get this?</span>
        </div>
      </div>
      <div className={`${styles.comment} ${styles.sponsoredComment}`}>
        <div className={styles.sponsoredHead}>
          <PreviewAvatar creative={creative} size={24} />
          <span className={styles.commentName}>{creative.identity.name}</span>
          <VerifiedSeal creative={creative} />
          <SponsoredLabel />
        </div>
        <PreviewMedia media={firstMedia?.url ? firstMedia : undefined} altText={creative.headline} className={feedStyles.wideMedia} />
        <p className={styles.cardHeadline}>{creative.headline}</p>
        {creative.type === "app_install" ? <AppInstallRow creative={creative} /> : <span className={feedStyles.callToAction} role="presentation">{callToActionLabels[creative.callToAction]}</span>}
      </div>
      <div className={styles.comment}>
        <span className={styles.appIcon} aria-hidden />
        <div className={styles.commentBody}>
          <span className={styles.ghost} style={{ width: "40%" }} />
          <span className={styles.ghost} style={{ width: "80%" }} />
        </div>
      </div>
    </article>
  );
}
