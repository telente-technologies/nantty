import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";

import { isCountryRequiredError } from "@/components/checkout/countryRequiredPicker";
import { ApiError, generateIdempotencyKey } from "@/services/core/apiClient.service";
import { coinsService } from "@/services/money/coins.service";
import { CoinStorePurchaseCancelledError, fetchCoinStorePrices, purchaseCoinStoreProduct, restorePendingCoinStorePurchases } from "@/services/money/coinStorePurchase.service";
import { resolveStoreBillingAvailability } from "@/services/money/nativeStoreBilling.service";
import { useAuthStore } from "@/store/auth.store";
import type { CoinPackage, VerifiedCoinPurchase } from "@/types";

export const COIN_PAYMENT_RETURN_URL = "nantty://payments/return";
export const COIN_BALANCE_QUERY_KEY = ["coin-balance"] as const;
const MAXIMUM_VERIFY_ATTEMPTS = 6;
const VERIFY_RETRY_DELAY_MS = 1_500;

export const formatCoinAmount = (coins: number) => `${coins.toLocaleString("en-US")} coins`;

export const describeCoinError = (error: unknown) => {
  if (error instanceof ApiError && error.status === 402) return "You don't have enough coins. Buy more coins and try again.";
  if (error instanceof ApiError) return error.message;
  return "We couldn't reach Nantty. Check your data or Wi-Fi and try again.";
};

export const isNotEnoughCoinsError = (error: unknown) => error instanceof ApiError && error.status === 402;

export function useCoinBalance(enabled = true) {
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  return useQuery({ queryKey: COIN_BALANCE_QUERY_KEY, queryFn: coinsService.fetchCoinBalance, enabled: enabled && isSignedIn, staleTime: 30_000 });
}

const waitForMilliseconds = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function verifyCoinPurchaseUntilSettled(reference: string): Promise<VerifiedCoinPurchase> {
  let latest: VerifiedCoinPurchase = { status: "pending", coins: 0 };
  for (let attempt = 0; attempt < MAXIMUM_VERIFY_ATTEMPTS; attempt++) {
    latest = await coinsService.verifyCoinPurchase(reference);
    if (latest.status !== "pending") return latest;
    await waitForMilliseconds(VERIFY_RETRY_DELAY_MS * (attempt + 1));
  }
  return latest;
}

export type CoinPurchaseOutcome =
  | { readonly kind: "credited"; readonly coins: number }
  | { readonly kind: "pending" }
  | { readonly kind: "cancelled" }
  | { readonly kind: "failed" }
  | { readonly kind: "availableOnWebsiteOnly" };

export function useBuyCoinsWithInAppBrowser() {
  const queryClient = useQueryClient();
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const pendingPurchaseIdempotencyKey = useRef<string | null>(null);
  const [lastOutcome, setLastOutcome] = useState<CoinPurchaseOutcome | null>(null);
  const [countryNeededFor, setCountryNeededFor] = useState<CoinPackage | null>(null);
  const storeBilling = useMemo(() => resolveStoreBillingAvailability(), []);
  const coinPackages = useQuery({ queryKey: ["coin-packages"], queryFn: coinsService.fetchCoinPackages, staleTime: 10 * 60_000 });
  const storeProducts = useQuery({
    queryKey: ["coin-store-prices", storeBilling.kind, coinPackages.data?.map((item) => item.storeProductId).join("|")],
    enabled: storeBilling.kind === "ready" && Boolean(coinPackages.data?.some((item) => item.purchaseChannel === "store_iap" && item.storeProductId)),
    queryFn: () => storeBilling.kind === "ready"
      ? fetchCoinStorePrices(storeBilling.billing, (coinPackages.data ?? []).filter((item) => item.purchaseChannel === "store_iap"))
      : Promise.resolve({} as Readonly<Record<string, string>>),
    staleTime: 10 * 60_000,
  });
  const pendingStorePurchaseRecovery = useQuery({
    queryKey: ["coin-store-purchase-recovery", accountId, storeBilling.kind, coinPackages.data?.map((item) => item.storeProductId).join("|")],
    enabled: storeBilling.kind === "ready" && isSignedIn && Boolean(accountId) && coinPackages.isSuccess,
    queryFn: () => storeBilling.kind === "ready"
      ? restorePendingCoinStorePurchases(storeBilling.billing, storeBilling.platform, (coinPackages.data ?? []).filter((item) => item.purchaseChannel === "store_iap"), coinsService)
      : Promise.resolve(0),
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if ((pendingStorePurchaseRecovery.data ?? 0) > 0) queryClient.invalidateQueries({ queryKey: COIN_BALANCE_QUERY_KEY });
  }, [pendingStorePurchaseRecovery.data, queryClient]);

  const buyCoinPackage = useMutation({
    mutationFn: async (coinPackage: CoinPackage): Promise<CoinPurchaseOutcome> => {
      if (coinPackage.purchaseChannel === "store_iap") {
        if (storeBilling.kind !== "ready" || !coinPackage.storeProductId || !storeProducts.data?.[coinPackage.storeProductId]) return { kind: "availableOnWebsiteOnly" };
        let verified: Awaited<ReturnType<typeof purchaseCoinStoreProduct>>;
        try {
          verified = await purchaseCoinStoreProduct(storeBilling.billing, storeBilling.platform, coinPackage.storeProductId, coinsService);
        } catch (error) {
          if (error instanceof CoinStorePurchaseCancelledError) return { kind: "cancelled" };
          throw error;
        }
        return verified.status === "succeeded" ? { kind: "credited", coins: verified.coins } : verified.status === "pending" ? { kind: "pending" } : { kind: "failed" };
      }
      pendingPurchaseIdempotencyKey.current ??= generateIdempotencyKey();
      const purchase = await coinsService.startCoinPurchase(coinPackage.id, pendingPurchaseIdempotencyKey.current);
      pendingPurchaseIdempotencyKey.current = null;
      if (purchase.purchaseChannel === "store_iap" || !purchase.authorizationUrl) return { kind: "availableOnWebsiteOnly" };
      if (!/^https:\/\//.test(purchase.authorizationUrl)) return { kind: "failed" };
      await WebBrowser.openAuthSessionAsync(purchase.authorizationUrl, COIN_PAYMENT_RETURN_URL).catch(() => undefined);
      const verified = await verifyCoinPurchaseUntilSettled(purchase.reference);
      if (verified.status === "succeeded") return { kind: "credited", coins: verified.coins };
      return verified.status === "pending" ? { kind: "pending" } : { kind: "failed" };
    },
    onMutate: () => {
      setLastOutcome(null);
      setCountryNeededFor(null);
    },
    onError: (error, coinPackage) => {
      if (!isCountryRequiredError(error)) return;
      pendingPurchaseIdempotencyKey.current = null;
      setCountryNeededFor(coinPackage);
    },
    onSuccess: (outcome) => {
      setLastOutcome(outcome);
      queryClient.invalidateQueries({ queryKey: COIN_BALANCE_QUERY_KEY });
    },
  });

  return { coinPackages, storeProducts, storeBillingAvailability: storeBilling.kind, buyCoinPackage, lastOutcome, countryNeededFor, clearCountryNeeded: () => setCountryNeededFor(null) };
}
