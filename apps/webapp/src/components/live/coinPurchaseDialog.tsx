"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { CoinIcon } from "@/components/ui/icons";
import { ModalDialog } from "@/components/ui/modalDialog";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { coinsService } from "@/services/webActions.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { openPaystackCheckout } from "@/utils/paystackCheckout.util";

import styles from "@/components/actions/actionDialogs.module.css";

export const coinPurchaseReturnPathStorageKey = "zudomart.coins.returnPath";

export function CoinPurchaseDialog({ isOpen, onClose, coinsNeeded }: { readonly isOpen: boolean; readonly onClose: () => void; readonly coinsNeeded?: number }) {
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const packagesQuery = useQuery({ queryKey: ["coins", "packages", "web"], queryFn: coinsService.fetchWebCoinPackages, enabled: isOpen, retry: false });
  const purchaseMutation = useMutation({
    mutationFn: (packageId: string) => coinsService.startCoinPurchase(packageId),
    onSuccess: async (checkout) => {
      try {
        window.sessionStorage.setItem(coinPurchaseReturnPathStorageKey, `${window.location.pathname}${window.location.search}`);
      } catch {
        return openPaystackCheckout(checkout);
      }
      const outcome = await openPaystackCheckout(checkout);
      if (outcome === "completed") window.location.assign(`/coins/return?reference=${encodeURIComponent(checkout.reference)}`);
    },
  });

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Get coins"
      description={coinsNeeded ? `You need ${coinsNeeded} more coins for this gift.` : "Coins pay for live gifts. Pay by card, bank transfer or USSD in a secure window."}
      tone="brand"
      icon={<CoinIcon size={24} />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Not now
          </Button>
          <Button onClick={() => selectedPackageId && purchaseMutation.mutate(selectedPackageId)} disabled={!selectedPackageId} busy={purchaseMutation.isPending}>
            Continue to checkout
          </Button>
        </>
      }
    >
      {packagesQuery.isLoading ? (
        <div className={styles.optionList}>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} height={52} />
          ))}
        </div>
      ) : (
        <fieldset className={styles.optionList}>
          <legend className="visuallyHidden">Coin packs</legend>
          {packagesQuery.data?.map((coinPackage) => (
            <label key={coinPackage.id} className={styles.option}>
              <input type="radio" name="coin-pack" checked={selectedPackageId === coinPackage.id} onChange={() => setSelectedPackageId(coinPackage.id)} />
              <CoinIcon size={20} />
              <span className={styles.optionText}>
                <span className={styles.optionTitle}>{(coinPackage.coins + (coinPackage.bonusCoins ?? 0)).toLocaleString()} coins</span>
                {coinPackage.bonusCoins ? <span className={styles.optionMeta}>Includes {coinPackage.bonusCoins} bonus</span> : null}
              </span>
              <strong>{formatMoneyForDisplay(coinPackage.price)}</strong>
            </label>
          ))}
        </fieldset>
      )}
      <p className={styles.muted}>Coins are digital items. They can't be withdrawn or exchanged for cash.</p>
      {purchaseMutation.isError ? (
        <p className={styles.error} role="alert">
          {readErrorMessageForDisplay(purchaseMutation.error)}
        </p>
      ) : null}
    </ModalDialog>
  );
}
