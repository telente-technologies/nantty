import { NotImplementedError } from "@zudojs/errors";

import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";
import type { InAppPurchaseStore } from "../models/coins.model.js";

export interface StoreReceiptSubmission {
  readonly userId: string;
  readonly productId: string;
  readonly receipt: string;
  readonly transactionId: string | undefined;
}

export interface VerifiedStoreReceipt {
  readonly valid: boolean;
  readonly transactionId: string;
  readonly productId: string;
  readonly priceAmount: MinorUnits | null;
  readonly priceCurrency: CurrencyCode | null;
  readonly failureReason: string | null;
}

export interface StoreReceiptVerifier {
  readonly store: InAppPurchaseStore;
  verifyPurchaseReceipt(submission: StoreReceiptSubmission): Promise<VerifiedStoreReceipt>;
}

export type AppStoreServerApiVerifier = StoreReceiptVerifier & { readonly store: "apple" };
export type GooglePlayDeveloperApiVerifier = StoreReceiptVerifier & { readonly store: "google" };

export class NotConfiguredStoreReceiptVerifier implements StoreReceiptVerifier {
  public constructor(public readonly store: InAppPurchaseStore) {}

  public async verifyPurchaseReceipt(): Promise<VerifiedStoreReceipt> {
    const api = this.store === "apple" ? "App Store Server API" : "Google Play Developer API";
    throw new NotImplementedError(`In-app coin purchases are not configured yet (${api} credentials are missing).`, { expose: true, code: "IAP_NOT_CONFIGURED" });
  }
}
