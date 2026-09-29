"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { callToActionLabels, creativeFormatLabels, findObjectiveOption } from "@/constants/campaignOptions.constant";
import type { Ad, AdSet, Campaign } from "@/types/campaign.type";

import styles from "./campaignTables.module.css";
import { CreativeThumbnail } from "./creativeThumbnail";
import { buildDeliveryMetricColumns } from "./deliveryColumns.util";
import { DeliveryStatusCell } from "./deliveryStatusCell";
import { ReviewStatusBadge } from "./reviewStatusBadge";

interface AdsTableProps {
  readonly ads: readonly Ad[];
  readonly campaignsById: ReadonlyMap<string, Campaign>;
  readonly adSetsById: ReadonlyMap<string, AdSet>;
  readonly selectedIds?: ReadonlySet<string>;
  readonly onSelectedIdsChange?: (ids: Set<string>) => void;
  readonly onToggleAdDelivery: (ad: Ad, nextStatus: "active" | "paused") => Promise<void>;
  readonly toolbar?: ReactNode;
  readonly emptyState?: ReactNode;
}

export function AdsTable({ ads, campaignsById, adSetsById, selectedIds, onSelectedIdsChange, onToggleAdDelivery, toolbar, emptyState }: AdsTableProps) {
  const { canPerform, buildAccountPagePath } = useAdAccount();
  const canManage = canPerform("campaigns:manage");
  const readResultLabel = (ad: Ad) => {
    const campaign = campaignsById.get(ad.campaignId);
    return campaign ? findObjectiveOption(campaign.objective).resultLabel : "Results";
  };
  const columns: DataTableColumn<Ad>[] = [
    {
      key: "delivery",
      header: "Delivery",
      isAlwaysVisible: true,
      sortValue: (ad) => ad.status,
      render: (ad) => <DeliveryStatusCell itemName={ad.name} status={ad.status} canToggle={canManage} onToggleDelivery={(nextStatus) => onToggleAdDelivery(ad, nextStatus)} />,
    },
    {
      key: "name",
      header: "Ad",
      isAlwaysVisible: true,
      sortValue: (ad) => ad.name.toLowerCase(),
      render: (ad) => (
        <span className={styles.adNameRow}>
          <CreativeThumbnail creative={ad.creative} />
          <span className={styles.nameCell}>
            <Link href={buildAccountPagePath(`/ads/${ad.id}`)} className={styles.nameLink}>
              {ad.name}
            </Link>
            <span className={styles.subtle}>{adSetsById.get(ad.adSetId)?.name ?? campaignsById.get(ad.campaignId)?.name ?? creativeFormatLabels[ad.creative.format]}</span>
          </span>
        </span>
      ),
      footer: `${ads.length} ad${ads.length === 1 ? "" : "s"}`,
    },
    { key: "review", header: "Review", sortValue: (ad) => ad.review.status, render: (ad) => <ReviewStatusBadge review={ad.review} /> },
    { key: "format", header: "Format", isHiddenByDefault: true, render: (ad) => creativeFormatLabels[ad.creative.format] },
    { key: "callToAction", header: "Button", isHiddenByDefault: true, render: (ad) => callToActionLabels[ad.creative.callToAction] },
    ...buildDeliveryMetricColumns(ads, (ad) => ad.delivery, readResultLabel),
  ];
  return (
    <DataTable
      caption="Ads"
      columns={columns}
      rows={ads}
      readRowId={(ad) => ad.id}
      selectedRowIds={canManage ? selectedIds : undefined}
      onSelectedRowIdsChange={canManage ? onSelectedIdsChange : undefined}
      toolbar={toolbar}
      emptyState={emptyState}
      showColumnPicker
      hasFooter
    />
  );
}
