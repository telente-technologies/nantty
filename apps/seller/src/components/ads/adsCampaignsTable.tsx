"use client";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { EmptyState } from "@/components/ui/feedback";
import { StatusBadge, type StatusTone } from "@/components/ui/statusBadge";
import { TablePagination } from "@/components/ui/tablePagination";
import { useClientTableState } from "@/hooks/useClientTableState.hook";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { AdCampaignStatus, AdCampaignSummary } from "@/types/ads.type";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

import styles from "./ads.module.css";

const campaignStatusLabels: Record<AdCampaignStatus, string> = { active: "Running", paused: "Paused", scheduled: "Scheduled", ended: "Ended", in_review: "In review", rejected: "Rejected" };
const campaignStatusTones: Record<AdCampaignStatus, StatusTone> = { active: "success", paused: "caution", scheduled: "info", ended: "neutral", in_review: "info", rejected: "error" };

const campaignSortReaders = {
  name: (campaign: AdCampaignSummary) => campaign.name,
  spend: (campaign: AdCampaignSummary) => campaign.spend.amountMinor,
  impressions: (campaign: AdCampaignSummary) => campaign.impressions,
  clicks: (campaign: AdCampaignSummary) => campaign.clicks,
  orders: (campaign: AdCampaignSummary) => campaign.attributedOrders,
  roas: (campaign: AdCampaignSummary) => campaign.returnOnAdSpendHundredths,
};

export function formatReturnOnAdSpend(hundredths: number): string {
  return `${(hundredths / 100).toFixed(2)}×`;
}

export function AdsCampaignsTable({ campaigns }: { readonly campaigns: readonly AdCampaignSummary[] }) {
  const { formatMoney, locale } = useMoneyFormatter();
  const table = useClientTableState(campaigns, campaignSortReaders, { pageSize: 8, initialSort: { key: "spend", direction: "descending" } });
  const columns: DataTableColumn<AdCampaignSummary>[] = [
    { key: "name", header: "Campaign", sortKey: "name", render: (campaign) => <span className={styles.primaryCell}><a href={campaign.manageUrl} target="_blank" rel="noopener noreferrer"><strong>{campaign.name}</strong></a><span className={styles.muted}>{campaign.placement} · {formatMoney(campaign.dailyBudget)}/day</span></span> },
    { key: "status", header: "Status", render: (campaign) => <StatusBadge tone={campaignStatusTones[campaign.status]}>{campaignStatusLabels[campaign.status]}</StatusBadge> },
    { key: "spend", header: "Spend", align: "end", sortKey: "spend", render: (campaign) => formatMoney(campaign.spend) },
    { key: "impressions", header: "Impressions", align: "end", sortKey: "impressions", hideBelowTablet: true, render: (campaign) => campaign.impressions.toLocaleString(locale) },
    { key: "clicks", header: "Clicks (CTR)", align: "end", sortKey: "clicks", hideBelowTablet: true, render: (campaign) => `${campaign.clicks.toLocaleString(locale)} (${formatBasisPointsAsPercent(campaign.clickThroughRateBasisPoints)})` },
    { key: "orders", header: "Orders", align: "end", sortKey: "orders", render: (campaign) => campaign.attributedOrders.toLocaleString(locale) },
    { key: "roas", header: "ROAS", align: "end", sortKey: "roas", render: (campaign) => (campaign.spend.amountMinor > 0 ? formatReturnOnAdSpend(campaign.returnOnAdSpendHundredths) : "—") },
  ];
  return (
    <DataTable
      caption="Ad campaigns"
      columns={columns}
      rows={table.visibleRows}
      readRowKey={(campaign) => campaign.id}
      sortState={table.sortState}
      onSortChange={table.setSortState}
      footer={<TablePagination pageIndex={table.pageIndex} pageCount={table.pageCount} totalCount={table.totalCount} pageSize={table.pageSize} onPageChange={table.setPageIndex} itemLabel="campaigns" />}
      emptyState={<EmptyState iconName="speakerHigh24" title="No campaigns yet" description="Create your first campaign in Ads Manager. Results show up here." />}
    />
  );
}
