"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { SignInRequiredState } from "@/components/auth/signInRequiredState";
import { useSession } from "@/components/providers/sessionProvider";
import { CoinIcon, GiftIcon } from "@/components/ui/icons";
import { showToast } from "@/components/ui/toast";
import { createIdempotencyKey, WebappRequestError, readErrorMessageForDisplay } from "@/services/clientApi.service";
import { coinsService } from "@/services/webActions.service";
import { spacesService } from "@/services/spaces.service";

import { CoinPurchaseDialog } from "@/components/live/coinPurchaseDialog";
import styles from "./spaces.module.css";

export function SpaceGiftTray({ spaceId, hostName }: { readonly spaceId: string; readonly hostName: string }) {
  const { viewer } = useSession();
  const queryClient = useQueryClient();
  const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false);
  const [coinsNeeded, setCoinsNeeded] = useState<number | undefined>();
  const pendingGiftKey = useRef<{ giftId: string; key: string } | null>(null);
  const gifts = useQuery({ queryKey: ["gifts"], queryFn: spacesService.gifts, enabled: viewer !== null, retry: false, staleTime: 10 * 60_000 });
  const balance = useQuery({ queryKey: ["coins", "balance"], queryFn: coinsService.fetchCoinBalance, enabled: viewer !== null, retry: false });
  const sendGift = useMutation({
    mutationFn: (giftId: string) => {
      if (pendingGiftKey.current?.giftId !== giftId) pendingGiftKey.current = { giftId, key: createIdempotencyKey("space-gift") };
      return spacesService.gift(spaceId, giftId, pendingGiftKey.current.key);
    },
    onSuccess: (receipt) => {
      pendingGiftKey.current = null;
      queryClient.setQueryData(["coins", "balance"], { coins: receipt.senderCoinBalance });
      showToast({ text: `Gift sent. ${hostName}'s creator earnings have been credited.` });
    },
    onError: (error, giftId) => {
      if (error instanceof WebappRequestError && error.code === "INSUFFICIENT_COINS") {
        pendingGiftKey.current = null;
        const gift = gifts.data?.data.find((item) => item.id === giftId);
        setCoinsNeeded(Math.max(1, (gift?.priceCoins ?? 1) - (balance.data?.coins ?? 0)));
        setIsCoinStoreOpen(true);
        return;
      }
      if (error instanceof WebappRequestError && error.status > 0 && error.status < 500) pendingGiftKey.current = null;
      showToast({ text: readErrorMessageForDisplay(error), tone: "error" });
    },
  });

  return (
    <section className={styles.giftPanel} aria-labelledby="space-gift-title">
      <div className={styles.giftHeader}>
        <h2 id="space-gift-title">Send a coin gift</h2>
        <button type="button" className={styles.secondary} onClick={() => requireAuthThen(() => setIsCoinStoreOpen(true), "Sign in to get coins.")}>
          <CoinIcon size={16} /> {viewer ? (balance.data?.coins ?? "…") : "Get coins"}
        </button>
      </div>
      {viewer ? (
        gifts.isPending ? <p role="status">Loading gifts…</p> : gifts.isError ? <p role="alert">Gifts are temporarily unavailable.</p> :
          <div className={styles.giftGrid}>
            {(gifts.data?.data ?? []).map((gift) => (
              <button key={gift.id} type="button" className={styles.giftOption} disabled={sendGift.isPending} onClick={() => sendGift.mutate(gift.id)}>
                <span aria-hidden="true"><GiftIcon size={22} /></span>
                <span>{gift.name}</span>
                <span><CoinIcon size={14} /> {gift.priceCoins}</span>
              </button>
            ))}
          </div>
      ) : <SignInRequiredState title="Sign in to send a gift" description={`Support ${hostName} with a coin gift.`} />}
      {sendGift.isError && !(sendGift.error instanceof WebappRequestError && sendGift.error.code === "INSUFFICIENT_COINS") ? <p role="alert">{readErrorMessageForDisplay(sendGift.error)}</p> : null}
      <p className={styles.muted}>The host receives creator earnings after the gift is successfully credited. Gifts have no animation.</p>
      <CoinPurchaseDialog isOpen={isCoinStoreOpen} onClose={() => setIsCoinStoreOpen(false)} coinsNeeded={coinsNeeded} />
    </section>
  );
}
