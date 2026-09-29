import { randomUUID } from "node:crypto";

import { providerSupportsCurrency } from "../../../configs/currency.config.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { PaymentProvider } from "../../../enums/paymentStatus.enum.js";
import { invalidState, notFound, unprocessable } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import type { ProfileType, VerificationTier } from "../../../interfaces/verificationBadge.interface.js";
import type { FieldCipher } from "../../../utils/crypto.util.js";
import type { PaymentGateway } from "../../payments/gateways/paymentGateway.interface.js";
import type { PaymentReturnUrls } from "../../payments/services/paymentReturnUrl.service.js";
import type { PaymentWebhookDelivery } from "../../payments/services/paymentWebhookRegistry.service.js";
import { STORE_PROFILE_VIEWERS, type ProfileResolver } from "../../verifications/services/profileResolver.service.js";
import { findColorForProfileType } from "../../verifications/policies/verification.policy.js";
import { LedgerAccounts, type LedgerService } from "../../wallets/services/ledger.service.js";
import { SUBSCRIPTION_REFERENCE_PREFIX, type BillingInterval, type SubscriptionChargeRecord, type SubscriptionRecord } from "../models/subscriptions.model.js";
import { isPlanValidForProfileType } from "../policies/subscription.policy.js";
import type { SubscriptionChargesRepository } from "../repositories/subscriptions.repository.js";
import type { SubscriptionLifecycleService } from "./subscriptionLifecycle.service.js";
import { choosePlanPrice, type SubscriptionPlansService } from "./subscriptionPlans.service.js";

export interface SubscriptionBillingDependencies {
  readonly lifecycle: SubscriptionLifecycleService;
  readonly plans: SubscriptionPlansService;
  readonly charges: SubscriptionChargesRepository;
  readonly profiles: ProfileResolver;
  readonly gateways: Readonly<Record<string, PaymentGateway>>;
  readonly ledger: LedgerService;
  readonly userDirectory: UserDirectory;
  readonly returnUrls: PaymentReturnUrls;
  readonly cipher: FieldCipher;
  readonly audit: AuditRecorder;
}

export interface SubscriptionCheckoutRequest {
  readonly profileType: ProfileType;
  readonly storeId?: string | undefined;
  readonly plan: VerificationTier;
  readonly interval: BillingInterval;
  readonly provider: PaymentProvider;
  readonly trial: boolean;
  readonly returnTo?: string | undefined;
  readonly preferredCurrency: CurrencyCode;
}

export interface SubscriptionCheckout {
  readonly subscription: SubscriptionRecord | null;
  readonly authorizationUrl: string | null;
  readonly reference: string | null;
  readonly callbackUrl: string | null;
  readonly charge: SubscriptionChargeRecord | null;
}

const PAYABLE_STATUSES: readonly string[] = ["TRIALING", "PAST_DUE", "CANCELLED", "EXPIRED"];

export class SubscriptionBillingService {
  public constructor(public readonly dependencies: SubscriptionBillingDependencies) {}

  public async checkout(principal: Principal, request: SubscriptionCheckoutRequest): Promise<SubscriptionCheckout> {
    const { profiles, plans, lifecycle, charges, returnUrls, userDirectory } = this.dependencies;
    if (request.profileType === "GOVERNMENT") throw unprocessable("government profiles cannot hold paid subscriptions");
    if (!isPlanValidForProfileType(request.profileType, request.plan)) throw unprocessable("plan is not valid for this profile type");
    const profile = await profiles.resolveProfileForPrincipal(principal, request.profileType, request.storeId);
    const plan = await plans.findPurchasablePlanOrThrow(findColorForProfileType(request.profileType), request.plan);
    const existing = await lifecycle.subscriptions.findByProfileId(profile.profileId);
    if (existing !== undefined && !PAYABLE_STATUSES.includes(existing.status)) throw invalidState("profile already has an active subscription");
    if (request.trial) {
      if (plan.trialDays <= 0 || existing?.trialUsed === true || existing?.status === "TRIALING" || existing?.status === "PAST_DUE") throw invalidState("A free trial is not available for this profile.");
      const subscription = await lifecycle.startTrial(profile, plan.tier, request.interval, plan.trialDays, principal.userId);
      return { subscription, authorizationUrl: null, reference: null, callbackUrl: null, charge: null };
    }
    const price = choosePlanPrice(plan, request.interval, await this.choosePreferredCurrency(profile.profileKind === "store" ? profile.profileId : undefined, request.preferredCurrency));
    if (price === undefined) throw unprocessable("This plan has no price for that billing interval.");
    if (!providerSupportsCurrency(request.provider, price.currency)) throw unprocessable(`${request.provider} cannot charge in ${price.currency}. Choose another payment provider.`);
    const reference = `${SUBSCRIPTION_REFERENCE_PREFIX}${randomUUID().replaceAll("-", "")}`;
    const callbackUrl = returnUrls.buildReturnUrlForReference(reference, request.returnTo);
    const charge = await charges.create({
      ...profile, payerUserId: principal.userId, plan: plan.tier, interval: request.interval, kind: "initial", reference, provider: request.provider, amount: price.amount, currency: price.currency,
    });
    const contact = await userDirectory.findUserContact(principal.userId);
    const initialized = await this.findGatewayOrThrow(request.provider).initializePayment({
      reference, amount: price.amount, currency: price.currency, callbackUrl,
      email: contact?.email ?? `user-${principal.userId}@customers.zudomart.app`,
      metadata: { purpose: "subscription", profileId: profile.profileId, plan: plan.tier },
    });
    return { subscription: existing ?? null, authorizationUrl: initialized.authorizationUrl, reference, callbackUrl, charge };
  }

  public async choosePreferredCurrency(storeId: string | undefined, viewerCurrency: CurrencyCode): Promise<CurrencyCode> {
    if (storeId === undefined) return viewerCurrency;
    return (await this.dependencies.profiles.storeAccess.findStoreSummaries([storeId]))[0]?.currency ?? viewerCurrency;
  }

  public async findSubscriptionForPrincipal(principal: Principal, profileType: ProfileType, storeId: string | undefined): Promise<SubscriptionRecord> {
    const profile = profileType === "PERSONAL"
      ? await this.dependencies.profiles.resolveProfileForPrincipal(principal, "PERSONAL", undefined)
      : await this.dependencies.profiles.resolveStoreProfile(principal, storeId, STORE_PROFILE_VIEWERS);
    return this.dependencies.lifecycle.findOrThrow(profile.profileId);
  }

  public async changeOwnSubscription(principal: Principal, profileId: string, change: "cancel" | "resume"): Promise<SubscriptionRecord> {
    const profile = await this.dependencies.profiles.resolveOwnedProfileById(principal, profileId);
    const { lifecycle } = this.dependencies;
    return change === "cancel" ? lifecycle.cancel(profile.profileId, principal.userId) : lifecycle.resumeCancelled(profile.profileId, principal.userId);
  }

  public async verifyChargeForPayer(principal: Principal, reference: string): Promise<SubscriptionRecord> {
    const charge = await this.dependencies.charges.findByReference(reference);
    if (charge === undefined || charge.payerUserId !== principal.userId) throw notFound("Subscription payment");
    await this.confirmChargeWithProvider(charge);
    return this.dependencies.lifecycle.findOrThrow(charge.profileId);
  }

  public async handleSubscriptionWebhook(delivery: PaymentWebhookDelivery): Promise<void> {
    if (delivery.notice.reference === null) return;
    const charge = await this.dependencies.charges.findByReference(delivery.notice.reference);
    if (charge !== undefined && charge.provider === delivery.provider) await this.confirmChargeWithProvider(charge);
  }

  public async confirmChargeWithProvider(charge: SubscriptionChargeRecord): Promise<void> {
    const { charges, ledger, lifecycle, audit, cipher } = this.dependencies;
    if (charge.status !== "pending") return;
    const verified = await this.findGatewayOrThrow(charge.provider).verifyPayment(charge.reference);
    if (verified.status === "pending") return;
    if (verified.status === "failed") {
      if (await charges.changeStatus(charge.id, "pending", "failed", { providerTransactionId: verified.providerTransactionId })) await this.markRenewalFailure(charge);
      return;
    }
    if (verified.amount !== charge.amount || verified.currency.toUpperCase() !== charge.currency) {
      await audit.record({ actorId: null, action: "subscriptions.amount_mismatch", entityType: "subscription_charge", entityId: charge.id, metadata: { expected: charge.amount, received: verified.amount } });
      throw unprocessable("The amount paid does not match this subscription.");
    }
    await ledger.postLedgerTransaction({
      reference: `subscription-charge:${charge.id}`,
      kind: "subscription_charge",
      description: `${charge.plan} subscription (${charge.interval.toLowerCase()})`,
      lines: [
        { account: LedgerAccounts.providerClearing(charge.provider, charge.currency), direction: "debit", amount: charge.amount, currency: charge.currency },
        { account: LedgerAccounts.platformSubscriptionRevenue(charge.currency), direction: "credit", amount: charge.amount, currency: charge.currency },
      ],
    });
    if (!(await charges.changeStatus(charge.id, "pending", "succeeded", { providerTransactionId: verified.providerTransactionId, paidAt: lifecycle.clock.now() }))) return;
    if (charge.kind === "renewal") {
      await lifecycle.renewPeriod(charge.profileId);
      return;
    }
    const contact = await this.dependencies.userDirectory.findUserContact(charge.payerUserId);
    const authorization = verified.reusableAuthorization ?? null;
    const profile = { profileId: charge.profileId, profileKind: charge.profileKind, profileType: charge.profileType, ownerUserId: charge.ownerUserId };
    await lifecycle.activatePaidPeriod(profile, {
      plan: charge.plan, interval: charge.interval, provider: charge.provider, currency: charge.currency, amount: charge.amount,
      authorizationEncrypted: authorization === null ? null : await cipher.encryptText(authorization),
      payerEmail: contact?.email ?? null,
    }, charge.payerUserId);
  }

  private async markRenewalFailure(charge: SubscriptionChargeRecord): Promise<void> {
    if (charge.kind !== "renewal") return;
    const subscription = await this.dependencies.lifecycle.subscriptions.findByProfileId(charge.profileId);
    if (subscription?.status === "ACTIVE" || subscription?.status === "TRIALING") await this.dependencies.lifecycle.markPastDue(charge.profileId, null);
  }

  public findGatewayOrThrow(provider: string): PaymentGateway {
    const gateway = Object.hasOwn(this.dependencies.gateways, provider) ? this.dependencies.gateways[provider] : undefined;
    if (gateway === undefined) throw unprocessable("This payment provider is not supported.");
    return gateway;
  }
}
