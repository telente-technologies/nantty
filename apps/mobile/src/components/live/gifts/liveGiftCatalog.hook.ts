import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { giftsService } from "@/services/money/gifts.service";
import type { LiveGift, LiveGiftTier } from "@/types";

export const LIVE_GIFT_CATALOG_QUERY_KEY = ["live-gift-catalog"] as const;
export const LIVE_GIFT_COMBO_THRESHOLDS = [1, 5, 10, 50, 100] as const;

export type LiveGiftPanelSection = "popular" | "premium" | "legendary";

const PANEL_SECTION_BY_TIER: Record<LiveGiftTier, LiveGiftPanelSection> = { basic: "popular", premium: "premium", legendary: "legendary" };

export const comboEscalationStageForCount = (comboCount: number) =>
  LIVE_GIFT_COMBO_THRESHOLDS.reduce((stage, threshold, index) => (comboCount >= threshold ? index : stage), 0);

export const didComboCrossThreshold = (previousCount: number, nextCount: number, threshold: number) => previousCount < threshold && nextCount >= threshold;

export function useLiveGiftCatalog(enabled = true) {
  const catalog = useQuery({ queryKey: LIVE_GIFT_CATALOG_QUERY_KEY, queryFn: giftsService.fetchLiveGiftCatalog, enabled, staleTime: 60 * 60_000 });
  const gifts = catalog.data?.data;
  const giftsById = useMemo(() => new Map((gifts ?? []).map((gift) => [gift.id, gift])), [gifts]);
  const giftsBySection = useMemo(() => {
    const sections: Record<LiveGiftPanelSection, LiveGift[]> = { popular: [], premium: [], legendary: [] };
    [...(gifts ?? [])]
      .filter((gift) => gift.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((gift) => sections[PANEL_SECTION_BY_TIER[gift.tier]].push(gift));
    return sections;
  }, [gifts]);
  return { catalog, giftsById, giftsBySection };
}
