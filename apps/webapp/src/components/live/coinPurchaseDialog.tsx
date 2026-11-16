"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CountryRequiredPicker, isCountryRequiredError } from "@/components/commerce/countryRequiredPicker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { CoinIcon } from "@/components/ui/icons";
import { ModalDialog } from "@/components/ui/modalDialog";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { coinsService } from "@/services/webActions.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { openHostedCheckout } from "@/utils/hostedCheckout.util";
import { presentPaymentProblem, readPaymentProblemCode } from "@/utils/paymentProblem.util";

import styles from "@/components/actions/actionDialogs.module.css";

export const coinPurchaseReturnPathStorageKey = "nantty.coins.returnPath";

export function CoinPurchaseDialog({ isOpen, onClose, coinsNeeded }: { readonly isOpen: boolean; readonly onClose: () => void; readonly coinsNeeded?: number }) {
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const router = useRouter();
  const [countryNeeded, setCountryNeeded] = useState(false);
  const [blockedCheckout, setBlockedCheckout] = useState(false);
  const packagesQuery = useQuery({ queryKey: ["coins", "packages", "web"], queryFn: coinsService.fetchWebCoinPackages, enabled: isOpen, retry: false });
  const purchaseMutation = useMutation({
    mutationFn: (packageId: string) => coinsService.startCoinPurchase(packageId),
    onSuccess: (checkout) => {
      try {
        window.sessionStorage.setItem(coinPurchaseReturnPathStorageKey, `${window.location.pathname}${window.location.search}`);
      } catch {
        setBlockedCheckout(false);
      }
      if (openHostedCheckout(checkout) === "blocked") setBlockedCheckout(true);
    },
    onError: (error) => {
      setCountryNeeded(isCountryRequiredError(error));
      void presentPaymentProblem(error, (href) => router.push(href));
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
          <Button onClick={() => selectedPackageId && purchaseMutation.mutate(selectedPackageId)} disabled={!selectedPackageId || (purchaseMutation.isSuccess && !blockedCheckout)} busy={purchaseMutation.isPending}>
            Continue to checkout
          </Button>
        </>
      }
    >
      {countryNeeded ? (
        <CountryRequiredPicker
          onSaved={() => {
            setCountryNeeded(false);
            if (selectedPackageId) purchaseMutation.mutate(selectedPackageId);
          }}
        />
      ) : packagesQuery.isLoading ? (
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
                {coinPackage.billingNote ? <span className={styles.optionMeta}>{coinPackage.billingNote}</span> : null}
              </span>
              <strong>{formatMoneyForDisplay(coinPackage.price)}</strong>
            </label>
          ))}
        </fieldset>
      )}
      <p className={styles.muted}>Coins are digital items. They can't be withdrawn or exchanged for cash.</p>
      {blockedCheckout ? (
        <p className={styles.error} role="alert">
          We couldn&apos;t open the secure payment page. Try again in a moment.
        </p>
      ) : null}
      {purchaseMutation.isError && !countryNeeded && !readPaymentProblemCode(purchaseMutation.error) ? (
        <p className={styles.error} role="alert">
          {readErrorMessageForDisplay(purchaseMutation.error)}
        </p>
      ) : null}
    </ModalDialog>
  );
}
