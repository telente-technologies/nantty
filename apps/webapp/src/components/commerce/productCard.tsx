"use client";

import Link from "next/link";

import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { MediaImage } from "@/components/ui/media";
import type { ProductSummary } from "@/types";
import { buildProductPath } from "@/utils/seoPaths.util";

import styles from "./productCard.module.css";

export function ProductCard({ product }: { readonly product: ProductSummary }) {
  return (
    <Link href={buildProductPath(product)} className={styles.card}>
      <span className={styles.media}>
        <MediaImage src={product.imageUrl} alt={product.name} sizes="(max-width: 640px) 50vw, 240px" />
        {!product.imageUrl ? <span className={styles.mediaFallback} aria-hidden="true" /> : null}
        {product.sponsored ? <span className={styles.sponsored}>Sponsored</span> : null}
      </span>
      <span className={styles.body}>
        <span className={styles.name}>{product.name}</span>
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
