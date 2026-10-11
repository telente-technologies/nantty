"use client";

import { useCallback, useMemo, useState } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { Card, PageHeader } from "@/components/ui/surfaces";
import { TabList } from "@/components/ui/tabs";
import { deliveryStatusLabels, objectiveOptions } from "@/constants/campaignOptions.constant";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.hook";
import { campaignsApi } from "@/services/campaignsApi.service";
import type { CampaignObjective, DeliveryStatus } from "@/types/campaign.type";

import { AdSetsTable } from "./adSetsTable";
import { AdsTable } from "./adsTable";
import { BulkActionBar, type BulkLevel } from "./bulkActionBar";
import { CampaignsTable } from "./campaignsTable";
import { buildDeliveryRangeKey, resolveDeliveryRangeSelection, type DeliveryRangeSelection } from "./deliveryRange.util";
import { DeliveryRangeControl } from "./deliveryRangeControl";
import { useDeliveryToggles } from "./deliveryToggles.hook";
import styles from "./campaignsPage.module.css";

type ManagerTab = "campaigns" | "ad_sets" | "ads";

const levelByTab: Record<ManagerTab, BulkLevel> = { campaigns: "campaign", ad_sets: "ad_set", ads: "ad" };
const statusFilterOptions: readonly { value: DeliveryStatus | ""; label: string }[] = [{ value: "", label: "All statuses" }, ...(Object.keys(deliveryStatusLabels) as DeliveryStatus[]).map((status) => ({ value: status, label: deliveryStatusLabels[status] }))];
const objectiveFilterOptions: readonly { value: CampaignObjective | ""; label: string }[] = [{ value: "", label: "All objectives" }, ...objectiveOptions.map((option) => ({ value: option.objective, label: option.label }))];

export function CampaignsPage() {
  const { accountId, canPerform, buildAccountPagePath } = useAdAccount();
  const [activeTab, setActiveTab] = useState<ManagerTab>("campaigns");
  const [rangeSelection, setRangeSelection] = useState<DeliveryRangeSelection>({ preset: "last_30_days", customFrom: "", customTo: "" });
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "">("");
  const [objectiveFilter, setObjectiveFilter] = useState<CampaignObjective | "">("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const debouncedSearch = useDebouncedValue(searchText.trim(), 300);
  const range = resolveDeliveryRangeSelection(rangeSelection);
  const rangeKey = buildDeliveryRangeKey(range);

  const allCampaignsQuery = useAdsQuery(() => campaignsApi.listCampaigns(accountId, { from: range.from, to: range.to }), `${accountId}:${rangeKey}`);
  const adSetsQuery = useAdsQuery(() => campaignsApi.listAdSets(accountId, { campaignId: campaignFilter || undefined, from: range.from, to: range.to }), `${accountId}:${rangeKey}:${campaignFilter}`, activeTab !== "campaigns");
  const adsQuery = useAdsQuery(() => campaignsApi.listAds(accountId, { campaignId: campaignFilter || undefined, from: range.from, to: range.to }), `${accountId}:${rangeKey}:${campaignFilter}`, activeTab === "ads");

  const reloadEverything = useCallback(() => {
    allCampaignsQuery.reload();
    adSetsQuery.reload();
    adsQuery.reload();
  }, [allCampaignsQuery, adSetsQuery, adsQuery]);
  const { toggleCampaignDelivery, toggleAdSetDelivery, toggleAdDelivery } = useDeliveryToggles(reloadEverything);

  const allCampaigns = useMemo(() => allCampaignsQuery.data?.items ?? [], [allCampaignsQuery.data]);
  const campaignsById = useMemo(() => new Map(allCampaigns.map((campaign) => [campaign.id, campaign])), [allCampaigns]);
  const adSetsById = useMemo(() => new Map((adSetsQuery.data?.items ?? []).map((adSet) => [adSet.id, adSet])), [adSetsQuery.data]);
  const loweredSearch = debouncedSearch.toLowerCase();
  const matchesSearchAndStatus = (item: { name: string; status: DeliveryStatus }) => (!statusFilter || item.status === statusFilter) && (!loweredSearch || item.name.toLowerCase().includes(loweredSearch));
  const visibleCampaigns = allCampaigns.filter((campaign) => matchesSearchAndStatus(campaign) && (!objectiveFilter || campaign.objective === objectiveFilter));
  const visibleAdSets = (adSetsQuery.data?.items ?? []).filter(matchesSearchAndStatus);
  const visibleAds = (adsQuery.data?.items ?? []).filter(matchesSearchAndStatus);

  function switchTab(nextTab: ManagerTab) {
    if (activeTab === "campaigns" && nextTab !== "campaigns" && selectedIds.size === 1) setCampaignFilter([...selectedIds][0] ?? "");
    setActiveTab(nextTab);
    setSelectedIds(new Set());
  }

  const activeQuery = activeTab === "campaigns" ? allCampaignsQuery : activeTab === "ad_sets" ? adSetsQuery : adsQuery;
  const canCreate = canPerform("campaigns:manage");
  const emptyState = (
    <EmptyState
      iconName="squaresFour24"
      title={searchText || statusFilter || objectiveFilter ? "Nothing matches these filters" : "No campaigns yet"}
      description={searchText || statusFilter || objectiveFilter ? "Clear a filter or pick a longer date range." : "Create a campaign to promote a post, reel, product, live session or your whole store."}
      action={canCreate && !searchText && !statusFilter ? <ButtonLink href={buildAccountPagePath("/campaigns/new")} variant="primary" iconName="plus16">Create campaign</ButtonLink> : undefined}
    />
  );
  const bulkBar = <BulkActionBar level={levelByTab[activeTab]} selectedIds={selectedIds} onClearSelection={() => setSelectedIds(new Set())} onActionApplied={reloadEverything} />;

  return (
    <>
      <PageHeader title="Campaigns" description="Every campaign, ad set and ad in this account. Pick a date range to change the numbers." actions={canCreate ? <ButtonLink href={buildAccountPagePath("/campaigns/new")} variant="primary" iconName="plus16">Create campaign</ButtonLink> : undefined} />
      <div className={styles.filterRow}>
        <DeliveryRangeControl selection={rangeSelection} onSelectionChange={setRangeSelection} />
        <TextField label="Search by name" type="search" value={searchText} onValueChange={setSearchText} placeholder="Search" fieldClassName={styles.searchField} />
        <SelectField label="Status" value={statusFilter} options={statusFilterOptions} onValueChange={setStatusFilter} fieldClassName={styles.filterField} />
        {activeTab === "campaigns" ? (
          <SelectField label="Objective" value={objectiveFilter} options={objectiveFilterOptions} onValueChange={setObjectiveFilter} fieldClassName={styles.filterField} />
        ) : (
          <SelectField label="Campaign" value={campaignFilter} options={[{ value: "", label: "All campaigns" }, ...allCampaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))]} onValueChange={setCampaignFilter} fieldClassName={styles.filterField} />
        )}
      </div>
      <TabList<ManagerTab>
        label="Campaign levels"
        selected={activeTab}
        onSelect={switchTab}
        tabs={[
          { value: "campaigns", label: "Campaigns", count: allCampaigns.length },
          { value: "ad_sets", label: "Ad sets", count: adSetsQuery.data?.items.length },
          { value: "ads", label: "Ads", count: adsQuery.data?.items.length },
        ]}
      />
      <Card padded={false}>
        {activeQuery.errorMessage ? (
          <div className={styles.cardPadding}>
            <ErrorState error={activeQuery.error} message={activeQuery.errorMessage} onRetry={activeQuery.reload} />
          </div>
        ) : activeQuery.isLoading && !activeQuery.data ? (
          <div className={styles.cardPadding}>
            <LoadingBlock label="Loading delivery" height={280} />
          </div>
        ) : activeTab === "campaigns" ? (
          <CampaignsTable campaigns={visibleCampaigns} selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds} onToggleCampaignDelivery={toggleCampaignDelivery} toolbar={bulkBar} emptyState={emptyState} />
        ) : activeTab === "ad_sets" ? (
          <AdSetsTable adSets={visibleAdSets} campaignsById={campaignsById} selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds} onToggleAdSetDelivery={toggleAdSetDelivery} toolbar={bulkBar} emptyState={emptyState} />
        ) : (
          <AdsTable ads={visibleAds} campaignsById={campaignsById} adSetsById={adSetsById} selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds} onToggleAdDelivery={toggleAdDelivery} toolbar={bulkBar} emptyState={emptyState} />
        )}
      </Card>
    </>
  );
}
