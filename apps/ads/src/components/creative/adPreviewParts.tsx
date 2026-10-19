import { ZudoIcon } from "@/components/ui/zudoIcon";
import type { Creative, CreativeMedia } from "@/types/creative.type";

import styles from "./adPreviewParts.module.css";

export function IdentityAvatar({ name, avatarUrl, size = 32 }: { readonly name: string; readonly avatarUrl: string | null; readonly size?: number }) {
  if (avatarUrl) return <img className={styles.avatar} src={avatarUrl} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  return (
    <span className={styles.avatarFallback} style={{ width: size, height: size }} aria-hidden>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function PreviewAvatar({ creative, size = 32 }: { readonly creative: Creative; readonly size?: number }) {
  return <IdentityAvatar name={creative.identity.name} avatarUrl={creative.identity.avatarUrl} size={size} />;
}

export function IdentitySeal({ label }: { readonly label: string }) {
  return <ZudoIcon name="sealCheck20" size={14} className={styles.seal} label={label} />;
}

export function VerifiedSeal({ creative }: { readonly creative: Creative }) {
  if (!creative.identity.verifiedBusiness) return null;
  return <IdentitySeal label="Verified business" />;
}

function formatDurationAsMinutesAndSeconds(durationSeconds: number | null): string {
  if (!durationSeconds) return "";
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function PreviewMedia({ media, altText, className }: { readonly media: CreativeMedia | undefined; readonly altText: string; readonly className?: string }) {
  if (!media) {
    return (
      <div className={`${styles.mediaPlaceholder} ${className ?? ""}`}>
        <ZudoIcon name="imageSquare24" size={28} />
        <span>Choose media</span>
      </div>
    );
  }
  if (media.kind === "video" && media.url) {
    return <video className={`${styles.media} ${className ?? ""}`} src={media.url} poster={media.posterUrl ?? undefined} muted loop playsInline autoPlay aria-label={altText} />;
  }
  const imageUrl = media.kind === "video" ? media.posterUrl : media.url;
  return (
    <div className={`${styles.mediaFrame} ${className ?? ""}`}>
      {imageUrl ? <img className={styles.media} src={imageUrl} alt={altText} /> : <div className={styles.mediaPlaceholder} />}
      {media.kind === "video" ? (
        <span className={styles.playBadge}>
          <ZudoIcon name="play24" size={16} />
          {formatDurationAsMinutesAndSeconds(media.durationSeconds)}
        </span>
      ) : null}
    </div>
  );
}

export function SponsoredLabel({ inverted = false }: { readonly inverted?: boolean }) {
  return <span className={inverted ? `${styles.sponsored} ${styles.sponsoredInverted}` : styles.sponsored}>Sponsored</span>;
}
