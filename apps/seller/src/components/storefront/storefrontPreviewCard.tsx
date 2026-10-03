"use client";

import type { StorefrontDraft } from "@/components/storefront/storefrontDraft.util";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { storefrontWeekdays, type StorefrontProfile } from "@/types/storefront.type";

import styles from "./storefront.module.css";
import { IconLabel } from "@/components/ui/zudoIcon";

function readStoreInitials(storeName: string): string {
  return storeName.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("") || "Z";
}

function isStoreOpenRightNow(draft: StorefrontDraft, timeZone: string): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const weekdayName = parts.find((part) => part.type === "weekday")?.value.toLowerCase() ?? "";
  const currentTime = `${parts.find((part) => part.type === "hour")?.value ?? "00"}:${parts.find((part) => part.type === "minute")?.value ?? "00"}`;
  const today = draft.openingHours.find((hours) => hours.weekday === weekdayName && storefrontWeekdays.includes(hours.weekday));
  return Boolean(today?.isOpen && currentTime >= today.opensAt && currentTime < today.closesAt);
}

export function StorefrontPreviewCard({ draft, profile }: { readonly draft: StorefrontDraft; readonly profile: StorefrontProfile }) {
  const { formatMoney } = useMoneyFormatter();
  const { settings } = useStoreContext();
  const isOpen = isStoreOpenRightNow(draft, settings?.timezone ?? "Africa/Lagos");
  return (
    <article className={styles.previewCard} aria-label="Preview of your store page">
      <div className={styles.previewCover}>{draft.coverUrl ? <img src={draft.coverUrl} alt="" /> : null}</div>
      <div className={styles.previewBody}>
        <span className={styles.previewLogo}>{draft.logoUrl ? <img src={draft.logoUrl} alt="" /> : readStoreInitials(draft.name)}</span>
        <span className={styles.previewName}>{draft.name || "Your store"}</span>
        <span className={styles.muted}>@{profile.handle}</span>
        {draft.tagline ? <span>{draft.tagline}</span> : null}
        <span className={styles.previewStats}>
          <span>{new Intl.NumberFormat("en-NG", { notation: "compact" }).format(profile.followerCount)} followers</span>
          {profile.averageRating !== null ? <IconLabel name="star16" size={12}>{profile.averageRating.toFixed(1)}</IconLabel> : null}
          <StatusBadge tone={isOpen ? "success" : "neutral"}>{isOpen ? "Open now" : "Closed"}</StatusBadge>
        </span>
        {draft.description ? <p className={styles.muted}>{draft.description.length > 140 ? `${draft.description.slice(0, 140)}…` : draft.description}</p> : null}
        {draft.featuredProducts.length > 0 ? (
          <div className={styles.previewProducts}>
            {draft.featuredProducts.slice(0, 4).map((product) => (
              <span key={product.productId} className={styles.previewProduct}>
                {product.imageUrl ? <img src={product.imageUrl} alt="" className={styles.previewProductImage} /> : <span className={styles.previewProductImage} aria-hidden="true" />}
                <span>{product.name}</span>
                <strong>{formatMoney(product.price)}</strong>
              </span>
            ))}
          </div>
        ) : null}
        <span className={styles.socialRow}>
          {Object.entries(draft.socialLinks)
            .filter(([, link]) => Boolean(link?.trim()))
            .map(([network]) => (
              <StatusBadge key={network}>{network === "x" ? "X" : network.charAt(0).toUpperCase() + network.slice(1)}</StatusBadge>
            ))}
        </span>
      </div>
    </article>
  );
}
