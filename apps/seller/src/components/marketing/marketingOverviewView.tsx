"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { FeaturePlanBadge } from "@/components/billing/planGate";
import { MarketingSectionHeader } from "@/components/marketing/marketingSectionHeader";
import { marketingCampaignKindLabels, marketingCampaignStatusLabels, marketingCampaignStatusTones } from "@/components/marketing/marketingPresentation.util";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState, StatTile } from "@/components/ui/feedback";
import { FilterBar, SearchInput } from "@/components/ui/filterControls";
import { SelectField } from "@/components/ui/formFields";
import { PageStack, Panel, ResponsiveGrid } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { TablePagination } from "@/components/ui/tablePagination";
import { useClientTableState } from "@/hooks/useClientTableState.hook";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { MarketingCampaign, MarketingCampaignKind, MarketingCampaignStatus, MarketingOverview } from "@/types/marketing.type";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";

import styles from "./marketing.module.css";

const campaignSortReaders = {
  name: (campaign: MarketingCampaign) => campaign.name,
  starts: (campaign: MarketingCampaign) => campaign.startsAt,
  reach: (campaign: MarketingCampaign) => campaign.reach,
  redemptions: (campaign: MarketingCampaign) => campaign.redemptions,
  revenue: (campaign: MarketingCampaign) => campaign.revenue.amountMinor,
};

export function MarketingOverviewView() {
  const router = useRouter();
  const { formatMoney, locale } = useMoneyFormatter();
  const overviewQuery = useSellerQuery<MarketingOverview>("/seller/marketing/overview");
  const [kindFilter, setKindFilter] = useState<MarketingCampaignKind | "">("");
  const [statusFilter, setStatusFilter] = useState<MarketingCampaignStatus | "">("");
  const [searchText, setSearchText] = useState("");
  const overview = overviewQuery.data;
  const filteredCampaigns = useMemo(
    () => (overview ? overview.campaigns.filter((campaign) => (!kindFilter || campaign.kind === kindFilter) && (!statusFilter || campaign.status === statusFilter) && campaign.name.toLowerCase().includes(searchText.trim().toLowerCase())) : null),
    [overview, kindFilter, statusFilter, searchText],
  );
  const table = useClientTableState(filteredCampaigns, campaignSortReaders, { pageSize: 10, initialSort: { key: "starts", direction: "descending" } });

  const columns: DataTableColumn<MarketingCampaign>[] = [
    { key: "name", header: "Campaign", sortKey: "name", render: (campaign) => <span className={styles.primaryCell}><strong>{campaign.name}</strong><span className={styles.muted}>{marketingCampaignKindLabels[campaign.kind]}</span></span> },
    { key: "status", header: "Status", render: (campaign) => <StatusBadge tone={marketingCampaignStatusTones[campaign.status]}>{marketingCampaignStatusLabels[campaign.status]}</StatusBadge> },
    { key: "dates", header: "Runs", sortKey: "starts", hideBelowTablet: true, render: (campaign) => (campaign.startsAt ? `${formatDateForDisplay(campaign.startsAt)} – ${campaign.endsAt ? formatDateForDisplay(campaign.endsAt) : "ongoing"}` : "—") },
    { key: "reach", header: "Reach", align: "end", sortKey: "reach", hideBelowTablet: true, render: (campaign) => campaign.reach.toLocaleString(locale) },
    { key: "redemptions", header: "Used / sold", align: "end", sortKey: "redemptions", render: (campaign) => campaign.redemptions.toLocaleString(locale) },
    { key: "revenue", header: "Revenue", align: "end", sortKey: "revenue", render: (campaign) => formatMoney(campaign.revenue) },
  ];

  return (
    <PageStack>
      <MarketingSectionHeader
        title="Marketing"
        description="Every discount, sale, bundle and featured spot you run for buyers in the Nantty app, and how each one is doing."
        actions={
          <>
            <ButtonLink href="/marketing/flash-sales" iconName="star16">Flash sale <FeaturePlanBadge feature="advanced_promotions" /></ButtonLink>
            <ButtonLink href="/promotions/new" variant="primary" iconName="plus16">New discount code</ButtonLink>
          </>
        }
      />
      <ResponsiveGrid minimumColumnWidth={170}>
        <StatTile label="Active campaigns" value={overview?.activeCampaigns ?? "…"} detail={overview ? `${overview.scheduledCampaigns} scheduled` : undefined} />
        <StatTile label="Used or sold" value={overview ? overview.redemptionsLast30Days.toLocaleString(locale) : "…"} detail="Recent campaigns" />
        <StatTile label="Revenue from campaigns" value={overview ? formatMoney(overview.revenueLast30Days) : "…"} tone="positive" />
        <StatTile label="Discount given" value={overview ? formatMoney(overview.discountGivenLast30Days) : "…"} />
      </ResponsiveGrid>
      <FilterBar>
        <SearchInput label="Search campaigns" value={searchText} onValueChange={setSearchText} />
        <SelectField label="Type" hideLabel value={kindFilter} onChange={(event) => setKindFilter(event.target.value as MarketingCampaignKind | "")} options={[{ value: "", label: "All types" }, ...(Object.keys(marketingCampaignKindLabels) as MarketingCampaignKind[]).map((kind) => ({ value: kind, label: marketingCampaignKindLabels[kind] }))]} />
        <SelectField label="Status" hideLabel value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as MarketingCampaignStatus | "")} options={[{ value: "", label: "Any status" }, ...(Object.keys(marketingCampaignStatusLabels) as MarketingCampaignStatus[]).map((status) => ({ value: status, label: marketingCampaignStatusLabels[status] }))]} />
      </FilterBar>
      <Panel padded={false}>
        <DataTable
          caption="Marketing campaigns"
          columns={columns}
          rows={table.visibleRows}
          readRowKey={(campaign) => `${campaign.kind}-${campaign.id}`}
          isLoading={overviewQuery.isLoading}
          errorMessage={overviewQuery.errorMessage}
          onRetry={overviewQuery.reload}
          sortState={table.sortState}
          onSortChange={table.setSortState}
          onRowActivate={(campaign) => router.push(campaign.href)}
          footer={<TablePagination pageIndex={table.pageIndex} pageCount={table.pageCount} totalCount={table.totalCount} pageSize={table.pageSize} onPageChange={table.setPageIndex} itemLabel="campaigns" />}
          emptyState={<EmptyState iconName="paperPlaneTilt24" title="No campaigns match" description="Create a discount code to bring buyers back, or clear the filters." action={<ButtonLink href="/promotions/new" variant="primary">New discount code</ButtonLink>} />}
        />
      </Panel>
    </PageStack>
  );
}
