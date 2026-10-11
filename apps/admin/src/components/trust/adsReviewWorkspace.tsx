"use client";

import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchAdPolicyCategories, fetchAdsForReview } from "@/services/adsReviewApi.service";
import type { AdForReview } from "@/types/adsReview.type";
import { formatMoneyForDisplay, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { AdReviewPanel } from "./adReviewPanel";
import styles from "./trustShared.module.css";

const statusTabs = [
  { key: "PENDING", label: "Waiting for review" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
] as const;

const adColumns: readonly DataTableColumn<AdForReview>[] = [
  { key: "creative", header: "Ad", render: (ad) => <span className={styles.targetCell}><img src={ad.creative.imageUrl} alt="" className={styles.mediaThumbnailSmall} loading="lazy" referrerPolicy="no-referrer" /><span className={styles.targetCellText}><span className={styles.truncate}>{ad.creative.headline}</span><span className={styles.muted}>{ad.campaignName}</span></span></span> },
  { key: "advertiser", header: "Advertiser", render: (ad) => ad.advertiser.name },
  { key: "format", header: "Format", render: (ad) => `${humanizeConstantName(ad.creative.format)}${ad.isBoostedPost ? " (boost)" : ""}` },
  { key: "budget", header: "Daily budget", align: "end", isMono: true, render: (ad) => formatMoneyForDisplay(ad.dailyBudget) },
  { key: "flags", header: "Auto-check", render: (ad) => (ad.autoCheckFlags.length === 0 ? <StatusBadge label="Clean" tone="success" /> : <StatusBadge label={`${ad.autoCheckFlags.length} flag${ad.autoCheckFlags.length === 1 ? "" : "s"}`} tone={ad.autoCheckFlags.some((flag) => flag.severity === "CRITICAL") ? "danger" : "caution"} />) },
  { key: "status", header: "Status", render: (ad) => <StatusBadge status={ad.status} /> },
  { key: "submitted", header: "Submitted", render: (ad) => formatRelativeTimeFromNow(ad.submittedAt) },
];

export function AdsReviewWorkspace() {
  const [statusTab, setStatusTab] = useState<(typeof statusTabs)[number]["key"]>("PENDING");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  const filters = { status: statusTab, search: search || undefined, page };
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchAdsForReview(filters, signal), JSON.stringify(filters));
  const policies = useAdminQuery((signal) => fetchAdPolicyCategories(signal), "policies");

  return (
    <>
      <PageHeader area="Trust & safety · Ads" title="Ads review" description="New and edited ads and boosted posts wait here before they can deliver. Flagged ads are listed first." />
      <SegmentedTabs label="Review status" items={statusTabs} activeKey={statusTab} onChange={(key) => { setStatusTab(key); setPage(1); }} />
      <Toolbar>
        <div className={styles.filters}>
          <TextField label="Search" isLabelHidden type="search" placeholder="Search headline, campaign or advertiser" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
      </Toolbar>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Ads waiting for review" columns={adColumns} rows={data?.items ?? []} readRowKey={(ad) => ad.id} onRowOpen={(ad) => setSelectedAdId(ad.id)} selectedRowKey={selectedAdId} isLoading={isLoading} readRowTone={(ad) => (ad.autoCheckFlags.some((flag) => flag.severity === "CRITICAL") ? "danger" : ad.autoCheckFlags.length > 0 ? "caution" : null)} emptyMessage="No ads waiting for review." />
      {data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} /> : null}
      {selectedAdId ? <AdReviewPanel key={selectedAdId} adId={selectedAdId} policies={policies.data?.items ?? []} onClose={() => setSelectedAdId(null)} onAdChanged={reload} /> : null}
    </>
  );
}
