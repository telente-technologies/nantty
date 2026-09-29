"use client";

import Link from "next/link";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { DeliveryStatusBadge } from "@/components/ui/statusBadge";
import { findObjectiveOption } from "@/constants/campaignOptions.constant";
import type { Campaign } from "@/types/campaign.type";
import { formatMoneyForDisplay } from "@/utils/money.util";
import { formatWholeCount } from "@/utils/numberFormatting.util";

import styles from "./overviewPage.module.css";

export function TopCampaignsTable({ campaigns }: { readonly campaigns: readonly Campaign[] }) {
  const { buildAccountPagePath } = useAdAccount();
  const columns: DataTableColumn<Campaign>[] = [
    {
      key: "name",
      header: "Campaign",
      isAlwaysVisible: true,
      render: (campaign) => (
        <div className={styles.campaignCell}>
          <Link href={buildAccountPagePath(`/campaigns/${campaign.id}`)} className={styles.campaignLink}>
            {campaign.name}
          </Link>
          <span className={styles.campaignMeta}>{findObjectiveOption(campaign.objective).label}</span>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (campaign) => <DeliveryStatusBadge status={campaign.status} /> },
    { key: "results", header: "Results", align: "end", sortValue: (campaign) => campaign.delivery.results, render: (campaign) => `${formatWholeCount(campaign.delivery.results)} ${findObjectiveOption(campaign.objective).resultLabel.toLowerCase()}` },
    { key: "costPerResult", header: "Cost per result", align: "end", sortValue: (campaign) => campaign.delivery.costPerResult?.amountMinor ?? null, render: (campaign) => formatMoneyForDisplay(campaign.delivery.costPerResult) },
    { key: "spend", header: "Spend", align: "end", sortValue: (campaign) => campaign.delivery.spend.amountMinor, render: (campaign) => formatMoneyForDisplay(campaign.delivery.spend) },
  ];
  return <DataTable caption="Top campaigns in this period" columns={columns} rows={campaigns} readRowId={(campaign) => campaign.id} emptyState="No campaign delivered in this period." />;
}
