import { randomUUID } from "node:crypto";

import type { CoinPurchaseRecord, CoinPurchaseStatus, CoinPurchaseStatusChange, NewCoinPurchase } from "../models/coins.model.js";

export interface CoinPurchasesRepository {
  create(input: NewCoinPurchase): Promise<CoinPurchaseRecord>;
  saveAuthorizationUrl(purchaseId: string, authorizationUrl: string): Promise<void>;
  findByReference(reference: string): Promise<CoinPurchaseRecord | undefined>;
  changeStatus(purchaseId: string, from: CoinPurchaseStatus, to: CoinPurchaseStatus, change: CoinPurchaseStatusChange): Promise<boolean>;
}

export class InMemoryCoinPurchasesRepository implements CoinPurchasesRepository {
  private readonly purchases = new Map<string, CoinPurchaseRecord>();

  public async create(input: NewCoinPurchase): Promise<CoinPurchaseRecord> {
    if ([...this.purchases.values()].some((purchase) => purchase.reference === input.reference)) throw new Error("Duplicate coin purchase reference.");
    const purchase: CoinPurchaseRecord = { ...input, id: randomUUID(), status: "pending", authorizationUrl: null, providerTransactionId: null, creditedAt: null, createdAt: new Date() };
    this.purchases.set(purchase.id, purchase);
    return purchase;
  }

  public async saveAuthorizationUrl(purchaseId: string, authorizationUrl: string): Promise<void> {
    const purchase = this.purchases.get(purchaseId);
    if (purchase !== undefined) this.purchases.set(purchaseId, { ...purchase, authorizationUrl });
  }

  public async findByReference(reference: string): Promise<CoinPurchaseRecord | undefined> {
    return [...this.purchases.values()].find((purchase) => purchase.reference === reference);
  }

  public async changeStatus(purchaseId: string, from: CoinPurchaseStatus, to: CoinPurchaseStatus, change: CoinPurchaseStatusChange): Promise<boolean> {
    const purchase = this.purchases.get(purchaseId);
    if (purchase?.status !== from) return false;
    this.purchases.set(purchaseId, { ...purchase, ...change, status: to });
    return true;
  }
}
