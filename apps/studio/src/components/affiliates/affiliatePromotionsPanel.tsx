"use client";

import { useQuery } from "@tanstack/react-query";

import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, Muted, StatGrid } from "@/components/ui/studioPage";
import { affiliatesService } from "@/services/affiliates.service";
import type { AffiliatePromotion } from "@/types/affiliate.type";
import { affiliateAccessLabels, formatConversion } from "@/utils/affiliateLabels.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import { AffiliateCopyLinkButton } from "./affiliateCopyLinkButton";
import { AffiliateProductThumbnail } from "./affiliateProductThumbnail";
import styles from "./affiliates.module.css";

function PromotionRow({ promotion }: { readonly promotion: AffiliatePromotion }) {
  const canShare = promotion.access === "approved" || promotion.access === "open";
  return (
    <li className={styles.item}>
      <AffiliateProductThumbnail name={promotion.name} imageUrl={promotion.imageUrl} />
      <div className={styles.body}>
        <p className={styles.name}>{promotion.name || "Product no longer listed"}</p>
        <span className={styles.meta}>
          <span>{promotion.store.name}</span>
          {promotion.price.currency ? <span>{formatMoneyForDisplay(promotion.price)}</span> : null}
          <span>{`${promotion.commissionPercent}% commission now`}</span>
          {promotion.programme ? <span>{`${promotion.programme.attributionWindowDays}-day attribution window`}</span> : null}
        </span>
        <dl className={styles.figures}>
          <div><dt>Clicks</dt><dd>{promotion.clicks}</dd></div>
          <div><dt>Sales</dt><dd>{promotion.completedOrders + promotion.pendingOrders}</dd></div>
          <div><dt>Conversion</dt><dd>{formatConversion(promotion.conversionPercent)}</dd></div>
          <div><dt>Earned</dt><dd>{formatMoneyForDisplay(promotion.earned)}</dd></div>
          <div><dt>Pending</dt><dd>{formatMoneyForDisplay(promotion.pendingEarnings)}</dd></div>
          <div><dt>Reversed sales</dt><dd>{promotion.reversedOrders}</dd></div>
        </dl>
      </div>
      <div className={styles.actions}>
        <Badge tone={promotion.access === "approved" ? "success" : "neutral"}>{affiliateAccessLabels[promotion.access]}</Badge>
        {canShare ? <AffiliateCopyLinkButton productId={promotion.productId} productName={promotion.name} existingLink={promotion.link} /> : null}
      </div>
    </li>
  );
}

export function AffiliatePromotionsPanel() {
  const promotions = useQuery({ queryKey: ["affiliates", "promotions"], queryFn: affiliatesService.listPromotions });
  const rows = promotions.data?.data ?? [];
  const clicks = rows.reduce((total, row) => total + row.clicks, 0);
  const sales = rows.reduce((total, row) => total + row.completedOrders + row.pendingOrders, 0);
  const top = rows.filter((row) => row.earned.amountMinor > 0).slice(0, 3);
  return (
    <Card title="Products I'm promoting">
      <Muted>Clicks count people who opened your link, not your own visits. Sales from tagged posts, clips and lives count here too.</Muted>
      {promotions.isPending ? <Skeleton height={160} /> : null}
      {promotions.isError ? <ErrorState title="Your promotions didn't load" error={promotions.error} onRetry={() => void promotions.refetch()} /> : null}
      {promotions.isSuccess && rows.length === 0 ? <EmptyState title="Nothing promoted yet" description="Copy a link from Products I can promote, or tag an approved product in a post, clip or live." /> : null}
      {rows.length > 0 ? (
        <>
          <StatGrid label="Promotion totals" stats={[
            { label: "Products", value: String(rows.length) },
            { label: "Link clicks", value: String(clicks) },
            { label: "Sales", value: String(sales) },
            { label: "Conversion", value: formatConversion(clicks > 0 ? (sales * 100) / clicks : null) },
          ]} />
          {top.length > 0 ? <Muted>{`Top performers: ${top.map((row) => `${row.name} (${formatMoneyForDisplay(row.earned)})`).join(", ")}`}</Muted> : null}
          <ul className={styles.list}>
            {rows.map((promotion) => <PromotionRow key={promotion.productId} promotion={promotion} />)}
          </ul>
        </>
      ) : null}
    </Card>
  );
}
