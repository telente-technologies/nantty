import { randomUUID } from "node:crypto";

import type { AdPaymentMethodChanges, AdPaymentMethodRecord, AdTopUpRecord, AdTopUpStatus, FundingMode, NewAdPaymentMethodInput, NewAdTopUpInput } from "../models/adBilling.model.js";

export interface AdBillingSettingsRepository {
  findFundingMode(accountId: string): Promise<FundingMode>;
  saveFundingMode(accountId: string, fundingMode: FundingMode): Promise<void>;
  createTopUp(input: NewAdTopUpInput): Promise<AdTopUpRecord>;
  findTopUpByReference(reference: string): Promise<AdTopUpRecord | undefined>;
  completeTopUp(topUpId: string, status: AdTopUpStatus, completedAt: Date | null, failureReason: string | null): Promise<boolean>;
  createPaymentMethod(input: NewAdPaymentMethodInput): Promise<AdPaymentMethodRecord>;
  listPaymentMethods(accountId: string): Promise<readonly AdPaymentMethodRecord[]>;
  updatePaymentMethod(paymentMethodId: string, changes: AdPaymentMethodChanges): Promise<void>;
  deletePaymentMethod(paymentMethodId: string): Promise<void>;
}

export class InMemoryAdBillingSettingsRepository implements AdBillingSettingsRepository {
  private readonly fundingModes = new Map<string, FundingMode>();
  private readonly topUps = new Map<string, AdTopUpRecord>();
  private readonly paymentMethods = new Map<string, AdPaymentMethodRecord>();

  public async findFundingMode(accountId: string): Promise<FundingMode> {
    return this.fundingModes.get(accountId) ?? "prepaid";
  }

  public async saveFundingMode(accountId: string, fundingMode: FundingMode): Promise<void> {
    this.fundingModes.set(accountId, fundingMode);
  }

  public async createTopUp(input: NewAdTopUpInput): Promise<AdTopUpRecord> {
    const topUp: AdTopUpRecord = { ...input, id: randomUUID(), status: "pending", failureReason: null, completedAt: null };
    this.topUps.set(topUp.id, topUp);
    return topUp;
  }

  public async findTopUpByReference(reference: string): Promise<AdTopUpRecord | undefined> {
    return [...this.topUps.values()].find((topUp) => topUp.reference === reference);
  }

  public async completeTopUp(topUpId: string, status: AdTopUpStatus, completedAt: Date | null, failureReason: string | null): Promise<boolean> {
    const topUp = this.topUps.get(topUpId);
    if (topUp === undefined || topUp.status !== "pending") return false;
    this.topUps.set(topUpId, { ...topUp, status, completedAt, failureReason });
    return true;
  }

  public async createPaymentMethod(input: NewAdPaymentMethodInput): Promise<AdPaymentMethodRecord> {
    const method: AdPaymentMethodRecord = { ...input, id: randomUUID(), status: "pending", brand: "Card", last4: "0000", expMonth: 12, expYear: input.createdAt.getUTCFullYear() + 3, isDefault: false, authorizationCiphertext: null };
    this.paymentMethods.set(method.id, method);
    return method;
  }

  public async listPaymentMethods(accountId: string): Promise<readonly AdPaymentMethodRecord[]> {
    return [...this.paymentMethods.values()].filter((method) => method.accountId === accountId).sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  public async updatePaymentMethod(paymentMethodId: string, changes: AdPaymentMethodChanges): Promise<void> {
    const method = this.paymentMethods.get(paymentMethodId);
    if (method !== undefined) this.paymentMethods.set(paymentMethodId, { ...method, ...changes });
  }

  public async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    this.paymentMethods.delete(paymentMethodId);
  }
}
