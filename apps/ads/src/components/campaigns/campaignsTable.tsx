"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { findObjectiveOption } from "@/constants/campaignOptions.constant";
import type { Campaign } from "@/types/campaign.type";
import { formatDateWithYear } from "@/utils/dateRange.util";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./campaignTables.module.css";
import { buildDeliveryMetricColumns } from "./deliveryColumns.util";
import { DeliveryStatusCell } from "./deliveryStatusCell";
import { PacingMeter } from "./pacingMeter";

interface CampaignsTableProps {
  readonly campaigns: readonly Campaign[];
  readonly selectedIds?: ReadonlySet<string>;
  readonly onSelectedIdsChange?: (ids: Set<string>) => void;
  readonly onToggleCampaignDelivery: (campaign: Campaign, nextStatus: "active" | "paused") => Promise<void>;
  readonly toolbar?: ReactNode;
  readonly emptyState?: ReactNode;
}

function describeCampaignBudget(campaign: Campaign): string {
  if (!campaign.budget) return "Set on ad sets";
  return `${formatMoneyForDisplay(campaign.budget.amount)} ${campaign.budget.type === "daily" ? "daily" : "lifetime"}`;
}

export function CampaignsTable({ campaigns, selectedIds, onSelectedIdsChange, onToggleCampaignDelivery, toolbar, emptyState }: CampaignsTableProps) {
  const { canPerform, buildAccountPagePath } = useAdAccount();
  const canManage = canPerform("campaigns:manage");
  const columns: DataTableColumn<Campaign>[] = [
    {
      key: "delivery",
      header: "Delivery",
      isAlwaysVisible: true,
      sortValue: (campaign) => campaign.status,
      render: (campaign) => <DeliveryStatusCell itemName={campaign.name} status={campaign.status} canToggle={canManage} onToggleDelivery={(nextStatus) => onToggleCampaignDelivery(campaign, nextStatus)} />,
    },
    {
      key: "name",
      header: "Campaign",
      isAlwaysVisible: true,
      sortValue: (campaign) => campaign.name.toLowerCase(),
      render: (campaign) => (
        <span className={styles.nameCell}>
          <Link href={buildAccountPagePath(`/campaigns/${campaign.id}`)} className={styles.nameLink}>
            {campaign.name}
          </Link>
          <span className={styles.subtle}>
            {findObjectiveOption(campaign.objective).label} · {campaign.adSetCount} ad set{campaign.adSetCount === 1 ? "" : "s"} · {campaign.adCount} ad{campaign.adCount === 1 ? "" : "s"}
          </span>
          {campaign.rejectedAdCount > 0 ? <span className={styles.warningText}>{campaign.rejectedAdCount} rejected ad{campaign.rejectedAdCount === 1 ? "" : "s"}</span> : null}
        </span>
      ),
      footer: `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`,
    },
    { key: "budget", header: "Budget", sortValue: (campaign) => campaign.budget?.amount.amountMinor ?? null, render: describeCampaignBudget },
    {
      key: "today",
      header: "Today's pacing",
      render: (campaign) => <PacingMeter spentToday={campaign.delivery.spentToday} dailyBudget={campaign.budget?.type === "daily" ? campaign.budget.amount : null} isDelivering={campaign.status === "active"} isCompact />,
    },
    ...buildDeliveryMetricColumns(campaigns, (campaign) => campaign.delivery, (campaign) => findObjectiveOption(campaign.objective).resultLabel),
    { key: "starts", header: "Starts", isHiddenByDefault: true, sortValue: (campaign) => campaign.schedule.startAt, render: (campaign) => formatDateWithYear(campaign.schedule.startAt) },
    { key: "ends", header: "Ends", isHiddenByDefault: true, sortValue: (campaign) => campaign.schedule.endAt, render: (campaign) => (campaign.schedule.endAt ? formatDateWithYear(campaign.schedule.endAt) : "Ongoing") },
  ];
  return (
    <DataTable
      caption="Campaigns"
      columns={columns}
      rows={campaigns}
      readRowId={(campaign) => campaign.id}
      selectedRowIds={canManage ? selectedIds : undefined}
      onSelectedRowIdsChange={canManage ? onSelectedIdsChange : undefined}
      toolbar={toolbar}
      emptyState={emptyState}
      showColumnPicker
      hasFooter
    />
  );
}
