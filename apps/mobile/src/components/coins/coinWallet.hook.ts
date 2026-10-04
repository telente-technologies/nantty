import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";

import { ApiError, generateIdempotencyKey } from "@/services/apiClient.service";
import { coinsService } from "@/services/coins.service";
import { finishStoreTransaction, isStoreBillingAvailable, purchaseStoreProduct, readStorePlatformName } from "@/services/storeBilling.service";
import { useAuthStore } from "@/store/auth.store";
import type { CoinPackage, VerifiedCoinPurchase } from "@/types";

export const COIN_PAYMENT_RETURN_URL = "zudomart://payments/return";
export const COIN_BALANCE_QUERY_KEY = ["coin-balance"] as const;
const MAXIMUM_VERIFY_ATTEMPTS = 6;
const VERIFY_RETRY_DELAY_MS = 1_500;

export const formatCoinAmount = (coins: number) => `${coins.toLocaleString("en-US")} coins`;

export const describeCoinError = (error: unknown) => {
  if (error instanceof ApiError && error.status === 402) return "You don't have enough coins. Buy more coins and try again.";
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Check your connection and try again.";
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
  | { readonly kind: "failed" }
  | { readonly kind: "availableOnWebsiteOnly" };

async function buyCoinPackageThroughStore(coinPackage: CoinPackage): Promise<CoinPurchaseOutcome> {
  const platform = readStorePlatformName();
  if (!platform || !coinPackage.storeProductId || !isStoreBillingAvailable()) return { kind: "availableOnWebsiteOnly" };
  const purchase = await purchaseStoreProduct(coinPackage.storeProductId);
  if (!purchase) return { kind: "failed" };
  const verified = await coinsService.redeemStoreReceipt({ platform, productId: purchase.productId, receipt: purchase.receipt, transactionId: purchase.transactionId });
  if (verified.status === "succeeded") await finishStoreTransaction(purchase.transactionId);
  if (verified.status === "succeeded") return { kind: "credited", coins: verified.coins };
  return verified.status === "pending" ? { kind: "pending" } : { kind: "failed" };
}

export function useBuyCoinsWithInAppBrowser() {
  const queryClient = useQueryClient();
  const pendingPurchaseIdempotencyKey = useRef<string | null>(null);
  const [lastOutcome, setLastOutcome] = useState<CoinPurchaseOutcome | null>(null);
  const coinPackages = useQuery({ queryKey: ["coin-packages"], queryFn: coinsService.fetchCoinPackages, staleTime: 10 * 60_000 });

  const buyCoinPackage = useMutation({
    mutationFn: async (coinPackage: CoinPackage): Promise<CoinPurchaseOutcome> => {
      if (coinPackage.purchaseChannel === "store_iap") return buyCoinPackageThroughStore(coinPackage);
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
    onMutate: () => setLastOutcome(null),
    onSuccess: (outcome) => {
      setLastOutcome(outcome);
      queryClient.invalidateQueries({ queryKey: COIN_BALANCE_QUERY_KEY });
    },
  });

  return { coinPackages, buyCoinPackage, lastOutcome };
}
