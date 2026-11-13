"use client";

import Link from "next/link";

import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { MediaImage } from "@/components/ui/media";
import { AppIcon } from "@/components/ui/appIcon";
import type { ProductSummary } from "@/types";
import { buildProductPath } from "@/utils/seoPaths.util";

import styles from "./productCard.module.css";

export function ProductCard({ product, onClick, showStoreDetails = false }: { readonly product: ProductSummary; readonly onClick?: () => void; readonly showStoreDetails?: boolean }) {
  return (
    <Link href={buildProductPath(product)} className={styles.card} onClick={onClick}>
      <span className={styles.media}>
        <MediaImage src={product.imageUrl} alt={product.name} sizes="(max-width: 640px) 50vw, 240px" />
        {!product.imageUrl ? <span className={styles.mediaFallback} aria-hidden="true" /> : null}
        {product.sponsored ? <span className={styles.sponsored}>Sponsored</span> : null}
      </span>
      <span className={styles.body}>
        <span className={styles.name}>{product.name}</span>
        {showStoreDetails && product.storeName ? (
          <span className={styles.storeIdentity}>
            <span className={styles.storeName}>{product.storeName}</span>
            {product.storeVerified ? (
              <span className={styles.verifiedStore} role="img" aria-label="Verified store">
                <AppIcon name="sealCheck20" size={15} />
              </span>
            ) : null}
          </span>
        ) : null}
        <span className={styles.priceRow}>
          <span className={styles.price}>{formatMoneyForDisplay(product.price)}</span>
          {typeof product.stock === "number" && product.stock <= 5 ? (
            <span className={styles.lowStock}>{product.stock === 0 ? "Out of stock" : `Only ${product.stock} left`}</span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
