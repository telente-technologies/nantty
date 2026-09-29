import { randomUUID } from "node:crypto";

import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { adsError, adsNotFound } from "../../../errors/ads.error.js";
import type { PaymentGateway } from "../../payments/gateways/paymentGateway.interface.js";
import type { AdAccountRecord } from "../models/adAccounts.model.js";
import { CARD_VERIFICATION_AMOUNT_BY_CURRENCY, type AdPaymentMethodRecord, type AdPaymentProvider } from "../models/adBilling.model.js";
import type { AdsDependencies } from "../models/adsDependencies.model.js";
import type { AdsToolsRepositories } from "../models/adsToolsDependencies.model.js";
import type { AdAccountAccess } from "./adAccountAccess.service.js";

const DEFAULT_ADS_MANAGER_URL = "https://ads.zudomart.com";
const FALLBACK_VERIFICATION_AMOUNT_MINOR = 100;

export class AdPaymentMethodsService {
  public constructor(
    private readonly dependencies: AdsDependencies,
    private readonly repositories: AdsToolsRepositories,
    private readonly access: AdAccountAccess,
    private readonly gateways: Readonly<Record<string, PaymentGateway>> | undefined,
    private readonly adsManagerBaseUrl: string | undefined,
  ) {}

  public async listActivePaymentMethods(account: AdAccountRecord) {
    const methods = await this.repositories.billingSettings.listPaymentMethods(account.id);
    for (const method of methods.filter((candidate) => candidate.status === "pending")) await this.confirmPendingCard(account, method);
    const active = (await this.repositories.billingSettings.listPaymentMethods(account.id)).filter((method) => method.status === "active");
    const hasDefault = active.some((method) => method.isDefault);
    return active.map((method, index) => ({
      id: method.id,
      brand: method.brand,
      last4: method.last4,
      expMonth: method.expMonth,
      expYear: method.expYear,
      isDefault: method.isDefault || (!hasDefault && index === 0),
      provider: method.provider,
    }));
  }

  public async startCardAuthorization(userId: string, accountId: string, provider: AdPaymentProvider, returnPath: string) {
    const { account } = await this.access.requirePermission(userId, accountId, "billing:manage");
    const gateway = this.gateways?.[provider];
    if (gateway === undefined) throw adsError(503, "UPSTREAM_UNAVAILABLE", "Card payments are not available right now.");
    const reference = `zmcard_${randomUUID().replaceAll("-", "")}`;
    const safePath = returnPath.startsWith(`/accounts/${accountId}/`) && !returnPath.includes("//") ? returnPath : `/accounts/${accountId}/billing`;
    const contact = await this.dependencies.userDirectory.findUserContact(userId);
    const initialized = await gateway.initializePayment({
      reference,
      amount: CARD_VERIFICATION_AMOUNT_BY_CURRENCY[account.currency] ?? FALLBACK_VERIFICATION_AMOUNT_MINOR,
      currency: account.currency as CurrencyCode,
      email: contact?.email ?? `user-${userId}@customers.zudomart.app`,
      callbackUrl: `${this.adsManagerBaseUrl ?? DEFAULT_ADS_MANAGER_URL}${safePath}?cardReference=${reference}`,
      metadata: { purpose: "ad_card_authorization", accountId },
    });
    await this.repositories.billingSettings.createPaymentMethod({ accountId, requestedById: userId, provider, reference, createdAt: this.dependencies.clock.now() });
    return { topUpId: "", reference, provider, authorizationUrl: initialized.authorizationUrl };
  }

  public async makeDefault(userId: string, accountId: string, paymentMethodId: string): Promise<AdAccountRecord> {
    const { account } = await this.access.requirePermission(userId, accountId, "billing:manage");
    const methods = (await this.repositories.billingSettings.listPaymentMethods(accountId)).filter((method) => method.status === "active");
    if (!methods.some((method) => method.id === paymentMethodId)) throw adsNotFound("Card");
    for (const method of methods) await this.repositories.billingSettings.updatePaymentMethod(method.id, { isDefault: method.id === paymentMethodId });
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "billing", objectId: paymentMethodId, summary: "Changed the default card", changes: [] });
    return account;
  }

  public async removePaymentMethod(userId: string, accountId: string, paymentMethodId: string): Promise<void> {
    await this.access.requirePermission(userId, accountId, "billing:manage");
    const methods = (await this.repositories.billingSettings.listPaymentMethods(accountId)).filter((method) => method.status === "active");
    const target = methods.find((method) => method.id === paymentMethodId);
    if (target === undefined) throw adsNotFound("Card");
    const remaining = methods.filter((method) => method.id !== paymentMethodId);
    if (remaining.length === 0 && (await this.repositories.billingSettings.findFundingMode(accountId)) !== "prepaid") {
      throw adsError(409, "CARD_REQUIRED", "Switch to prepaid balance before removing your only card.");
    }
    await this.repositories.billingSettings.deletePaymentMethod(paymentMethodId);
    if (target.isDefault && remaining[0] !== undefined) await this.repositories.billingSettings.updatePaymentMethod(remaining[0].id, { isDefault: true });
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "billing", objectId: paymentMethodId, summary: "Removed a card", changes: [] });
  }

  private async confirmPendingCard(account: AdAccountRecord, method: AdPaymentMethodRecord): Promise<void> {
    const gateway = this.gateways?.[method.provider];
    if (gateway === undefined) return;
    try {
      const verified = await gateway.verifyPayment(method.reference);
      if (verified.status === "pending") return;
      if (verified.status === "failed" || verified.reusableAuthorization === null || verified.reusableAuthorization === undefined) {
        await this.repositories.billingSettings.updatePaymentMethod(method.id, { status: "failed" });
        return;
      }
      const hasActive = (await this.repositories.billingSettings.listPaymentMethods(account.id)).some((candidate) => candidate.status === "active");
      await this.repositories.billingSettings.updatePaymentMethod(method.id, {
        status: "active",
        isDefault: !hasActive,
        authorizationCiphertext: await this.dependencies.cipher.encryptText(verified.reusableAuthorization),
      });
      await gateway
        .refundPayment({ reference: method.reference, providerTransactionId: verified.providerTransactionId, amount: verified.amount, currency: account.currency as CurrencyCode })
        .catch((error: unknown) => this.dependencies.logger.warn("Could not refund the card verification charge", { reference: method.reference, error: String(error) }));
    } catch (error) {
      this.dependencies.logger.warn("Could not verify a card authorization", { reference: method.reference, error: String(error) });
    }
  }
}
