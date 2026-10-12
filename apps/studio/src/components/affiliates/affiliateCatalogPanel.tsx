"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";

import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, Muted } from "@/components/ui/studioPage";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { affiliatesService } from "@/services/affiliates.service";
import type { AffiliateCatalogAccessFilter, AffiliateCatalogSort, PromotableProduct } from "@/types/affiliate.type";
import { affiliateAccessLabels } from "@/utils/affiliateLabels.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import { AffiliateCopyLinkButton } from "./affiliateCopyLinkButton";
import { AffiliateProductThumbnail } from "./affiliateProductThumbnail";
import styles from "./affiliates.module.css";

function describeTerms(product: PromotableProduct): string {
  const approval = product.programme.approval === "automatic" ? `auto-approves over ${product.programme.autoApproveFollowersAbove ?? 0} followers` : "seller approves each creator";
  return `${product.programme.attributionWindowDays}-day attribution window, ${approval}, paid when the order completes`;
}

function CatalogRow({ product }: { readonly product: PromotableProduct }) {
  const queryClient = useQueryClient();
  const request = useMutation({
    mutationFn: () => affiliatesService.requestToPromote(product.productId),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["affiliates"] }),
  });
  const canShare = product.access === "approved" || product.access === "open";
  const tone = product.access === "approved" ? "success" : product.access === "requested" ? "warning" : "neutral";
  return (
    <li className={styles.item}>
      <AffiliateProductThumbnail name={product.name} imageUrl={product.imageUrl} />
      <div className={styles.body}>
        <p className={styles.name}>{product.name}</p>
        <span className={styles.meta}>
          <span>{product.store.name}</span>
          <span>{formatMoneyForDisplay(product.price)}</span>
          <span>{`${product.commissionPercent}% commission, about ${formatMoneyForDisplay(product.estimatedCommission)} per sale`}</span>
          <span>{product.stock === null ? "Stock not tracked" : product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}</span>
        </span>
        <span className={styles.note}>{describeTerms(product)}</span>
      </div>
      <div className={styles.actions}>
        <Badge tone={tone}>{affiliateAccessLabels[product.access]}</Badge>
        {canShare ? <AffiliateCopyLinkButton productId={product.productId} productName={product.name} existingLink={product.link} /> : null}
        {product.access === "approval_required" ? (
          <Button size="sm" variant="secondary" busy={request.isPending} onClick={() => request.mutate()}>Request to promote</Button>
        ) : null}
        {request.isError ? <span className={styles.error} role="alert">{readErrorMessageForDisplay(request.error)}</span> : null}
      </div>
    </li>
  );
}

export function AffiliateCatalogPanel() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<AffiliateCatalogSort>("commission");
  const [access, setAccess] = useState<AffiliateCatalogAccessFilter>("all");
  const deferredSearch = useDeferredValue(search.trim());
  const catalog = useInfiniteQuery({
    queryKey: ["affiliates", "catalog", deferredSearch, sort, access],
    queryFn: ({ pageParam }) => affiliatesService.listPromotableProducts({ search: deferredSearch, sort, access, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
  const products = catalog.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <Card title="Products I can promote">
      <Muted>Every product a seller has opened to affiliates. Copy a link to share it anywhere, or tag it in a post, clip or live. You earn only when the buyer&apos;s order completes.</Muted>
      <div className={styles.toolbar}>
        <TextField label="Search products" type="search" value={search} maxLength={80} onChange={(event) => setSearch(event.target.value)} />
        <SelectField label="Sort by" value={sort} onChange={(event) => setSort(event.target.value as AffiliateCatalogSort)}>
          <option value="commission">Highest commission</option>
          <option value="newest">Newest</option>
          <option value="price_asc">Price, low to high</option>
          <option value="price_desc">Price, high to low</option>
        </SelectField>
        <SelectField label="Show" value={access} onChange={(event) => setAccess(event.target.value as AffiliateCatalogAccessFilter)}>
          <option value="all">All products</option>
          <option value="approved">Ready to share</option>
          <option value="requestable">Needs a request</option>
          <option value="requested">Requests sent</option>
        </SelectField>
      </div>
      {catalog.isPending ? <Skeleton height={180} /> : null}
      {catalog.isError ? <ErrorState title="Products didn't load" error={catalog.error} onRetry={() => void catalog.refetch()} /> : null}
      {catalog.isSuccess && products.length === 0 ? <EmptyState title="No products match" description="Try another search, or check back when more sellers open their products to affiliates." /> : null}
      {products.length > 0 ? (
        <ul className={styles.list}>
          {products.map((product) => <CatalogRow key={product.productId} product={product} />)}
        </ul>
      ) : null}
      {catalog.hasNextPage ? (
        <Button variant="secondary" busy={catalog.isFetchingNextPage} onClick={() => void catalog.fetchNextPage()}>Show more products</Button>
      ) : null}
    </Card>
  );
}
