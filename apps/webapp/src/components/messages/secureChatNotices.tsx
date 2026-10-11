"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { chatCryptoService } from "@/services/chatCrypto/chatCrypto.service";
import type { SharedContentCard } from "@/types";
import type { ChatLinkPreview } from "@zudomart/chat-crypto";

import styles from "./secureChatNotices.module.css";

export function SecurityCodeChangedBanner({ viewerId, peerIds, peerName }: { readonly viewerId: string; readonly peerIds: readonly string[]; readonly peerName: string }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState<string | null>(null);
  const changesQuery = useQuery({
    queryKey: ["chatCrypto", "identityChanges", ...peerIds],
    queryFn: async () => {
      await chatCryptoService.ensureReady(viewerId);
      return chatCryptoService.identityChanges(peerIds);
    },
    enabled: viewerId !== "" && peerIds.length > 0,
    refetchInterval: 30_000,
  });
  const changed = changesQuery.data ?? [];
  if (changed.length === 0) return null;
  return (
    <div className={styles.banner} role="status">
      <p>{peerIds.length === 1 ? `${peerName}'s security code changed.` : "A member's security code changed."} This happens when someone reinstalls or adds a device.</p>
      {code ? <p className={styles.code}>{code}</p> : null}
      <div className={styles.actions}>
        {peerIds.length === 1 && !code ? (
          <button type="button" className={styles.action} onClick={() => void chatCryptoService.securityCode(peerIds[0]!).then(setCode)}>
            View code
          </button>
        ) : null}
        <button
          type="button"
          className={styles.action}
          onClick={async () => {
            await Promise.all(changed.map((userId) => chatCryptoService.acknowledgeIdentityChange(userId)));
            await queryClient.invalidateQueries({ queryKey: ["chatCrypto", "identityChanges"] });
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}

export function EncryptedLinkPreviewCard({ preview }: { readonly preview: ChatLinkPreview }) {
  return (
    <a className={styles.linkCard} href={preview.url} target="_blank" rel="noopener noreferrer nofollow">
      <span className={styles.linkDomain}>{preview.siteName ?? preview.domain}</span>
      <span className={styles.linkTitle}>{preview.title}</span>
      {preview.description ? <span className={styles.linkDescription}>{preview.description}</span> : null}
    </a>
  );
}

export function DecryptionNotice({ text }: { readonly text: string }) {
  return <p className={styles.notice}>{text}</p>;
}

const sharedKindLabels: Record<SharedContentCard["reference"]["kind"], string> = { post: "Post", clip: "Clip", story: "Story", product: "Product", store: "Store", profile: "Profile", live: "Live", order: "Order" };

function sharedContentHref(card: SharedContentCard): string | null {
  const { kind, id } = card.reference;
  if (kind === "post") return `/post/${id}`;
  if (kind === "clip") return `/clips?start=${encodeURIComponent(id)}`;
  if (kind === "product") return `/product/${id}`;
  if (kind === "store") return `/store/${id}`;
  if (kind === "live") return `/live/${id}`;
  if (kind === "order") return `/orders/${id}`;
  if (kind === "story") return card.profileUserId ? `/stories/${card.profileUserId}` : null;
  if (kind === "profile" && card.profileUserId) return `/user/${card.profileUserId}`;
  if (kind === "profile" && card.subtitle?.startsWith("@")) return `/${card.subtitle.slice(1)}`;
  return null;
}

export function SharedContentPreviewCard({ card }: { readonly card: SharedContentCard }) {
  const label = card.isLive ? "Live now" : sharedKindLabels[card.reference.kind];
  if (card.availability !== "available") {
    return (
      <div className={styles.linkCard}>
        <span className={styles.linkDomain}>{label}</span>
        <span className={styles.linkDescription}>{card.availability === "private" ? "This is only visible to the owner's followers." : card.reference.kind === "order" ? "Only the buyer and the store can see this order." : "This is no longer available."}</span>
      </div>
    );
  }
  const href = sharedContentHref(card);
  const details = [card.priceLabel, card.isLive && typeof card.viewerCount === "number" ? `${card.viewerCount.toLocaleString()} watching` : null, typeof card.stock === "number" && card.stock <= 0 ? "Out of stock" : null].filter(Boolean).join(" · ");
  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {card.imageUrl ? <img src={card.imageUrl} alt="" className={styles.sharedImage} loading="lazy" /> : null}
      <span className={styles.linkDomain}>{label}</span>
      {card.title ? <span className={styles.linkTitle}>{card.title}</span> : null}
      {card.subtitle ? <span className={styles.linkDescription}>{card.subtitle}</span> : null}
      {details ? <span className={styles.linkDescription}>{details}</span> : null}
    </>
  );
  return href === null ? <div className={styles.linkCard}>{body}</div> : <Link className={styles.linkCard} href={href}>{body}</Link>;
}
