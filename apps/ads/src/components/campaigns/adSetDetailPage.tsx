"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { DeliveryStatusBadge } from "@/components/ui/statusBadge";
import { Card, KeyValueList, PageHeader } from "@/components/ui/surfaces";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { bidStrategyOptions, findObjectiveOption, placementLabels } from "@/constants/campaignOptions.constant";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { campaignsApi } from "@/services/campaignsApi.service";
import type { AdSet } from "@/types/campaign.type";
import { formatDateAndTime } from "@/utils/dateRange.util";
import { formatMoneyForDisplay } from "@/utils/money.util";

import { AdSetEditPanel } from "./adSetEditPanel";
import { readDailyBudgetForAdSet } from "./adSetsTable";
import { AdsTable } from "./adsTable";
import { AudienceSummary } from "./audienceSummary";
import { DeliveryKpiStrip } from "./deliveryKpiStrip";
import { DeliveryStatusCell } from "./deliveryStatusCell";
import { useDeliveryToggles } from "./deliveryToggles.hook";
import { useReloadWhileReviewIsPending } from "./reviewPolling.hook";
import styles from "./detailPages.module.css";

function describeBidStrategy(adSet: AdSet): string {
  const label = bidStrategyOptions.find((option) => option.type === adSet.bidStrategy.type)?.label ?? adSet.bidStrategy.type;
  return adSet.bidStrategy.amount ? `${label}: ${formatMoneyForDisplay(adSet.bidStrategy.amount)}` : label;
}

export function AdSetDetailPage({ adSetId }: { readonly adSetId: string }) {
  const { accountId, canPerform, buildAccountPagePath } = useAdAccount();
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const adSetQuery = useAdsQuery(() => campaignsApi.fetchAdSet(accountId, adSetId), `${accountId}:${adSetId}`);
  const campaignId = adSetQuery.data?.campaignId ?? "";
  const campaignQuery = useAdsQuery(() => campaignsApi.fetchCampaign(accountId, campaignId), `${accountId}:${campaignId}`, Boolean(campaignId));
  const adsQuery = useAdsQuery(() => campaignsApi.listAds(accountId, { adSetId }), `${accountId}:${adSetId}`);
  const reloadAdSetTree = useCallback(() => {
    adSetQuery.reload();
    adsQuery.reload();
  }, [adSetQuery, adsQuery]);
  const { toggleAdSetDelivery, toggleAdDelivery } = useDeliveryToggles(reloadAdSetTree);
  const adSet = adSetQuery.data;
  const campaign = campaignQuery.data;
  const ads = adsQuery.data?.items ?? [];
  useReloadWhileReviewIsPending(ads.some((ad) => ad.status === "in_review"), reloadAdSetTree);
  const campaignsById = useMemo(() => new Map(campaign ? [[campaign.id, campaign]] : []), [campaign]);
  const adSetsById = useMemo(() => new Map(adSet ? [[adSet.id, adSet]] : []), [adSet]);

  if (adSetQuery.errorMessage) return <ErrorState variant="section" error={adSetQuery.error} message={adSetQuery.errorMessage} onRetry={adSetQuery.reload} />;
  if (!adSet) return <LoadingBlock label="Loading ad set" height={320} />;
  const canManage = canPerform("campaigns:manage");

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={buildAccountPagePath(`/campaigns/${adSet.campaignId}`)} className={styles.backLink}>
            <ZudoIcon name="arrowLeft24" size={14} /> {campaign?.name ?? "Campaign"}
          </Link>
        }
        title={
          <span className={styles.titleRow}>
            {adSet.name}
            {canManage ? <DeliveryStatusCell itemName={adSet.name} status={adSet.status} canToggle onToggleDelivery={(nextStatus) => toggleAdSetDelivery(adSet, nextStatus)} /> : <DeliveryStatusBadge status={adSet.status} />}
          </span>
        }
        description={adSet.experimentId ? "Part of a running A/B test. Edits can skew the result." : undefined}
        actions={
          canManage ? (
            <Button iconName="slidersHorizontal24" onClick={() => setIsEditPanelOpen(true)}>
              Edit budget &amp; bidding
            </Button>
          ) : undefined
        }
      />
      <DeliveryKpiStrip delivery={adSet.delivery} resultLabel={campaign ? findObjectiveOption(campaign.objective).resultLabel : "Results"} dailyBudget={readDailyBudgetForAdSet(adSet, campaign ?? undefined)} isDelivering={adSet.status === "active"} />
      <div className={styles.twoColumns}>
        <Card title="Audience" description="Who can see the ads in this ad set.">
          <AudienceSummary audience={adSet.audience} />
        </Card>
        <Card title="Delivery settings">
          <KeyValueList
            items={[
              { label: "Placements", value: adSet.placementMode === "automatic" ? "Automatic (all placements)" : adSet.placements.map((placement) => placementLabels[placement]).join(", ") },
              { label: "Budget", value: adSet.budget ? `${formatMoneyForDisplay(adSet.budget.amount)} ${adSet.budget.type}` : "Shared campaign budget" },
              { label: "Bid strategy", value: describeBidStrategy(adSet) },
              { label: "Frequency cap", value: adSet.frequencyCap ? `${adSet.frequencyCap.impressions} impressions per ${adSet.frequencyCap.perDays} day${adSet.frequencyCap.perDays === 1 ? "" : "s"}` : "No cap" },
              { label: "Starts", value: formatDateAndTime(adSet.schedule.startAt) },
              { label: "Ends", value: adSet.schedule.endAt ? formatDateAndTime(adSet.schedule.endAt) : "Runs until you stop it" },
            ]}
          />
        </Card>
      </div>
      <section className={styles.section} aria-labelledby="ad-set-ads-heading">
        <div className={styles.sectionHeading}>
          <h2 id="ad-set-ads-heading">Ads</h2>
        </div>
        <Card padded={false}>{adsQuery.isLoading && !adsQuery.data ? <LoadingBlock height={120} /> : <AdsTable ads={ads} campaignsById={campaignsById} adSetsById={adSetsById} onToggleAdDelivery={toggleAdDelivery} />}</Card>
      </section>
      <AdSetEditPanel adSet={adSet} isOpen={isEditPanelOpen} onClose={() => setIsEditPanelOpen(false)} onSaved={reloadAdSetTree} />
    </>
  );
}
