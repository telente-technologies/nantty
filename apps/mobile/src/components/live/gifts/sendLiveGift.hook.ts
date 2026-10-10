import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";

import { COIN_BALANCE_QUERY_KEY } from "@/components/coins/coinWallet.hook";
import { ApiError, generateIdempotencyKey } from "@/services/core/apiClient.service";
import { giftsService } from "@/services/money/gifts.service";
import { useAuthStore } from "@/store/auth.store";
import type { CoinBalance, LiveGift, LiveGiftSentEvent, SentLiveGiftReceipt, UserSummary } from "@/types";

import { publishLocallySentLiveGiftEvent } from "./liveGiftEventStream.hook";

export const LIVE_GIFT_COMBO_WINDOW_MS = 3_000;
const TAP_BATCH_WINDOW_MS = 300;
const MAXIMUM_GIFTS_PER_REQUEST = 100;

export interface UseSendLiveGiftOptions {
  readonly liveId: string;
  readonly recipientUserId?: string;
}

export interface LiveGiftComboWindow {
  readonly gift: LiveGift;
  readonly comboId: string;
  readonly comboCount: number;
  readonly lastSentAt: number;
}

interface SendLiveGiftVariables {
  readonly gift: LiveGift;
  readonly quantity: number;
  readonly comboId: string;
  readonly idempotencyKey: string;
}

const describeGiftSendingError = (error: unknown) => {
  if (error instanceof ApiError && error.status === 402) return "You don't have enough coins for this gift.";
  if (error instanceof ApiError) return error.message;
  return "We couldn't send your gift. Check your connection and try again.";
};

const buildLocalGiftSentEvent = (liveId: string, sender: UserSummary, gift: LiveGift, receipt: SentLiveGiftReceipt): LiveGiftSentEvent => ({
  type: "gift.sent",
  liveId,
  giftTransactionId: receipt.giftTransactionId,
  giftId: gift.id,
  animationAssetKey: gift.animationAssetKey,
  displayLevel: gift.displayLevel,
  quantity: receipt.quantity,
  totalCoins: receipt.totalCoins,
  sender: { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl },
  receiverUserId: receipt.receiverUserId,
  comboId: receipt.comboId,
  comboCount: receipt.comboCount,
  battleId: receipt.battleId ?? null,
});

const HAPTIC_STYLE_BY_GIFT_HAPTIC = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
  pattern: Haptics.ImpactFeedbackStyle.Heavy,
} as const;

const playGiftSendHaptic = (gift: LiveGift) => Haptics.impactAsync(HAPTIC_STYLE_BY_GIFT_HAPTIC[gift.haptic ?? "light"]).catch(() => undefined);

export function useSendLiveGift({ liveId, recipientUserId }: UseSendLiveGiftOptions) {
  const queryClient = useQueryClient();
  const signedInUser = useAuthStore((state) => state.user);
  const [comboWindow, setComboWindow] = useState<LiveGiftComboWindow | null>(null);
  const [hasNotEnoughCoins, setHasNotEnoughCoins] = useState(false);
  const comboWindowRef = useRef<LiveGiftComboWindow | null>(null);
  const pendingBatchRef = useRef<{ gift: LiveGift; quantity: number; comboId: string } | null>(null);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mutation = useMutation({
    mutationFn: ({ gift, quantity, comboId, idempotencyKey }: SendLiveGiftVariables) =>
      giftsService.sendGiftToLive({ liveId, giftId: gift.id, quantity, receiverUserId: recipientUserId, comboId }, idempotencyKey),
    onMutate: ({ gift, quantity }) => {
      const balanceBeforeSend = queryClient.getQueryData<CoinBalance>(COIN_BALANCE_QUERY_KEY);
      if (balanceBeforeSend) queryClient.setQueryData<CoinBalance>(COIN_BALANCE_QUERY_KEY, { ...balanceBeforeSend, coins: balanceBeforeSend.coins - gift.priceCoins * quantity });
      return { balanceBeforeSend };
    },
    onError: (error, { gift, quantity }) => {
      const current = queryClient.getQueryData<CoinBalance>(COIN_BALANCE_QUERY_KEY);
      if (current) queryClient.setQueryData<CoinBalance>(COIN_BALANCE_QUERY_KEY, { ...current, coins: current.coins + gift.priceCoins * quantity });
      if (error instanceof ApiError && error.status === 402) setHasNotEnoughCoins(true);
    },
    onSuccess: (receipt, { gift }) => {
      const cached = queryClient.getQueryData<CoinBalance>(COIN_BALANCE_QUERY_KEY);
      queryClient.setQueryData<CoinBalance>(COIN_BALANCE_QUERY_KEY, { ...cached, coins: receipt.coinBalance });
      if (comboWindowRef.current && receipt.comboId !== comboWindowRef.current.comboId && comboWindowRef.current.gift.id === gift.id) {
        comboWindowRef.current = { ...comboWindowRef.current, comboId: receipt.comboId };
      }
      if (signedInUser) publishLocallySentLiveGiftEvent(buildLocalGiftSentEvent(liveId, signedInUser, gift, receipt));
    },
  });
  const sendBatch = mutation.mutate;

  const flushPendingGiftBatch = useCallback(() => {
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    batchTimerRef.current = null;
    const batch = pendingBatchRef.current;
    pendingBatchRef.current = null;
    if (batch) sendBatch({ ...batch, idempotencyKey: generateIdempotencyKey() });
  }, [sendBatch]);

  const sendLiveGift = useCallback(
    (gift: LiveGift, quantity = 1) => {
      const pendingCoins = pendingBatchRef.current ? pendingBatchRef.current.gift.priceCoins * pendingBatchRef.current.quantity : 0;
      const knownCoins = queryClient.getQueryData<CoinBalance>(COIN_BALANCE_QUERY_KEY)?.coins;
      if (knownCoins !== undefined && knownCoins - pendingCoins < gift.priceCoins * quantity) {
        flushPendingGiftBatch();
        setHasNotEnoughCoins(true);
        return false;
      }
      const now = Date.now();
      const previous = comboWindowRef.current;
      const continuesCombo = gift.comboable && previous?.gift.id === gift.id && now - previous.lastSentAt < LIVE_GIFT_COMBO_WINDOW_MS;
      const nextComboWindow: LiveGiftComboWindow = {
        gift,
        comboId: continuesCombo && previous ? previous.comboId : `cmb_${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        comboCount: (continuesCombo && previous ? previous.comboCount : 0) + quantity,
        lastSentAt: now,
      };
      comboWindowRef.current = nextComboWindow;
      setComboWindow(nextComboWindow);
      void playGiftSendHaptic(gift);
      const pending = pendingBatchRef.current;
      if (pending && (pending.gift.id !== gift.id || pending.comboId !== nextComboWindow.comboId || pending.quantity + quantity > MAXIMUM_GIFTS_PER_REQUEST)) flushPendingGiftBatch();
      pendingBatchRef.current = { gift, comboId: nextComboWindow.comboId, quantity: (pendingBatchRef.current?.quantity ?? 0) + quantity };
      batchTimerRef.current ??= setTimeout(flushPendingGiftBatch, TAP_BATCH_WINDOW_MS);
      return true;
    },
    [flushPendingGiftBatch, queryClient],
  );

  useEffect(() => () => flushPendingGiftBatch(), [flushPendingGiftBatch]);

  const endComboWindow = useCallback(() => {
    comboWindowRef.current = null;
    setComboWindow(null);
  }, []);

  const dismissGiftError = useCallback(() => {
    setHasNotEnoughCoins(false);
    mutation.reset();
  }, [mutation]);

  return {
    sendLiveGift,
    comboWindow,
    endComboWindow,
    isSendingGift: mutation.isPending,
    hasNotEnoughCoins,
    giftSendingErrorMessage: mutation.isError ? describeGiftSendingError(mutation.error) : null,
    dismissGiftError,
  };
}
