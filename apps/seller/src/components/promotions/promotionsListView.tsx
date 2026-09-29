"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCommerceCursorList } from "@/components/orders/commerceCursorList.hook";
import { describePromotionDiscount, promotionKindLabel, promotionStatusLabel, promotionStatusTone } from "@/components/promotions/promotionPresentation.util";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { Promotion, PromotionStatus } from "@/types/promotion.type";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";

import styles from "./promotions.module.css";

export function PromotionsListView() {
  const router = useRouter();
  const { formatMoney, currency } = useMoneyFormatter();
  const [statusFilter, setStatusFilter] = useState<PromotionStatus | "all">("all");
  const promotionsList = useCommerceCursorList<Promotion>("/seller/promotions", { status: statusFilter, limit: 50 });

  const columns: DataTableColumn<Promotion>[] = [
    { key: "name", header: "Promotion", render: (promotion) => <span className={styles.primaryCell}><strong>{promotion.name}</strong><span className={styles.muted}>{promotionKindLabel[promotion.kind]}</span></span> },
    { key: "code", header: "Code", render: (promotion) => (promotion.code ? <code className={styles.code}>{promotion.code}</code> : <span className={styles.muted}>Automatic</span>) },
    { key: "discount", header: "Discount", render: (promotion) => describePromotionDiscount(promotion, formatMoney, currency) },
    { key: "channels", header: "Where", hideBelowTablet: true, render: (promotion) => promotion.channels.map((channel) => (channel === "pos" ? "In store" : "Online")).join(" + ") },
    { key: "usage", header: "Used", align: "end", render: (promotion) => `${promotion.usedCount.toLocaleString()}${promotion.usageLimit ? ` / ${promotion.usageLimit.toLocaleString()}` : ""}` },
    { key: "dates", header: "Runs", hideBelowTablet: true, render: (promotion) => `${formatDateForDisplay(promotion.startsAt)} – ${promotion.endsAt ? formatDateForDisplay(promotion.endsAt) : "no end"}` },
    { key: "status", header: "Status", render: (promotion) => <StatusBadge tone={promotionStatusTone[promotion.status]}>{promotionStatusLabel[promotion.status]}</StatusBadge> },
  ];

  return (
    <PageStack>
      <PageHeader title="Promotions" description="Coupon codes, automatic discounts and scheduled sales for your online store and the till." actions={<ButtonLink href="/promotions/new" variant="primary" iconName="plus16">New promotion</ButtonLink>} />
      <SegmentedControl
        label="Filter promotions"
        value={statusFilter}
        onValueChange={setStatusFilter}
        options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "scheduled", label: "Scheduled" }, { value: "expired", label: "Ended" }, { value: "disabled", label: "Switched off" }]}
      />
      {promotionsList.errorMessage ? <Callout tone="error">{promotionsList.errorMessage}</Callout> : null}
      <Panel padded={false}>
        <DataTable
          caption="Promotions"
          columns={columns}
          rows={promotionsList.items}
          readRowKey={(promotion) => promotion.id}
          isLoading={promotionsList.isLoading}
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
