"use client";

import { useState } from "react";

import type { StorefrontDraft, StorefrontDraftUpdater } from "@/components/storefront/storefrontDraft.util";
import { Button, IconButton } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/filterControls";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { Product } from "@/types/catalog.type";
import type { CursorPage } from "@/types/pagination.type";
import type { StorefrontFeaturedProduct } from "@/types/storefront.type";

import styles from "./storefront.module.css";
import { ZudoIcon } from "@/components/ui/zudoIcon";

const maximumFeaturedProducts = 8;

function convertProductToFeaturedProduct(product: Product): StorefrontFeaturedProduct | null {
  const firstVariant = product.variants[0];
  if (!firstVariant) return null;
  return { productId: product.id, name: product.name, imageUrl: product.images[0]?.url ?? null, price: firstVariant.price, isAvailable: product.status === "active" && product.publishedOnline };
}

export function StorefrontFeaturedProductsSection({ draft, onDraftChange }: { readonly draft: StorefrontDraft; readonly onDraftChange: StorefrontDraftUpdater }) {
  const { formatMoney } = useMoneyFormatter();
  const [searchText, setSearchText] = useState("");
  const isPicking = searchText.trim().length >= 2;
  const productSearch = useSellerQuery<CursorPage<Product>>(isPicking ? "/seller/products" : null, { q: searchText, status: "active", limit: 8 });
  const featured = draft.featuredProducts;
  const featuredIds = new Set(featured.map((product) => product.productId));
  const isFull = featured.length >= maximumFeaturedProducts;

  function moveFeaturedProduct(index: number, direction: -1 | 1) {
    const next = [...featured];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(index + direction, 0, moved);
    onDraftChange({ featuredProducts: next });
  }

  function addFeaturedProduct(product: Product) {
    const featuredProduct = convertProductToFeaturedProduct(product);
    if (featuredProduct && !isFull) onDraftChange({ featuredProducts: [...featured, featuredProduct] });
  }

  return (
    <Panel title="Featured products" description={`Pinned to the top of your store page, in this order. Up to ${maximumFeaturedProducts}. Marketing uses the same list.`}>
      <div className={styles.stack}>
        {featured.length === 0 ? <p className={styles.muted}>Nothing featured yet. Your newest products show first.</p> : null}
        <ol className={styles.featuredList}>
          {featured.map((product, index) => (
            <li key={product.productId} className={styles.featuredRow}>
              {product.imageUrl ? <img src={product.imageUrl} alt="" className={styles.thumbnail} /> : <span className={styles.thumbnail} aria-hidden="true" />}
              <span className={styles.featuredName}>
                <strong>{product.name}</strong>
                <span className={styles.muted}>{formatMoney(product.price)}</span>
              </span>
              {product.isAvailable ? null : <StatusBadge tone="caution">Hidden</StatusBadge>}
              <Button size="small" variant="ghost" aria-label={`Move ${product.name} up`} disabled={index === 0} onClick={() => moveFeaturedProduct(index, -1)}>
                <ZudoIcon name="arrowUp24" size={16} />
              </Button>
              <Button size="small" variant="ghost" aria-label={`Move ${product.name} down`} disabled={index === featured.length - 1} onClick={() => moveFeaturedProduct(index, 1)}>
                <ZudoIcon name="arrowDown24" size={16} />
              </Button>
              <IconButton iconName="trash24" label={`Stop featuring ${product.name}`} size="small" onClick={() => onDraftChange({ featuredProducts: featured.filter((candidate) => candidate.productId !== product.productId) })} />
            </li>
          ))}
        </ol>
        <SearchInput label="Find a product to feature" placeholder={isFull ? "Remove one to add another" : "Search your active products"} value={searchText} onValueChange={setSearchText} />
        {isPicking && productSearch.isLoading ? <LoadingBlock label="Searching products" /> : null}
        {isPicking && productSearch.errorMessage ? <Callout tone="error">{productSearch.errorMessage}</Callout> : null}
        {isPicking && productSearch.data ? (
          <div className={styles.searchResults}>
            {productSearch.data.data.length === 0 ? <p className={styles.muted}>No active products match “{searchText}”.</p> : null}
            {productSearch.data.data.map((product) => (
              <div key={product.id} className={styles.featuredRow}>
                {product.images[0] ? <img src={product.images[0].url} alt="" className={styles.thumbnail} /> : <span className={styles.thumbnail} aria-hidden="true" />}
                <span className={styles.featuredName}>
                  <strong>{product.name}</strong>
                  <span className={styles.muted}>{product.variants[0] ? formatMoney(product.variants[0].price) : "No price"}</span>
                </span>
                <Button size="small" iconName="plus16" disabled={featuredIds.has(product.id) || isFull} onClick={() => addFeaturedProduct(product)}>
                  {featuredIds.has(product.id) ? "Featured" : "Feature"}
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
