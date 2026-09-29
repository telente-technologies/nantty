"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { bidStrategyOptions, findObjectiveOption, placementLabels } from "@/constants/campaignOptions.constant";
import type { AdSet, Campaign } from "@/types/campaign.type";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./campaignTables.module.css";
import { buildDeliveryMetricColumns } from "./deliveryColumns.util";
import { DeliveryStatusCell } from "./deliveryStatusCell";
import { PacingMeter } from "./pacingMeter";

interface AdSetsTableProps {
  readonly adSets: readonly AdSet[];
  readonly campaignsById: ReadonlyMap<string, Campaign>;
  readonly selectedIds?: ReadonlySet<string>;
  readonly onSelectedIdsChange?: (ids: Set<string>) => void;
  readonly onToggleAdSetDelivery: (adSet: AdSet, nextStatus: "active" | "paused") => Promise<void>;
  readonly toolbar?: ReactNode;
  readonly emptyState?: ReactNode;
  readonly showCampaignName?: boolean;
}

export function readDailyBudgetForAdSet(adSet: AdSet, campaign: Campaign | undefined) {
  if (adSet.budget?.type === "daily") return adSet.budget.amount;
  if (!adSet.budget && campaign?.budget?.type === "daily") return { amountMinor: Math.round(campaign.budget.amount.amountMinor / Math.max(campaign.adSetCount, 1)), currency: campaign.budget.amount.currency };
  return null;
}

export function AdSetsTable({ adSets, campaignsById, selectedIds, onSelectedIdsChange, onToggleAdSetDelivery, toolbar, emptyState, showCampaignName = true }: AdSetsTableProps) {
  const { canPerform, buildAccountPagePath } = useAdAccount();
  const canManage = canPerform("campaigns:manage");
  const readResultLabel = (adSet: AdSet) => {
    const campaign = campaignsById.get(adSet.campaignId);
    return campaign ? findObjectiveOption(campaign.objective).resultLabel : "Results";
  };
  const columns: DataTableColumn<AdSet>[] = [
    {
      key: "delivery",
      header: "Delivery",
      isAlwaysVisible: true,
      sortValue: (adSet) => adSet.status,
      render: (adSet) => <DeliveryStatusCell itemName={adSet.name} status={adSet.status} canToggle={canManage} onToggleDelivery={(nextStatus) => onToggleAdSetDelivery(adSet, nextStatus)} />,
    },
    {
      key: "name",
      header: "Ad set",
      isAlwaysVisible: true,
      sortValue: (adSet) => adSet.name.toLowerCase(),
      render: (adSet) => (
        <span className={styles.nameCell}>
          <Link href={buildAccountPagePath(`/ad-sets/${adSet.id}`)} className={styles.nameLink}>
            {adSet.name}
          </Link>
          <span className={styles.subtle}>
            {showCampaignName ? `${campaignsById.get(adSet.campaignId)?.name ?? "Campaign"} · ` : ""}
            {adSet.placementMode === "automatic" ? "Automatic placements" : adSet.placements.map((placement) => placementLabels[placement]).join(", ")}
          </span>
        </span>
      ),
      footer: `${adSets.length} ad set${adSets.length === 1 ? "" : "s"}`,
    },
    { key: "budget", header: "Budget", sortValue: (adSet) => adSet.budget?.amount.amountMinor ?? null, render: (adSet) => (adSet.budget ? `${formatMoneyForDisplay(adSet.budget.amount)} ${adSet.budget.type}` : "Campaign budget") },
    {
      key: "today",
      header: "Today's pacing",
      render: (adSet) => <PacingMeter spentToday={adSet.delivery.spentToday} dailyBudget={readDailyBudgetForAdSet(adSet, campaignsById.get(adSet.campaignId))} isDelivering={adSet.status === "active"} isCompact />,
    },
    ...buildDeliveryMetricColumns(adSets, (adSet) => adSet.delivery, readResultLabel),
    { key: "bid", header: "Bid strategy", isHiddenByDefault: true, render: (adSet) => bidStrategyOptions.find((option) => option.type === adSet.bidStrategy.type)?.label ?? adSet.bidStrategy.type },
    { key: "frequencyCap", header: "Frequency cap", isHiddenByDefault: true, render: (adSet) => (adSet.frequencyCap ? `${adSet.frequencyCap.impressions} per ${adSet.frequencyCap.perDays} day${adSet.frequencyCap.perDays === 1 ? "" : "s"}` : "None") },
  ];
  return (
    <DataTable
      caption="Ad sets"
      columns={columns}
      rows={adSets}
      readRowId={(adSet) => adSet.id}
      selectedRowIds={canManage ? selectedIds : undefined}
      onSelectedRowIdsChange={canManage ? onSelectedIdsChange : undefined}
      toolbar={toolbar}
      emptyState={emptyState}
      showColumnPicker
      hasFooter
    />
  );
}
