"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { SignInRequiredState } from "@/components/auth/signInRequiredState";
import { useSession } from "@/components/providers/sessionProvider";
import { CoinIcon } from "@/components/ui/icons";
import { showToast } from "@/components/ui/toast";
import { createIdempotencyKey, WebappRequestError, readErrorMessageForDisplay } from "@/services/clientApi.service";
import { coinsService } from "@/services/webActions.service";
import { spacesService } from "@/services/spaces.service";

import { CoinPurchaseDialog } from "@/components/live/coinPurchaseDialog";
import styles from "./spaces.module.css";

export function SpaceCoinDonationPanel({ spaceId, hostName }: { readonly spaceId: string; readonly hostName: string }) {
  const { viewer } = useSession();
  const queryClient = useQueryClient();
  const [coinsText, setCoinsText] = useState("");
  const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false);
  const [coinsNeeded, setCoinsNeeded] = useState<number | undefined>();
  const pendingDonation = useRef<{ coins: number; key: string } | null>(null);
  const coins = Number(coinsText);
  const validAmount = Number.isSafeInteger(coins) && coins > 0;
  const balance = useQuery({ queryKey: ["coins", "balance"], queryFn: coinsService.fetchCoinBalance, enabled: viewer !== null, retry: false });
  const donation = useMutation({
    mutationFn: () => {
      if (!validAmount) throw new Error("Enter a whole number of coins to donate.");
      if (pendingDonation.current?.coins !== coins) pendingDonation.current = { coins, key: createIdempotencyKey("space-donation") };
      return spacesService.donateCoins(spaceId, coins, pendingDonation.current.key);
    },
    onSuccess: (receipt) => {
      pendingDonation.current = null;
      setCoinsText("");
      queryClient.setQueryData(["coins", "balance"], { coins: receipt.senderCoinBalance });
      showToast({ text: `${receipt.totalCoins.toLocaleString()} coins sent to ${hostName}.` });
    },
    onError: (error) => {
      if (error instanceof WebappRequestError && error.code === "INSUFFICIENT_COINS") {
        pendingDonation.current = null;
        setCoinsNeeded(Math.max(1, coins - (balance.data?.coins ?? 0)));
        setIsCoinStoreOpen(true);
        return;
      }
      if (error instanceof WebappRequestError && error.status > 0 && error.status < 500) pendingDonation.current = null;
      showToast({ text: readErrorMessageForDisplay(error), tone: "error" });
    },
  });

  return (
    <section className={styles.giftPanel} aria-labelledby="space-donation-title">
      <div className={styles.giftHeader}>
        <h2 id="space-donation-title">Support the host with coins</h2>
        <button type="button" className={styles.secondary} onClick={() => requireAuthThen(() => setIsCoinStoreOpen(true), "Sign in to get coins.")}>
          <CoinIcon size={16} /> {viewer ? (balance.data?.coins ?? "…") : "Get coins"}
        </button>
      </div>
      {viewer ? (
        <form className={styles.coinDonationForm} onSubmit={(event) => { event.preventDefault(); donation.mutate(); }}>
          <label htmlFor="space-donation-coins">Coin amount</label>
          <input
            id="space-donation-coins"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={12}
            value={coinsText}
            onChange={(event) => {
              setCoinsText(event.target.value.replace(/[^0-9]/g, ""));
              donation.reset();
              pendingDonation.current = null;
            }}
            aria-describedby="space-donation-note"
            placeholder="Enter coins"
          />
          <button type="submit" className={styles.button} disabled={!validAmount || donation.isPending}>
            {donation.isPending ? "Sending…" : validAmount ? `Donate ${coins.toLocaleString()} coins` : "Enter a coin amount"}
          </button>
        </form>
      ) : <SignInRequiredState title="Sign in to support the host" description={`Donate coins to ${hostName}.`} />}
      <p id="space-donation-note" className={styles.muted}>This is a coin donation to the host, not a virtual gift. Server-set limits and creator eligibility apply.</p>
      {donation.isError && !(donation.error instanceof WebappRequestError && donation.error.code === "INSUFFICIENT_COINS") ? <p role="alert">{readErrorMessageForDisplay(donation.error)}</p> : null}
      <CoinPurchaseDialog isOpen={isCoinStoreOpen} onClose={() => setIsCoinStoreOpen(false)} coinsNeeded={coinsNeeded} />
    </section>
  );
}
