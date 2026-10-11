"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { AdPreview } from "@/components/creative/adPreview";
import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/formFields";
import { DeliveryStatusBadge } from "@/components/ui/statusBadge";
import { Card, KeyValueList, PageHeader } from "@/components/ui/surfaces";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { callToActionLabels, creativeFormatLabels, creativeTypeLabels, findObjectiveOption, placementLabels } from "@/constants/campaignOptions.constant";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { campaignsApi } from "@/services/campaignsApi.service";
import type { AdPlacement } from "@/types/campaign.type";
import { formatDateAndTime } from "@/utils/dateRange.util";

import { AdCardReport } from "./adCardReport";
import { AdAppealDialog } from "./adAppealDialog";
import { AdCreativeEditPanel } from "./adCreativeEditPanel";
import { AdReviewPanel } from "./adReviewPanel";
import { DeliveryKpiStrip } from "./deliveryKpiStrip";
import { DeliveryStatusCell } from "./deliveryStatusCell";
import { useDeliveryToggles } from "./deliveryToggles.hook";
import { useReloadWhileReviewIsPending } from "./reviewPolling.hook";
import styles from "./detailPages.module.css";

const sourceTypeLabels = { post: "Existing post", clip: "Existing reel", product: "Product from your store", live: "Live session", store: "Your store", upload: "Uploaded media" } as const;

export function AdDetailPage({ adId }: { readonly adId: string }) {
  const { accountId, canPerform, buildAccountPagePath } = useAdAccount();
  const [isAppealOpen, setIsAppealOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [previewPlacement, setPreviewPlacement] = useState<AdPlacement | null>(null);
  const adQuery = useAdsQuery(() => campaignsApi.fetchAd(accountId, adId), `${accountId}:${adId}`);
  const ad = adQuery.data;
  const adSetQuery = useAdsQuery(() => campaignsApi.fetchAdSet(accountId, ad?.adSetId ?? ""), `${accountId}:${ad?.adSetId ?? ""}`, Boolean(ad?.adSetId));
  const campaignQuery = useAdsQuery(() => campaignsApi.fetchCampaign(accountId, ad?.campaignId ?? ""), `${accountId}:${ad?.campaignId ?? ""}`, Boolean(ad?.campaignId));
  const reloadAd = useCallback(() => adQuery.reload(), [adQuery]);
  const { toggleAdDelivery } = useDeliveryToggles(reloadAd);
  useReloadWhileReviewIsPending(ad?.status === "in_review" || ad?.review.appeal?.status === "pending", reloadAd);

  if (adQuery.errorMessage) return <ErrorState variant="section" error={adQuery.error} message={adQuery.errorMessage} onRetry={adQuery.reload} />;
  if (!ad) return <LoadingBlock label="Loading ad" height={320} />;
  const canManage = canPerform("campaigns:manage");
  const adSet = adSetQuery.data;
  const campaign = campaignQuery.data;
  const availablePlacements = adSet?.placements ?? [];
  const activePlacement = previewPlacement ?? availablePlacements[0] ?? "feed";

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={buildAccountPagePath(`/ad-sets/${ad.adSetId}`)} className={styles.backLink}>
            <ZudoIcon name="arrowLeft24" size={14} /> {adSet?.name ?? "Ad set"}
          </Link>
        }
        title={
          <span className={styles.titleRow}>
            {ad.name}
            {canManage ? <DeliveryStatusCell itemName={ad.name} status={ad.status} canToggle onToggleDelivery={(nextStatus) => toggleAdDelivery(ad, nextStatus)} /> : <DeliveryStatusBadge status={ad.status} />}
          </span>
        }
        description={campaign ? `${campaign.name} · ${findObjectiveOption(campaign.objective).label}` : undefined}
        actions={
          canManage ? (
            <Button iconName="textIndent24" onClick={() => setIsEditorOpen(true)}>
              Edit text
            </Button>
          ) : undefined
        }
      />
      <DeliveryKpiStrip delivery={ad.delivery} resultLabel={campaign ? findObjectiveOption(campaign.objective).resultLabel : "Results"} dailyBudget={null} isDelivering={ad.status === "active"} />
      <div className={styles.adLayout}>
        <div className={styles.previewFrame}>
          {availablePlacements.length > 1 ? (
            <SegmentedControl<AdPlacement> label="Preview placement" value={activePlacement} onValueChange={setPreviewPlacement} options={availablePlacements.map((placement) => ({ value: placement, label: placementLabels[placement] }))} />
          ) : null}
          <AdPreview creative={ad.creative} placement={activePlacement} />
        </div>
        <div className={styles.stack}>
          <AdReviewPanel ad={ad} canManage={canManage} onOpenAppeal={() => setIsAppealOpen(true)} onOpenEditor={() => setIsEditorOpen(true)} />
          <Card title="Creative">
            <KeyValueList
              items={[
                { label: "Ad type", value: creativeTypeLabels[ad.creative.type ?? "single"].label },
                { label: "Format", value: creativeFormatLabels[ad.creative.format] },
                ...(ad.creative.cards?.length ? [{ label: "Cards", value: String(ad.creative.cards.length) }] : []),
                ...(ad.creative.app ? [{ label: "App", value: ad.creative.app.appName }] : []),
                ...(ad.creative.mediaClickable ? [{ label: "Media link", value: "Tapping the media opens the link" }] : []),
                { label: "Source", value: sourceTypeLabels[ad.creative.source.type] },
                { label: "Headline", value: ad.creative.headline },
                { label: "Button", value: callToActionLabels[ad.creative.callToAction] },
                { label: "Shown as", value: `${ad.creative.identity.name}${ad.creative.identity.verifiedBusiness ? " · Verified business" : ""}` },
                { label: "Last edited", value: formatDateAndTime(ad.updatedAt) },
              ]}
            />
            {ad.creative.primaryText ? <p className={styles.mutedText}>{ad.creative.primaryText}</p> : null}
          </Card>
          <AdCardReport ad={ad} />
        </div>
      </div>
      <AdAppealDialog ad={ad} isOpen={isAppealOpen} onClose={() => setIsAppealOpen(false)} onAppealed={() => adQuery.reload()} />
      <AdCreativeEditPanel ad={ad} isOpen={isEditorOpen} onClose={() => setIsEditorOpen(false)} onSaved={() => adQuery.reload()} />
    </>
  );
}
