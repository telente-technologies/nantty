"use client";

import { useCallback } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { useToast } from "@/components/ui/toastProvider";
import { campaignsApi } from "@/services/campaignsApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { Ad, AdSet, Campaign } from "@/types/campaign.type";

export function useDeliveryToggles(onChanged: () => void) {
  const { accountId } = useAdAccount();
  const { showToast } = useToast();

  const runToggleAndReport = useCallback(
    async (itemName: string, nextStatus: "active" | "paused", sendChange: () => Promise<unknown>) => {
      try {
        await sendChange();
        showToast(`${nextStatus === "active" ? "Resumed" : "Paused"} ${itemName}.`);
        onChanged();
      } catch (error) {
        showToast(readErrorMessageForDisplay(error), "error");
      }
    },
    [onChanged, showToast],
  );

  const toggleCampaignDelivery = useCallback((campaign: Campaign, nextStatus: "active" | "paused") => runToggleAndReport(campaign.name, nextStatus, () => campaignsApi.updateCampaign(accountId, campaign.id, { status: nextStatus })), [accountId, runToggleAndReport]);
  const toggleAdSetDelivery = useCallback((adSet: AdSet, nextStatus: "active" | "paused") => runToggleAndReport(adSet.name, nextStatus, () => campaignsApi.updateAdSet(accountId, adSet.id, { status: nextStatus })), [accountId, runToggleAndReport]);
  const toggleAdDelivery = useCallback((ad: Ad, nextStatus: "active" | "paused") => runToggleAndReport(ad.name, nextStatus, () => campaignsApi.updateAd(accountId, ad.id, { status: nextStatus })), [accountId, runToggleAndReport]);

  return { toggleCampaignDelivery, toggleAdSetDelivery, toggleAdDelivery };
}
