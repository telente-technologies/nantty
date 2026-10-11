"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { ErrorState, InlineNotice, LoadingBlock } from "@/components/ui/feedback";
import { OverlayDialog } from "@/components/ui/overlayDialog";
import { DeliveryStatusBadge } from "@/components/ui/statusBadge";
import { Card, PageHeader } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { findObjectiveOption } from "@/constants/campaignOptions.constant";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { campaignsApi } from "@/services/campaignsApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import { formatDateWithYear } from "@/utils/dateRange.util";
import { formatMoneyForDisplay } from "@/utils/money.util";

import { AdSetsTable } from "./adSetsTable";
import { AdsTable } from "./adsTable";
import { CampaignEditPanel } from "./campaignEditPanel";
import { DeliveryKpiStrip } from "./deliveryKpiStrip";
import { DeliveryStatusCell } from "./deliveryStatusCell";
import { useDeliveryToggles } from "./deliveryToggles.hook";
import { useReloadWhileReviewIsPending } from "./reviewPolling.hook";
import styles from "./detailPages.module.css";

export function CampaignDetailPage({ campaignId }: { readonly campaignId: string }) {
  const { accountId, canPerform, buildAccountPagePath } = useAdAccount();
  const { showToast } = useToast();
  const router = useRouter();
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [runningAction, setRunningAction] = useState<"submit" | "duplicate" | "delete" | null>(null);
  const campaignQuery = useAdsQuery(() => campaignsApi.fetchCampaign(accountId, campaignId), `${accountId}:${campaignId}`);
  const adSetsQuery = useAdsQuery(() => campaignsApi.listAdSets(accountId, { campaignId }), `${accountId}:${campaignId}`);
  const adsQuery = useAdsQuery(() => campaignsApi.listAds(accountId, { campaignId }), `${accountId}:${campaignId}`);
  const reloadCampaignTree = useCallback(() => {
    campaignQuery.reload();
    adSetsQuery.reload();
    adsQuery.reload();
  }, [campaignQuery, adSetsQuery, adsQuery]);
  const { toggleCampaignDelivery, toggleAdSetDelivery, toggleAdDelivery } = useDeliveryToggles(reloadCampaignTree);
  const campaign = campaignQuery.data;
  const ads = adsQuery.data?.items ?? [];
  useReloadWhileReviewIsPending(campaign?.status === "in_review" || ads.some((ad) => ad.status === "in_review" || ad.review.appeal?.status === "pending"), reloadCampaignTree);
  const campaignsById = useMemo(() => new Map(campaign ? [[campaign.id, campaign]] : []), [campaign]);
  const adSetsById = useMemo(() => new Map((adSetsQuery.data?.items ?? []).map((adSet) => [adSet.id, adSet])), [adSetsQuery.data]);

  if (campaignQuery.errorMessage) return <ErrorState variant="section" error={campaignQuery.error} message={campaignQuery.errorMessage} onRetry={campaignQuery.reload} />;
  if (!campaign) return <LoadingBlock label="Loading campaign" height={320} />;

  const canManage = canPerform("campaigns:manage");
  const objective = findObjectiveOption(campaign.objective);
  const canSubmitForReview = canManage && (campaign.status === "draft" || campaign.status === "rejected" || campaign.rejectedAdCount > 0);

  async function runCampaignAction(action: "submit" | "duplicate" | "delete") {
    if (!campaign) return;
    setRunningAction(action);
    try {
      if (action === "submit") {
        await campaignsApi.submitCampaignForReview(accountId, campaign.id);
        showToast("Sent for review. Most ads are checked within a few hours.");
        reloadCampaignTree();
      } else if (action === "duplicate") {
        const copy = await campaignsApi.duplicateCampaign(accountId, campaign.id);
        showToast("Duplicated as a draft.");
        router.push(buildAccountPagePath(`/campaigns/${copy.id}`));
      } else {
        await campaignsApi.deleteDraftCampaign(accountId, campaign.id);
        showToast("Draft deleted.");
        router.push(buildAccountPagePath("/campaigns"));
      }
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setRunningAction(null);
      setIsDeleteConfirmationOpen(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={buildAccountPagePath("/campaigns")} className={styles.backLink}>
            <ZudoIcon name="arrowLeft24" size={14} /> Campaigns
          </Link>
        }
        title={
          <span className={styles.titleRow}>
            {campaign.name}
            {canManage ? <DeliveryStatusCell itemName={campaign.name} status={campaign.status} canToggle onToggleDelivery={(nextStatus) => toggleCampaignDelivery(campaign, nextStatus)} /> : <DeliveryStatusBadge status={campaign.status} />}
          </span>
        }
        description={
          <span className={styles.metaLine}>
            <span>{objective.label}</span>
            <span>{campaign.budget ? `${formatMoneyForDisplay(campaign.budget.amount)} ${campaign.budget.type} budget` : "Ad set budgets"}</span>
            {campaign.spendCap ? <span>Spending limit {formatMoneyForDisplay(campaign.spendCap)}</span> : null}
            <span>
              {formatDateWithYear(campaign.schedule.startAt)} – {campaign.schedule.endAt ? formatDateWithYear(campaign.schedule.endAt) : "ongoing"}
            </span>
          </span>
        }
        actions={
          canManage ? (
            <>
              {canSubmitForReview ? (
                <Button variant="primary" iconName="paperPlaneTilt24" isLoading={runningAction === "submit"} onClick={() => runCampaignAction("submit")}>
                  Send for review
                </Button>
              ) : null}
              <Button iconName="slidersHorizontal24" onClick={() => setIsEditPanelOpen(true)}>
                Edit
              </Button>
              <Button iconName="copy16" isLoading={runningAction === "duplicate"} onClick={() => runCampaignAction("duplicate")}>
                Duplicate
              </Button>
              {campaign.status === "draft" ? (
                <Button variant="danger" iconName="trash24" onClick={() => setIsDeleteConfirmationOpen(true)}>
                  Delete draft
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />
      <div className={styles.noticeStack}>
        {campaign.status === "in_review" ? <InlineNotice tone="info" title="In review">We check every ad against the advertising policies before it runs. This page refreshes on its own.</InlineNotice> : null}
        {campaign.rejectedAdCount > 0 ? (
          <InlineNotice tone="error" title={`${campaign.rejectedAdCount} ad${campaign.rejectedAdCount === 1 ? " was" : "s were"} rejected`}>
            Open the ad to see the policy reason, then edit it or appeal once.
          </InlineNotice>
        ) : null}
      </div>
      <DeliveryKpiStrip delivery={campaign.delivery} resultLabel={objective.resultLabel} dailyBudget={campaign.budget?.type === "daily" ? campaign.budget.amount : null} isDelivering={campaign.status === "active"} />
      <section className={styles.section} aria-labelledby="campaign-ad-sets-heading">
        <div className={styles.sectionHeading}>
          <h2 id="campaign-ad-sets-heading">Ad sets</h2>
        </div>
        <Card padded={false}>
          {adSetsQuery.isLoading && !adSetsQuery.data ? <LoadingBlock height={120} /> : <AdSetsTable adSets={adSetsQuery.data?.items ?? []} campaignsById={campaignsById} onToggleAdSetDelivery={toggleAdSetDelivery} showCampaignName={false} />}
        </Card>
      </section>
      <section className={styles.section} aria-labelledby="campaign-ads-heading">
        <div className={styles.sectionHeading}>
          <h2 id="campaign-ads-heading">Ads</h2>
        </div>
        <Card padded={false}>{adsQuery.isLoading && !adsQuery.data ? <LoadingBlock height={120} /> : <AdsTable ads={ads} campaignsById={campaignsById} adSetsById={adSetsById} onToggleAdDelivery={toggleAdDelivery} />}</Card>
      </section>
      <CampaignEditPanel campaign={campaign} isOpen={isEditPanelOpen} onClose={() => setIsEditPanelOpen(false)} onSaved={() => reloadCampaignTree()} />
      <OverlayDialog intent="delete"
        isOpen={isDeleteConfirmationOpen}
        onClose={() => setIsDeleteConfirmationOpen(false)}
        title="Delete this draft?"
        description="The campaign, its ad sets and ads are removed. Nothing has been charged."
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsDeleteConfirmationOpen(false)}>
              Keep draft
            </Button>
            <Button variant="danger" isLoading={runningAction === "delete"} onClick={() => runCampaignAction("delete")}>
              Delete draft
            </Button>
          </>
        }
      >
        <p>{campaign.name}</p>
      </OverlayDialog>
    </>
  );
}
