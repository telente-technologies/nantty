"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { useSession } from "@/components/providers/sessionProvider";
import { confirmBeforeOpeningRiskyLink } from "@/components/links/textLink";
import { ExternalLinkIcon } from "@/components/ui/icons";
import { MediaImage } from "@/components/ui/media";
import { postsService } from "@/services/posts.service";
import { productsService } from "@/services/products.service";
import { storesService } from "@/services/stores.service";
import type { Post } from "@/types";
import type { InternalLinkReference, LinkPreview } from "@/types/linkPreview.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { findFirstExternalUrl, findFirstInternalReference, readDisplayDomain } from "@/utils/postLinks.util";
import { buildPostPath, buildProductPath, buildProfilePath, buildStorePath } from "@/utils/seoPaths.util";

import { feedInteractionsService } from "@/services/feedInteractions.service";

import { usePostSurface } from "./interactions/feedInteractions.hook";
import styles from "./postLinkCard.module.css";

export function ExternalLinkPreviewCard({ preview, onOpen }: { readonly preview: LinkPreview; readonly onOpen?: () => void }) {
  const domain = preview.domain || readDisplayDomain(preview.url);

  return (
    <a href={preview.url} target="_blank" rel="noopener noreferrer nofollow ugc" className={styles.card} onClick={(event) => {
      onOpen?.();
      void confirmBeforeOpeningRiskyLink(event, preview.url);
    }} aria-label={`${preview.title}, opens ${domain} in a new tab`}>
      {preview.imageUrl ? (
        <span className={styles.media}>
          <MediaImage src={preview.imageUrl} alt="" sizes="(max-width: 640px) 100vw, 560px" />
        </span>
      ) : null}
      <span className={styles.body}>
        <span className={styles.domain}>
          <ExternalLinkIcon size={12} /> {preview.siteName ?? domain}
        </span>
        <span className={styles.title}>{preview.title}</span>
        {preview.description ? <span className={styles.description}>{preview.description}</span> : null}
      </span>
    </a>
  );
}

function InternalLinkCard({ reference }: { readonly reference: InternalLinkReference }) {
  const product = useQuery({ queryKey: ["products", "detail", reference.id], queryFn: () => productsService.fetchProductDetailById(reference.id), enabled: reference.kind === "product", retry: false, staleTime: 60_000 });
  const store = useQuery({ queryKey: ["store", reference.id], queryFn: () => storesService.fetchStoreById(reference.id), enabled: reference.kind === "store", retry: false, staleTime: 60_000 });

  if (reference.kind === "product" && product.data) {
    return (
      <Link href={buildProductPath(product.data)} className={[styles.card, styles.compact].join(" ")}>
        <span className={styles.media}>
          <MediaImage src={product.data.imageUrl ?? product.data.images[0]} alt={product.data.title} sizes="96px" />
        </span>
        <span className={styles.body}>
          <span className={styles.badge}>Product · {product.data.store.name}</span>
          <span className={styles.title}>{product.data.title}</span>
          <span className={styles.price}>{formatMoneyForDisplay(product.data.price)}</span>
        </span>
      </Link>
    );
  }
  if (reference.kind === "store" && store.data) {
    return (
      <Link href={buildStorePath(store.data.id)} className={[styles.card, styles.compact].join(" ")}>
        <span className={styles.media}>
          <MediaImage src={store.data.logoUrl} alt={store.data.name} sizes="96px" />
        </span>
        <span className={styles.body}>
          <span className={styles.badge}>Store</span>
          <span className={styles.title}>{store.data.name}</span>
          <span className={styles.description}>{store.data.productsCount} products</span>
        </span>
      </Link>
    );
  }
  if (reference.kind === "product" || reference.kind === "store") return null;
  const href = reference.kind === "profile" ? buildProfilePath(reference.id) : reference.kind === "live" ? `/live/${encodeURIComponent(reference.id)}` : buildPostPath(reference.id);
  const label = reference.kind === "profile" ? `@${reference.id}` : reference.kind === "live" ? "Live on Nantty" : "Post on Nantty";
  return (
    <Link href={href} className={styles.card}>
      <span className={styles.body}>
        <span className={styles.badge}>{reference.kind === "profile" ? "Profile" : reference.kind === "live" ? "Live" : "Post"}</span>
        <span className={styles.title}>{label}</span>
      </span>
    </Link>
  );
}

export function PostLinkCard({ post }: { readonly post: Post }) {
  const { viewer } = useSession();
  const surface = usePostSurface();
  const hasNoMedia = post.media.length === 0 && post.products.length === 0 && !post.sponsored;
  const internalReference = hasNoMedia ? findFirstInternalReference(post.text) : null;
  const externalUrl = hasNoMedia && !internalReference && !post.linkPreview ? findFirstExternalUrl(post.text) : null;
  const onDemand = useQuery({
    queryKey: ["posts", post.id, "linkPreview"],
    queryFn: () => postsService.refreshPostLinkPreview(post.id),
    enabled: !!externalUrl && !!viewer,
    retry: false,
    staleTime: Infinity,
  });
  if (!hasNoMedia) return null;
  if (internalReference) return <InternalLinkCard reference={internalReference} />;
  const preview = post.linkPreview ?? onDemand.data ?? null;
  return preview ? <ExternalLinkPreviewCard preview={preview} onOpen={() => feedInteractionsService.recordLinkClick({ postId: post.id, authorId: post.author.id }, surface)} /> : null;
}
