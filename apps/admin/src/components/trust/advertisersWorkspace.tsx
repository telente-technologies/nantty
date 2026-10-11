"use client";

import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { MoneyByCurrencyList } from "@/components/ui/moneyByCurrencyList";
import { PageHeader } from "@/components/ui/pageHeader";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { LinkTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchAdvertiserAccounts } from "@/services/adsReviewApi.service";
import type { AdvertiserAccount } from "@/types/adsReview.type";

import { AdvertiserAccountPanel } from "./advertiserAccountPanel";
import styles from "./trustShared.module.css";

export const advertiserSectionTabs = [
  { href: "/ads/advertisers", label: "Advertisers" },
  { href: "/ads/policies", label: "Policy categories" },
] as const;

const advertiserColumns: readonly DataTableColumn<AdvertiserAccount>[] = [
  { key: "name", header: "Advertiser", render: (advertiser) => <span className={styles.targetCellText}><strong>{advertiser.name}</strong><span className={styles.muted}>{advertiser.id} · {advertiser.country}</span></span> },
  { key: "owner", header: "Owner", render: (advertiser) => <UserIdentity user={advertiser.owner} size={24} /> },
  { key: "spend", header: "Lifetime spend", render: (advertiser) => <MoneyByCurrencyList amounts={advertiser.spendByCurrency} /> },
  { key: "campaigns", header: "Active campaigns", align: "end", isMono: true, render: (advertiser) => advertiser.activeCampaigns },
  { key: "violations", header: "Violations", align: "end", isMono: true, render: (advertiser) => (advertiser.violationCount >= 2 ? <StatusBadge tone="caution" label={`${advertiser.violationCount} violations`} /> : advertiser.violationCount) },
  { key: "status", header: "Status", render: (advertiser) => <StatusBadge status={advertiser.status} /> },
];

export function AdvertisersWorkspace() {
  const [filters, setFilters] = useState<{ status?: string; search?: string; page: number }>({ page: 1 });
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string | null>(null);
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchAdvertiserAccounts(filters, signal), JSON.stringify(filters));

  return (
    <>
      <PageHeader area="Trust & safety · Ads" title="Advertisers" description="Ad accounts, their spend in each billing currency, and policy history." />
      <LinkTabs label="Ads administration" items={advertiserSectionTabs} />
      <Toolbar>
        <div className={styles.filters}>
          <TextField label="Search" isLabelHidden type="search" placeholder="Search advertiser name or ID" value={filters.search ?? ""} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value || undefined, page: 1 }))} />
          <SelectField label="Status" isLabelHidden options={[{ value: "", label: "All statuses" }, { value: "ACTIVE", label: "Active" }, { value: "SUSPENDED", label: "Suspended" }]} value={filters.status ?? ""} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value || undefined, page: 1 }))} />
        </div>
      </Toolbar>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Advertiser accounts" columns={advertiserColumns} rows={data?.items ?? []} readRowKey={(advertiser) => advertiser.id} onRowOpen={(advertiser) => setSelectedAdvertiserId(advertiser.id)} selectedRowKey={selectedAdvertiserId} isLoading={isLoading} emptyMessage="No advertisers match." />
      {data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} /> : null}
      {selectedAdvertiserId ? <AdvertiserAccountPanel key={selectedAdvertiserId} advertiserId={selectedAdvertiserId} onClose={() => setSelectedAdvertiserId(null)} onAdvertiserChanged={reload} /> : null}
    </>
  );
}
