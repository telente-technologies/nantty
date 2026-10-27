import { NanttyIcon } from "@/components/ui/nanttyIcon";
import { formatMoneyForDisplay } from "@/utils/money.util";

import { AdBadge, CallToActionBar, StoreIdentityRow } from "./landingIllustrationParts";
import { buildLandingPhotoUrl, feedShowcasePost, liveShowcaseStream, marketplaceGridTiles, reelsShowcaseClip, type ShowcaseFeedPost, type ShowcaseProductTile } from "./landingShowcase.content";
import styles from "./landingIllustrations.module.css";
import liveStyles from "./landingLiveCard.module.css";

function MarketplaceProductTile({ tile }: { readonly tile: ShowcaseProductTile }) {
  return (
    <li className={tile.isSponsored ? `${styles.productTile} ${styles.productTileSponsored}` : styles.productTile}>
      <div className={styles.productImageWrap}>
        <img src={buildLandingPhotoUrl(tile.photoKey, 400)} alt={tile.title} className={styles.productImage} loading="lazy" width={400} height={400} />
        {tile.isSponsored ? <AdBadge /> : null}
      </div>
      <p className={styles.productTitle}>{tile.title}</p>
      <p className={styles.productPrice}>{formatMoneyForDisplay(tile.price, { showMinorUnits: false })}</p>
      <p className={styles.productMeta}>
        <NanttyIcon name="star16" size={11} className={styles.productStar} />
        {tile.rating} · {tile.storeName}
      </p>
    </li>
  );
}

export function MarketplaceGridIllustration() {
  return (
    <figure className={styles.screen} aria-label="Mart grid with one sponsored product tile marked Ad">
      <div className={styles.screenBar}>
        <NanttyIcon name="magnifyingGlass16" size={13} />
        <span>Search Mart</span>
      </div>
      <ul className={styles.productGrid}>
        {marketplaceGridTiles.map((tile) => (
          <MarketplaceProductTile key={tile.title} tile={tile} />
        ))}
      </ul>
    </figure>
  );
}

export function FeedCardIllustration({ post = feedShowcasePost }: { readonly post?: ShowcaseFeedPost }) {
  return (
    <figure className={styles.screen} aria-label="Sponsored post in the home feed">
      <div className={styles.feedCard}>
        <StoreIdentityRow storeName={post.storeName} />
        <p className={styles.feedText}>{post.text}</p>
        <img src={buildLandingPhotoUrl(post.photoKey, 600)} alt={post.imageAlt} className={styles.feedImage} loading="lazy" width={600} height={600} />
        <div className={styles.feedCallToAction}>
          <CallToActionBar label={post.callToAction} />
        </div>
        <div className={styles.feedCounters} aria-hidden>
          <span>
            <NanttyIcon name="heart24Alt" size={16} /> {post.likes}
          </span>
          <span>
            <NanttyIcon name="brandLine24" size={16} /> {post.comments}
          </span>
          <span>
            <NanttyIcon name="refresh24" size={16} /> {post.reposts}
          </span>
          <NanttyIcon name="share24" size={16} />
        </div>
      </div>
    </figure>
  );
}

export function ReelsIllustration() {
  return (
    <figure className={`${styles.screen} ${styles.reelsScreen}`} aria-label="Promoted clip playing full screen in Reels">
      <img src={buildLandingPhotoUrl(reelsShowcaseClip.photoKey, 600)} alt="Face serum bottle in the promoted clip" className={styles.reelsImage} loading="lazy" width={600} height={1066} />
      <span className={styles.reelsDuration}>
        <NanttyIcon name="play24" size={12} /> {reelsShowcaseClip.duration}
      </span>
      <div className={styles.reelsActions} aria-hidden>
        <NanttyIcon name="heart24Alt" size={20} />
        <NanttyIcon name="brandLine24" size={20} />
        <NanttyIcon name="share24" size={20} />
      </div>
      <div className={styles.reelsOverlay}>
        <StoreIdentityRow storeName={reelsShowcaseClip.storeName} inverted />
        <p className={styles.reelsCaption}>{reelsShowcaseClip.caption}</p>
        <CallToActionBar label={reelsShowcaseClip.callToAction} />
      </div>
    </figure>
  );
}

export function LiveCardIllustration() {
  return (
    <figure className={`${styles.screen} ${liveStyles.liveScreen}`} aria-label="Promoted live stream card in live discovery">
      <div className={liveStyles.liveImageWrap}>
        <img src={buildLandingPhotoUrl(liveShowcaseStream.photoKey, 600)} alt="Bags on display during the live stream" className={liveStyles.liveImage} loading="lazy" width={600} height={750} />
        <span className={liveStyles.liveBadge}>
          <span className={liveStyles.liveDot} aria-hidden />
          LIVE
        </span>
        <span className={liveStyles.liveWatching}>
          <NanttyIcon name="eye16" size={12} /> {liveShowcaseStream.watching}
        </span>
      </div>
      <div className={liveStyles.liveBody}>
        <StoreIdentityRow storeName={liveShowcaseStream.storeName} isVerifiedBusiness={false} labelText="Promoted" />
        <p className={liveStyles.liveTitle}>{liveShowcaseStream.title}</p>
        <CallToActionBar label="Join live" />
      </div>
    </figure>
  );
}
