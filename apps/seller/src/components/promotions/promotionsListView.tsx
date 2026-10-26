"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCommerceCursorList } from "@/components/orders/commerceCursorList.hook";
import { describePromotionDiscount, promotionKindLabel, promotionStatusLabel, promotionStatusTone } from "@/components/promotions/promotionPresentation.util";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { MarketingSectionHeader } from "@/components/marketing/marketingSectionHeader";
import { FilterBar } from "@/components/ui/filterControls";
import { PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { Promotion, PromotionStatus } from "@/types/promotion.type";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";

import styles from "./promotions.module.css";

export function PromotionsListView() {
  const router = useRouter();
  const { formatMoney, currency } = useMoneyFormatter();
  const [statusFilter, setStatusFilter] = useState<PromotionStatus | "all">("all");
  const [kindFilter, setKindFilter] = useState<Promotion["kind"] | "all">("all");
  const promotionsList = useCommerceCursorList<Promotion>("/seller/promotions", { status: statusFilter, kind: kindFilter, limit: 50 });

  const columns: DataTableColumn<Promotion>[] = [
    { key: "name", header: "Promotion", render: (promotion) => <span className={styles.primaryCell}><strong>{promotion.name}</strong><span className={styles.muted}>{promotionKindLabel[promotion.kind]}</span></span> },
    { key: "code", header: "Code", render: (promotion) => (promotion.code ? <code className={styles.code}>{promotion.code}</code> : <span className={styles.muted}>Automatic</span>) },
    { key: "discount", header: "Discount", render: (promotion) => describePromotionDiscount(promotion, formatMoney, currency) },
    { key: "usage", header: "Used", align: "end", render: (promotion) => `${promotion.usedCount.toLocaleString()}${promotion.usageLimit ? ` / ${promotion.usageLimit.toLocaleString()}` : ""}` },
    { key: "dates", header: "Runs", hideBelowTablet: true, render: (promotion) => `${formatDateForDisplay(promotion.startsAt)} – ${promotion.endsAt ? formatDateForDisplay(promotion.endsAt) : "no end"}` },
    { key: "status", header: "Status", render: (promotion) => <StatusBadge tone={promotionStatusTone[promotion.status]}>{promotionStatusLabel[promotion.status]}</StatusBadge> },
  ];

  return (
    <PageStack>
      <MarketingSectionHeader title="Discount codes & product discounts" description="Codes buyers enter at checkout, automatic product discounts and scheduled sales for orders in the Nantty app. Included on every plan." actions={<ButtonLink href="/promotions/new" variant="primary" iconName="plus16">New discount</ButtonLink>} />
      <FilterBar>
      <SegmentedControl
        label="Discount type"
        value={kindFilter}
        onValueChange={setKindFilter}
        options={[{ value: "all", label: "All" }, { value: "coupon", label: "Discount codes" }, { value: "automatic", label: "Product discounts" }, { value: "scheduled_sale", label: "Scheduled sales" }]}
      />
      <SegmentedControl
        label="Filter promotions"
        value={statusFilter}
        onValueChange={setStatusFilter}
        options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "scheduled", label: "Scheduled" }, { value: "expired", label: "Ended" }, { value: "disabled", label: "Switched off" }]}
      />
      </FilterBar>
      <Panel padded={false}>
        <DataTable
          caption="Promotions"
          columns={columns}
          rows={promotionsList.items}
          readRowKey={(promotion) => promotion.id}
          isLoading={promotionsList.isLoading}
          errorMessage={promotionsList.errorMessage}
          onRetry={promotionsList.reload}
          onRowActivate={(promotion) => router.push(`/promotions/${promotion.id}`)}
          hasMore={promotionsList.hasMore}
          onLoadMore={promotionsList.loadMore}
          isLoadingMore={promotionsList.isLoadingMore}
          emptyState={<EmptyState iconName="star16" title="No promotions here" description="Create a coupon code or a sale to bring customers back." action={<ButtonLink href="/promotions/new" variant="primary">New promotion</ButtonLink>} />}
        />
      </Panel>
    </PageStack>
  );
}
