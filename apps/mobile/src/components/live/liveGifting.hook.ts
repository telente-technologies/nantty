import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { ApiError, generateIdempotencyKey } from "@/services/apiClient.service";
import { giftsService } from "@/services/gifts.service";
import { useAuthStore } from "@/store/auth.store";
import { COIN_BALANCE_QUERY_KEY } from "@/components/coins/coinWallet.hook";
import type { CoinBalance, LiveComment, LiveGift } from "@/types";

const describeGiftSendingError = (error: unknown) => {
  if (error instanceof ApiError && error.status === 402) return "You don't have enough coins for this gift. Buy coins and try again.";
  if (error instanceof ApiError) return error.message;
  return "We couldn't send your gift. Check your connection and try again.";
};

export function useLiveGifting(liveId: string, isGiftPickerOpen: boolean) {
  const signedInUser = useAuthStore((state) => state.user);
  const [sentGiftComments, setSentGiftComments] = useState<LiveComment[]>([]);
  const [latestGiftBurst, setLatestGiftBurst] = useState<{ readonly key: number; readonly emoji: string } | null>(null);
  const queryClient = useQueryClient();
  const pendingGiftIdempotencyKey = useRef<string | null>(null);

  const giftCatalog = useQuery({
    queryKey: ["live-gift-catalog"],
    queryFn: giftsService.fetchLiveGiftCatalog,
    enabled: isGiftPickerOpen,
    staleTime: 60 * 60_000,
  });

  const sendGift = useMutation({
    mutationFn: ({ gift, quantity }: { gift: LiveGift; quantity: number }) => {
      pendingGiftIdempotencyKey.current ??= generateIdempotencyKey();
      return giftsService.sendGiftToLive(liveId, { giftId: gift.id, quantity }, pendingGiftIdempotencyKey.current);
    },
    onSuccess: (receipt, { gift, quantity }) => {
      pendingGiftIdempotencyKey.current = null;
      queryClient.setQueryData<CoinBalance>(COIN_BALANCE_QUERY_KEY, { coins: receipt.coinBalance });
      setLatestGiftBurst({ key: Date.now(), emoji: gift.emoji });
      if (!signedInUser) return;
      const giftComment: LiveComment = {
        id: `gift_${Date.now()}`,
        author: signedInUser,
        text: `sent ${quantity > 1 ? `${quantity} × ` : ""}${gift.emoji} ${gift.name}`,
        kind: "gift",
        gift: { giftId: gift.id, name: gift.name, emoji: gift.emoji, quantity },
      };
      setSentGiftComments((existing) => [...existing, giftComment]);
    },
  });

  const forgetPendingGiftAttempt = () => {
    pendingGiftIdempotencyKey.current = null;
    sendGift.reset();
  };

  return {
    giftCatalog,
    sendGift,
    sentGiftComments,
    latestGiftBurst,
    hasNotEnoughCoinsForGift: sendGift.isError && sendGift.error instanceof ApiError && sendGift.error.status === 402,
    giftSendingErrorMessage: sendGift.isError ? describeGiftSendingError(sendGift.error) : null,
    forgetPendingGiftAttempt,
  };
}
