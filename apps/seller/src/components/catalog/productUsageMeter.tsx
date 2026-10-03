"use client";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import type { SellerQueryState } from "@/hooks/useSellerQuery.hook";
import type { ProductUsageSummary } from "@/types/productRequests.type";

import styles from "./productUsageMeter.module.css";

export function isProductLimitReached(usage: ProductUsageSummary | null): boolean {
  return Boolean(usage && usage.maxActiveProducts !== null && usage.activeProducts >= usage.maxActiveProducts);
}

export function ProductUsageMeter({ usageQuery }: { readonly usageQuery: SellerQueryState<ProductUsageSummary> }) {
  const { can } = useSellerSession();
  const usage = usageQuery.data;
  if (!usage) return null;
  const maximum = usage.maxActiveProducts;
  const usedShare = maximum ? Math.min(1, usage.activeProducts / maximum) : 0;
  const fillClassName = usedShare >= 1 ? styles.fillFull : usedShare >= 0.85 ? styles.fillWarning : "";
  return (
    <>
      <Panel padded={false}>
        <div className={styles.meter}>
          <div className={styles.usage}>
            <div className={styles.usageLabel}>
              <span>Active products</span>
              <strong>{maximum === null ? `${usage.activeProducts.toLocaleString()} · no limit on your plan` : `${usage.activeProducts.toLocaleString()} of ${maximum.toLocaleString()}`}</strong>
            </div>
            {maximum !== null ? (
              <div className={styles.track} role="meter" aria-label="Active products used" aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={usage.activeProducts}>
                <div className={`${styles.fill} ${fillClassName}`} style={{ width: `${usedShare * 100}%` }} />
              </div>
            ) : null}
          </div>
          <p className={styles.counts}>
            <span><strong>{usage.draftProducts}</strong> drafts</span>
            <span><strong>{usage.scheduledProducts}</strong> scheduled</span>
            <span><strong>{usage.archivedProducts}</strong> archived</span>
          </p>
        </div>
      </Panel>
      {isProductLimitReached(usage) ? (
        <Callout tone="caution" title="You have reached your plan's active product limit" action={can("billing:manage") ? <ButtonLink href="/settings/billing" size="small" variant="primary" iconName="star16">See plans</ButtonLink> : null}>
          You can still add products as drafts and keep selling everything that is already active. Archive a product or upgrade to Pro for up to 2,000 active products.
        </Callout>
      ) : null}
    </>
  );
}
