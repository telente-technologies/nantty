"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ZudoIcon } from "@/components/ui/zudoIcon";
import { sendSellerApiRequest } from "@/services/clientApi.service";

import styles from "./messages.module.css";

interface SharedContentCard {
  readonly availability: "available" | "private" | "unavailable";
  readonly title: string;
  readonly subtitle: string | null;
  readonly imageUrl: string | null;
  readonly priceLabel?: string | null;
}

type CardView = { readonly title: string; readonly meta: string; readonly imageUrl: string | null; readonly href: string | null };

const kindLabels: Record<string, string> = { product: "Product", store: "Store", post: "Post", clip: "Clip", story: "Story", live: "Live", profile: "Profile", order: "Order" };

async function loadCard(kind: string, id: string): Promise<CardView | null> {
  const card = await sendSellerApiRequest<SharedContentCard>("/chat/content", { query: { kind, id } });
  if (card.availability !== "available") return { title: kindLabels[kind] ?? "Shared item", meta: kind === "order" ? "This order isn't available to you." : "This is no longer available.", imageUrl: null, href: null };
  const href = kind === "product" ? `/products/${id}` : kind === "order" ? `/orders/${id}` : null;
  return { title: card.title, meta: [kind === "order" ? card.subtitle : kindLabels[kind], card.priceLabel ?? (kind === "order" ? null : card.subtitle)].filter(Boolean).join(" · "), imageUrl: card.imageUrl, href };
}

export function SharedItemCard({ reference }: { readonly reference: { readonly kind: string; readonly id: string } }) {
  const [card, setCard] = useState<CardView | null | "loading">("loading");

  useEffect(() => {
    let isCurrent = true;
    loadCard(reference.kind, reference.id).then((loaded) => isCurrent && setCard(loaded), () => isCurrent && setCard(null));
    return () => {
      isCurrent = false;
    };
  }, [reference.kind, reference.id]);

  const icon = reference.kind === "order" ? "receipt24" : "package24";
  if (card === "loading") return <span className={styles.sharedCard} aria-busy="true"><span className={styles.sharedCardImage}><ZudoIcon name={icon} /></span><span className={styles.sharedCardMeta}>Loading {kindLabels[reference.kind]?.toLowerCase() ?? "item"}…</span></span>;
  if (card === null) return <span className={styles.sharedCard}><span className={styles.sharedCardImage}><ZudoIcon name={icon} /></span><span className={styles.sharedCardMeta}>Shared {kindLabels[reference.kind]?.toLowerCase() ?? "item"}</span></span>;
  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {card.imageUrl ? <img src={card.imageUrl} alt="" className={styles.sharedCardImage} loading="lazy" /> : <span className={styles.sharedCardImage}><ZudoIcon name={icon} /></span>}
      <span>
        <span className={styles.sharedCardTitle}>{card.title}</span>
        <span className={styles.sharedCardMeta}>{card.meta}</span>
      </span>
    </>
  );
  return card.href ? <Link href={card.href} className={styles.sharedCard}>{body}</Link> : <span className={styles.sharedCard}>{body}</span>;
}
