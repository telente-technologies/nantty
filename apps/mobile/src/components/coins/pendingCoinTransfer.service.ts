import * as Crypto from "expo-crypto";

import { secureStorage } from "@/utils/secureStorage.util";

const pendingTransferStoragePrefix = "nantty.pendingCoinTransfer.v1";

export interface PendingCoinTransfer {
  readonly accountId: string;
  readonly idempotencyKey: string;
  readonly recipientUserId: string;
  readonly coins: number;
  readonly feeBasisPoints: number;
  readonly feeCoins: number;
  readonly netCoins: number;
}

const storageKeyFor = async (accountId: string) => {
  const accountHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, accountId);
  return `${pendingTransferStoragePrefix}.${accountHash}`;
};

const isPendingCoinTransfer = (value: unknown, accountId: string): value is PendingCoinTransfer => {
  if (typeof value !== "object" || value === null) return false;
  const attempt = value as Partial<PendingCoinTransfer>;
  return attempt.accountId === accountId && typeof attempt.idempotencyKey === "string" && attempt.idempotencyKey.length >= 8 &&
    typeof attempt.recipientUserId === "string" && attempt.recipientUserId.length > 0 &&
    Number.isSafeInteger(attempt.coins) && Number(attempt.coins) > 0 &&
    Number.isSafeInteger(attempt.feeBasisPoints) && Number(attempt.feeBasisPoints) >= 0 && Number(attempt.feeBasisPoints) <= 10_000 &&
    Number.isSafeInteger(attempt.feeCoins) && Number(attempt.feeCoins) >= 0 &&
    Number.isSafeInteger(attempt.netCoins) && Number(attempt.netCoins) > 0 && Number(attempt.feeCoins) + Number(attempt.netCoins) === Number(attempt.coins);
};

export async function readPendingCoinTransfer(accountId: string): Promise<PendingCoinTransfer | null> {
  const value = await secureStorage.get(await storageKeyFor(accountId));
  if (value === null) return null;
  const parsed: unknown = JSON.parse(value);
  if (!isPendingCoinTransfer(parsed, accountId)) throw new Error("The saved coin transfer is invalid; refusing to create a replacement request.");
  return parsed;
}

export async function savePendingCoinTransfer(attempt: PendingCoinTransfer): Promise<void> {
  if (!isPendingCoinTransfer(attempt, attempt.accountId)) throw new Error("The coin transfer intent is invalid.");
  await secureStorage.set(await storageKeyFor(attempt.accountId), JSON.stringify(attempt));
}

export async function clearPendingCoinTransfer(accountId: string): Promise<void> {
  await secureStorage.remove(await storageKeyFor(accountId));
}
