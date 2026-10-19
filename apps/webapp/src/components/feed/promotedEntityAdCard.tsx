"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useFollowUser } from "@/components/follow/useFollowUser.hook";
import { useSession } from "@/components/providers/sessionProvider";
import { Button } from "@/components/ui/button";
import { StarIcon } from "@/components/ui/icons";
import { Avatar, MediaImage } from "@/components/ui/media";
import { CheckmarkBadge } from "@/components/verification/checkmarkBadge";
import { adEventsService } from "@/services/adEvents.service";
import { storesService } from "@/services/stores.service";
import { usersService } from "@/services/users.service";
import type { AdPlacement, ID, Media } from "@/types";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { promotedCheckmarkColor, promotedEntityCallToActionLabel, promotedEntityThumbnails, resolvePromotedFollowState, type PromotedEntitySponsoredPlacement } from "@/utils/promotedEntityAd.util";

import { AdAction } from "./sponsoredAd";
import styles from "./promotedEntityAdCard.module.css";

interface PromotedEntityAdCardProps {
  readonly sponsored: PromotedEntitySponsoredPlacement;
  readonly placement: AdPlacement;
  readonly itemId: ID;
  readonly media: readonly Media[];
  readonly primaryText: string;
}

function ProfileFollowButton({ userId, username, displayName, initialState, isPrivate }: { readonly userId: string; readonly username: string; readonly displayName: string; readonly initialState: ReturnType<typeof resolvePromotedFollowState>; readonly isPrivate: boolean }) {
  const follow = useFollowUser({ userId, username, displayName, initialState, isPrivate });
  if (follow.state === "accepted" || follow.state === "blocked") return null;
  return (
    <Button size="sm" variant="secondary" fullWidth busy={follow.isPending} onClick={follow.toggle} aria-label={`${follow.label} ${displayName}`}>
      {follow.label}
    </Button>
  );
}

export function PromotedEntityAdCard({ sponsored, placement, itemId, media, primaryText }: PromotedEntityAdCardProps) {
  const { promoted } = sponsored;
  const isStore = promoted.kind === "store";
  const { viewer } = useSession();
  const store = useQuery({ queryKey: ["store", promoted.id], queryFn: () => storesService.fetchStoreById(promoted.id), enabled: isStore, staleTime: 5 * 60_000, retry: false });
  const products = useQuery({ queryKey: ["store", promoted.id, "products"], queryFn: () => storesService.fetchStoreProducts(promoted.id), enabled: isStore, staleTime: 5 * 60_000, retry: false });
  const user = useQuery({ queryKey: ["user", promoted.id], queryFn: () => usersService.fetchUserProfileById(promoted.id), enabled: !isStore, staleTime: 60_000, retry: false });
  useEffect(() => void adEventsService.recordImpressionOncePerSession(sponsored, placement, itemId), [sponsored, placement, itemId]);

  const storeDetail = isStore ? store.data : undefined;
  const profile = isStore ? undefined : user.data;
  const checkmark = promotedCheckmarkColor(promoted, storeDetail?.verification ?? profile?.verification);
  const handle = storeDetail?.handle ?? profile?.username ?? promoted.handle;
  const followers = storeDetail?.followers ?? profile?.followers;
  const ratingLabel = storeDetail && storeDetail.ratingCount > 0 ? `${storeDetail.rating.toFixed(1)} (${formatCountWithThousandsSuffix(storeDetail.ratingCount)})` : null;
  const description = primaryText || storeDetail?.bio || profile?.bio || "";
  const cover = media[0]?.posterUrl ?? media[0]?.url ?? null;
  const thumbnails = isStore ? promotedEntityThumbnails(products.data ?? [], storeDetail?.bannerUrl ?? null) : [];
  const callToAction = promotedEntityCallToActionLabel(promoted.kind);
  const showsFollow = !isStore && promoted.id !== viewer?.id;

  return (
    <article className={styles.card} aria-label={`${sponsored.label}: ${promoted.name}`}>
      <AdAction sponsored={sponsored} placement={placement} itemId={itemId} target={{ kind: "media" }} className={styles.header} label={`${promoted.name}, ${callToAction}`}>
        <Avatar name={promoted.name} src={promoted.avatarUrl} size="lg" />
        <span className={styles.identity}>
          <span className={styles.nameRow}>
            <span className={styles.name}>{promoted.name}</span>
            {checkmark ? <CheckmarkBadge color={checkmark} /> : null}
            <span className={sponsored.label === "Boosted" ? styles.boosted : styles.sponsored}>{sponsored.label}</span>
          </span>
          <span className={styles.meta}>
            <span>@{handle}</span>
            {ratingLabel ? <span className={styles.rating} aria-label={`Rated ${ratingLabel}`}><StarIcon size={12} />{ratingLabel}</span> : null}
            {followers !== undefined ? <span>{formatCountWithThousandsSuffix(followers)} followers</span> : null}
          </span>
        </span>
      </AdAction>
      {description ? <p className={styles.description}>{description}</p> : null}
      {cover ? (
        <AdAction sponsored={sponsored} placement={placement} itemId={itemId} target={{ kind: "media" }} className={styles.cover} label={`${callToAction}, ${promoted.name}`}>
          <MediaImage src={cover} alt="" sizes="(max-width: 640px) 100vw, 600px" />
        </AdAction>
      ) : thumbnails.length > 0 ? (
        <AdAction sponsored={sponsored} placement={placement} itemId={itemId} target={{ kind: "media" }} className={styles.thumbnails} label={`${callToAction}, ${promoted.name}`}>
          {thumbnails.map((url) => (
            <span key={url} className={styles.thumbnail}><MediaImage src={url} alt="" sizes="200px" /></span>
          ))}
        </AdAction>
      ) : null}
      <div className={styles.actions}>
        <AdAction sponsored={sponsored} placement={placement} itemId={itemId} target={{ kind: "cta" }} className={styles.callToAction} label={`${callToAction}, ${promoted.name}`}>
          {callToAction}
        </AdAction>
        {showsFollow ? (
          <span className={styles.follow}>
            <ProfileFollowButton userId={promoted.id} username={handle} displayName={promoted.name} initialState={resolvePromotedFollowState(profile)} isPrivate={profile?.isPrivate ?? promoted.private} />
          </span>
        ) : null}
      </div>
    </article>
  );
}
