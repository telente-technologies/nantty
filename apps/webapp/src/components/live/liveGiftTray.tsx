"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { SignInRequiredState } from "@/components/auth/signInRequiredState";
import { useSession } from "@/components/providers/sessionProvider";
import { CoinIcon } from "@/components/ui/icons";
import { showToast } from "@/components/ui/toast";
import { WebappRequestError, readErrorMessageForDisplay } from "@/services/clientApi.service";
import { coinsService, liveService } from "@/services/webActions.service";
import type { LiveGift } from "@/types";

import { CoinPurchaseDialog } from "./coinPurchaseDialog";
import panelStyles from "./livePanels.module.css";

const giftQuantities = [1, 5, 10] as const;

export function LiveGiftTray({ liveId, hostName }: { readonly liveId: string; readonly hostName: string }) {
  const { viewer } = useSession();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState<number>(1);
  const [coinsNeeded, setCoinsNeeded] = useState<number | null>(null);
  const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false);
  const giftsQuery = useQuery({ queryKey: ["gifts"], queryFn: liveService.fetchGiftCatalog, staleTime: 10 * 60_000, retry: false, enabled: viewer !== null });
  const balanceQuery = useQuery({ queryKey: ["coins", "balance"], queryFn: coinsService.fetchCoinBalance, enabled: viewer !== null, retry: false });
  const sendGiftMutation = useMutation({
    mutationFn: (gift: LiveGift) => liveService.sendGift(liveId, gift.id, quantity),
    onSuccess: (receipt, gift) => {
      queryClient.setQueryData(["coins", "balance"], { coins: receipt.coinBalance });
      void queryClient.invalidateQueries({ queryKey: ["live", liveId, "comments"] });
      showToast({ text: `Sent ${receipt.quantity > 1 ? `${receipt.quantity} × ` : ""}${gift.emoji} ${gift.name} to ${hostName}` });
    },
    onError: (error, gift) => {
      if (error instanceof WebappRequestError && error.code === "INSUFFICIENT_COINS") {
        setCoinsNeeded(Math.max(1, gift.priceCoins * quantity - (balanceQuery.data?.coins ?? 0)));
        setIsCoinStoreOpen(true);
        return;
      }
      showToast({ text: readErrorMessageForDisplay(error), tone: "error" });
    },
  });

  return (
    <section className={panelStyles.giftTray} aria-labelledby="gift-tray-title">
      <div className={panelStyles.giftTrayHeader}>
        <h2 id="gift-tray-title" className={panelStyles.sectionTitle}>
          Send a gift
        </h2>
        <button type="button" className={panelStyles.balance} onClick={() => requireAuthThen(() => setIsCoinStoreOpen(true), "Sign in to get coins.")}>
          <CoinIcon size={16} /> {viewer ? (balanceQuery.data?.coins ?? "…") : "Get coins"}
        </button>
      </div>
      <div className={panelStyles.quantityRow} role="group" aria-label="How many">
        {giftQuantities.map((option) => (
          <button key={option} type="button" className={[panelStyles.quantityChip, quantity === option ? panelStyles.quantityChipActive : ""].join(" ")} aria-pressed={quantity === option} onClick={() => setQuantity(option)}>
            ×{option}
          </button>
        ))}
      </div>
      {viewer === null ? <SignInRequiredState title="Sign in to send gifts" description={`Sign in or create a free account to send gifts to ${hostName}.`} /> : null}
      <ul className={panelStyles.giftGrid}>
        {(giftsQuery.data ?? []).map((gift) => (
          <li key={gift.id}>
            <button
              type="button"
              className={panelStyles.giftButton}
              disabled={sendGiftMutation.isPending}
              aria-label={`Send ${gift.name} for ${gift.priceCoins * quantity} coins`}
              onClick={() => requireAuthThen(() => sendGiftMutation.mutate(gift), `Sign in to send gifts to ${hostName}.`)}
            >
              <span className={panelStyles.giftEmoji} aria-hidden="true">
                {gift.emoji}
              </span>
              <span className={panelStyles.giftName}>{gift.name}</span>
              <span className={panelStyles.giftPrice}>
                <CoinIcon size={12} /> {gift.priceCoins * quantity}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <CoinPurchaseDialog isOpen={isCoinStoreOpen} onClose={() => setIsCoinStoreOpen(false)} coinsNeeded={coinsNeeded ?? undefined} />
    </section>
  );
}
