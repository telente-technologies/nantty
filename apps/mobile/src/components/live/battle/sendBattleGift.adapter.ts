import { useRef } from "react";

import { useLiveGiftCatalog } from "@/components/live/gifts/liveGiftCatalog.hook";
import { useLiveGiftSentEvents } from "@/components/live/gifts/liveGiftEventStream.hook";
import { useSendLiveGift } from "@/components/live/gifts/sendLiveGift.hook";
import { shouldUseMockForPath } from "@/config/api.config";
import { liveGuestsService } from "@/services/live/liveGuests.service";
import type { LiveStage } from "@/types/liveStage.type";

export interface UseSendBattleGiftToStreamerOptions {
  readonly liveId: string;
  readonly recipientUserId: string | null;
  readonly runningBattleId: string | null;
  readonly signedInUserId: string | null;
  readonly isPickerOpen: boolean;
  readonly onStageUpdated: (stage: LiveStage) => void;
}

export function useSendBattleGiftToStreamer(options: UseSendBattleGiftToStreamerOptions) {
  const latest = useRef(options);
  latest.current = options;
  const { catalog } = useLiveGiftCatalog(options.isPickerOpen);
  const giftSending = useSendLiveGift({ liveId: options.liveId, recipientUserId: options.recipientUserId ?? undefined });

  useLiveGiftSentEvents(options.liveId, (event) => {
    const { runningBattleId, signedInUserId, recipientUserId, onStageUpdated } = latest.current;
    if (!shouldUseMockForPath("/api/v1/lives") || !runningBattleId || !recipientUserId || event.sender.id !== signedInUserId) return;
    liveGuestsService
      .creditLiveBattleGift(runningBattleId, { recipientUserId, giftId: event.giftId, quantity: event.quantity })
      .then(onStageUpdated)
      .catch(() => undefined);
  });

  return { gifts: (catalog.data?.data ?? []).filter((gift) => gift.isActive), isLoadingGifts: catalog.isPending, ...giftSending };
}
