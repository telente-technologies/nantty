"use client";

import { useEffect, useState } from "react";

import { PlanGate } from "@/components/billing/planGate";
import { MarketingProductPicker } from "@/components/marketing/marketingProductPicker";
import { MarketingSectionHeader } from "@/components/marketing/marketingSectionHeader";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Callout, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { PageStack, Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { FeaturedProduct } from "@/types/marketing.type";
import type { CursorPage } from "@/types/pagination.type";

import styles from "./marketing.module.css";

function moveItemInList<Item>(items: readonly Item[], fromIndex: number, toIndex: number): Item[] {
  const nextItems = [...items];
  const [moved] = nextItems.splice(fromIndex, 1);
  if (moved !== undefined) nextItems.splice(toIndex, 0, moved);
  return nextItems;
}

function FeaturedProductsEditor() {
  const { formatMoney, locale } = useMoneyFormatter();
  const { showToast } = useToast();
  const featuredQuery = useSellerQuery<CursorPage<FeaturedProduct>>("/seller/marketing/featured-products");
  const [items, setItems] = useState<FeaturedProduct[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (featuredQuery.data) {
      setItems(featuredQuery.data.data);
      setIsDirty(false);
    }
  }, [featuredQuery.data]);

  function changeItems(nextItems: FeaturedProduct[]) {
    setItems(nextItems);
    setIsDirty(true);
  }

  async function saveFeaturedProducts() {
    setIsSaving(true);
    try {
      const saved = await sendSellerApiRequest<CursorPage<FeaturedProduct>>("/seller/marketing/featured-products", { method: "PUT", body: { items: items.map((item) => ({ productId: item.productId, placement: item.placement })) } });
      featuredQuery.replaceData(() => saved);
      showToast("Featured products updated in the app.");
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  if (featuredQuery.isLoading && !featuredQuery.data) return <LoadingBlock label="Loading featured products" />;
  if (featuredQuery.errorMessage && !featuredQuery.data) return <Callout tone="error" action={<Button size="small" onClick={featuredQuery.reload}>Try again</Button>}>{featuredQuery.errorMessage}</Callout>;

  return (
    <>
      <Panel
        title="Featured now"
        description={`${items.length} of 4 Mart spots used. The order here is the order buyers see.`}
        padded={false}
        actions={<Button variant="primary" disabled={!isDirty} isBusy={isSaving} onClick={() => void saveFeaturedProducts()}>Save changes</Button>}
      >
        {items.length === 0 ? <EmptyState iconName="star16" title="Nothing featured yet" description="Pick up to 4 products to promote in Nantty Mart." /> : null}
        <ol>
          {items.map((item, index) => (
            <li key={item.productId} className={styles.featuredRow}>
              <span className={styles.position}>{index + 1}</span>
              {item.imageUrl ? <img src={item.imageUrl} alt="" width={40} height={40} className={`${styles.thumbnail} ${styles.hideOnPhone}`} /> : <span className={`${styles.thumbnail} ${styles.hideOnPhone}`} aria-hidden="true" />}
              <span className={styles.primaryCell}>
                <strong>{item.productName}</strong>
                <span className={styles.muted}>{formatMoney(item.price)} · {item.views.toLocaleString(locale)} views · {item.clicks.toLocaleString(locale)} taps</span>
              </span>
              <span>
                <IconButton iconName="caretDown24" label={`Move ${item.productName} down`} size="small" disabled={index === items.length - 1} onClick={() => changeItems(moveItemInList(items, index, index + 1))} />
                <IconButton iconName="trash24" label={`Stop featuring ${item.productName}`} size="small" onClick={() => changeItems(items.filter((existing) => existing.productId !== item.productId))} />
              </span>
            </li>
          ))}
        </ol>
      </Panel>
      {items.length < 4 ? (
        <Panel title="Add a product">
          <MarketingProductPicker
            chosenProductIds={items.map((item) => item.productId)}
            onProductChosen={(option) => changeItems([...items, { productId: option.productId, productName: option.name, imageUrl: option.imageUrl, price: option.price, placement: "mart", position: items.length + 1, featuredSince: new Date().toISOString(), views: 0, clicks: 0 }])}
          />
        </Panel>
      ) : null}
    </>
  );
}

export function FeaturedProductsView() {
  const { hasFeature } = usePlanFeatures();
  return (
    <PageStack>
      <MarketingSectionHeader title="Featured products" description="Promote up to 4 products in Nantty Mart. Products featured on your own store page are chosen in Storefront." />
      <Callout tone="info" action={<ButtonLink href="/storefront" size="small">Open Storefront</ButtonLink>}>Featured products on your store page are managed in Storefront, so there is one list.</Callout>
      <PlanGate feature="advanced_promotions" description="Promote your best products in Nantty Mart. Available on Pro and Business. Featuring products on your store page is free in Storefront.">
        {hasFeature("advanced_promotions") ? <FeaturedProductsEditor /> : null}
      </PlanGate>
    </PageStack>
  );
}
