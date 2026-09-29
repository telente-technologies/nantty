import { randomUUID } from "node:crypto";

import type { EventBus } from "@zudojs/events";

import { providerSupportsCurrency } from "../../../configs/currency.config.js";
import type { MonetizationSettings } from "../../../configs/monetization.config.js";
import type { PaymentProvider } from "../../../enums/paymentStatus.enum.js";
import { invalidState, notFound, unprocessable } from "../../../errors/domain.error.js";
import { NotificationRequestedEvent } from "../../../events/notificationRequested.event.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { CreatorAccess } from "../../../interfaces/creatorAccess.interface.js";
import type { SocialGraph } from "../../../interfaces/socialGraph.interface.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import type { FieldCipher } from "../../../utils/crypto.util.js";
import { Money } from "../../../utils/money.util.js";
import type { CreatorEarningsRepository } from "../../creators/repositories/creatorEarnings.repository.js";
import type { PaymentGateway } from "../../payments/gateways/paymentGateway.interface.js";
import type { PaymentReturnUrls } from "../../payments/services/paymentReturnUrl.service.js";
import type { PaymentWebhookDelivery } from "../../payments/services/paymentWebhookRegistry.service.js";
import { MonetizationLedgerAccounts } from "../../wallets/constants/monetizationLedgerAccounts.constant.js";
import { LedgerAccounts, type LedgerService } from "../../wallets/services/ledger.service.js";
import {
  addBillingInterval,
  CREATOR_SUBSCRIPTION_REFERENCE_PREFIX,
  hasSubscriberAccess,
  type CreatorSubscriptionChargeRecord,
  type CreatorSubscriptionRecord,
} from "../models/creatorSubscriptions.model.js";
import type { CreatorPlansRepository } from "../repositories/creatorPlans.repository.js";
import type { CreatorSubscriptionsRepository } from "../repositories/creatorSubscriptions.repository.js";

export interface CreatorSubscriptionsDependencies {
  readonly plans: CreatorPlansRepository;
  readonly subscriptions: CreatorSubscriptionsRepository;
  readonly earnings: CreatorEarningsRepository;
  readonly gateways: Readonly<Record<string, PaymentGateway>>;
  readonly returnUrls: PaymentReturnUrls;
  readonly userDirectory: UserDirectory;
  readonly socialGraph: SocialGraph;
  readonly creatorAccess: CreatorAccess;
  readonly ledger: LedgerService;
  readonly cipher: FieldCipher;
  readonly audit: AuditRecorder;
  readonly events: EventBus;
  readonly clock: Clock;
  readonly settings: MonetizationSettings;
  readonly gracePeriodDays: number;
}

export interface StartCreatorSubscriptionRequest {
  readonly subscriberId: string;
  readonly creatorId: string;
  readonly planId: string;
  readonly provider: PaymentProvider;
  readonly returnTo: string | undefined;
}

export interface CreatorSubscriptionCheckout {
  readonly subscription: CreatorSubscriptionRecord;
  readonly reference: string;
  readonly authorizationUrl: string;
  readonly callbackUrl: string;
}

export class CreatorSubscriptionBillingService {
  public constructor(public readonly dependencies: CreatorSubscriptionsDependencies) {}

  public async startSubscription(request: StartCreatorSubscriptionRequest): Promise<CreatorSubscriptionCheckout> {
    const { plans, subscriptions, socialGraph, creatorAccess, returnUrls, userDirectory, clock } = this.dependencies;
    if (request.subscriberId === request.creatorId) throw unprocessable("You cannot subscribe to yourself.");
    const plan = await plans.findById(request.planId);
    if (plan === undefined || plan.creatorId !== request.creatorId || !plan.active) throw notFound("Subscription plan");
    if (!(await creatorAccess.isApprovedCreator(request.creatorId))) throw unprocessable("This creator is not accepting subscriptions right now.");
    if (await socialGraph.isBlockedEitherWay(request.subscriberId, request.creatorId)) throw unprocessable("You cannot subscribe to this creator.");
    const existing = await subscriptions.listForSubscriberAndCreators(request.subscriberId, [request.creatorId]);
    if (existing.some((subscription) => hasSubscriberAccess(subscription, clock.now()) && subscription.status !== "cancelled")) throw invalidState("You are already subscribed to this creator.");
    if (!providerSupportsCurrency(request.provider, plan.currency)) throw unprocessable(`${request.provider} cannot charge in ${plan.currency}. Choose another payment provider.`);
    const subscription = await subscriptions.create({
      subscriberId: request.subscriberId, creatorId: request.creatorId, planId: plan.id, provider: request.provider, amount: plan.price, currency: plan.currency, interval: plan.interval, createdAt: clock.now(),
    });
    const reference = `${CREATOR_SUBSCRIPTION_REFERENCE_PREFIX}${randomUUID().replaceAll("-", "")}`;
    const callbackUrl = returnUrls.buildReturnUrlForReference(reference, request.returnTo);
    await subscriptions.createCharge({
      subscriptionId: subscription.id, subscriberId: request.subscriberId, creatorId: request.creatorId, kind: "initial", reference, provider: request.provider, amount: plan.price, currency: plan.currency, createdAt: clock.now(),
    });
    const contact = await userDirectory.findUserContact(request.subscriberId);
    const initialized = await this.findGatewayOrThrow(request.provider).initializePayment({
      reference, amount: plan.price, currency: plan.currency, callbackUrl,
      email: contact?.email ?? `user-${request.subscriberId}@customers.zudomart.app`,
      metadata: { purpose: "creator_subscription", subscriptionId: subscription.id, creatorId: request.creatorId },
    });
    return { subscription, reference, authorizationUrl: initialized.authorizationUrl, callbackUrl };
  }

  public async verifyChargeForSubscriber(subscriberId: string, reference: string): Promise<CreatorSubscriptionRecord> {
    const charge = await this.dependencies.subscriptions.findChargeByReference(reference);
    if (charge === undefined || charge.subscriberId !== subscriberId) throw notFound("Subscription payment");
    await this.confirmChargeWithProvider(charge);
    return (await this.dependencies.subscriptions.findById(charge.subscriptionId)) as CreatorSubscriptionRecord;
  }

  public async handleCreatorSubscriptionWebhook(delivery: PaymentWebhookDelivery): Promise<void> {
    if (delivery.notice.reference === null) return;
    const charge = await this.dependencies.subscriptions.findChargeByReference(delivery.notice.reference);
    if (charge !== undefined && charge.provider === delivery.provider) await this.confirmChargeWithProvider(charge);
  }

  public async confirmChargeWithProvider(charge: CreatorSubscriptionChargeRecord): Promise<void> {
    const { subscriptions, audit, clock } = this.dependencies;
    if (charge.status !== "pending") return;
    const verified = await this.findGatewayOrThrow(charge.provider).verifyPayment(charge.reference);
    if (verified.status === "pending") return;
    if (verified.status === "failed") {
      if (await subscriptions.changeChargeStatus(charge.id, "pending", "failed", { providerTransactionId: verified.providerTransactionId })) await this.markChargeFailure(charge);
      return;
    }
    if (verified.amount !== charge.amount || verified.currency.toUpperCase() !== charge.currency) {
      await audit.record({ actorId: null, action: "creator_subscriptions.amount_mismatch", entityType: "creator_subscription_charge", entityId: charge.id, metadata: { expected: charge.amount, received: verified.amount } });
      throw unprocessable("The amount paid does not match this subscription.");
    }
    await this.creditCreatorForCharge(charge);
    if (!(await subscriptions.changeChargeStatus(charge.id, "pending", "succeeded", { providerTransactionId: verified.providerTransactionId, paidAt: clock.now() }))) return;
    const authorization = verified.reusableAuthorization ?? null;
    await this.extendPaidPeriod(charge, authorization === null ? null : await this.dependencies.cipher.encryptText(authorization));
  }

  private async creditCreatorForCharge(charge: CreatorSubscriptionChargeRecord): Promise<void> {
    const { ledger, earnings, settings, clock } = this.dependencies;
    const amount = Money.of(charge.amount, charge.currency);
    const creatorShare = amount.calculateBasisPointsShareRoundingDown(settings.creators.subscriptionCreatorShareBps);
    const platformShare = amount.subtract(creatorShare);
    const reference = `creator-subscription-charge:${charge.id}`;
    await ledger.postLedgerTransaction({
      reference,
      kind: "creator_subscription_charge",
      description: `Creator subscription ${charge.kind} payment`,
      lines: [
        { account: LedgerAccounts.providerClearing(charge.provider, charge.currency), direction: "debit", amount: charge.amount, currency: charge.currency },
        ...(creatorShare.amountMinor > 0 ? [{ account: LedgerAccounts.userWallet(charge.creatorId, charge.currency), direction: "credit" as const, amount: creatorShare.amountMinor, currency: charge.currency }] : []),
        ...(platformShare.amountMinor > 0 ? [{ account: MonetizationLedgerAccounts.creatorSubscriptionRevenue(charge.currency), direction: "credit" as const, amount: platformShare.amountMinor, currency: charge.currency }] : []),
      ],
    });
    await earnings.recordEarningIfNew({
      creatorId: charge.creatorId, kind: "subscription", reference, sourceType: "subscription", sourceId: charge.subscriptionId,
      grossAmount: charge.amount, netAmount: creatorShare.amountMinor, currency: charge.currency, orderId: null, productId: null, createdAt: clock.now(),
    });
  }

  private async extendPaidPeriod(charge: CreatorSubscriptionChargeRecord, authorizationEncrypted: string | null): Promise<void> {
    const { subscriptions, userDirectory, audit, events, clock, settings } = this.dependencies;
    const subscription = await subscriptions.findById(charge.subscriptionId);
    if (subscription === undefined) return;
    const now = clock.now();
    const periodStart = charge.kind === "renewal" && subscription.currentPeriodEnd !== null ? subscription.currentPeriodEnd : now;
    const contact = charge.kind === "initial" ? await userDirectory.findUserContact(charge.subscriberId) : undefined;
    await subscriptions.update(subscription.id, ["pending", "active", "past_due", "failed"], {
      status: "active",
      currentPeriodStart: periodStart,
      currentPeriodEnd: addBillingInterval(periodStart, subscription.interval, settings.creators.subscriptionPeriodDays),
      ...(authorizationEncrypted === null ? {} : { authorizationEncrypted }),
      ...(contact === undefined ? {} : { payerEmail: contact.email }),
    });
    await audit.record({ actorId: charge.subscriberId, action: `creator_subscriptions.${charge.kind === "initial" ? "started" : "renewed"}`, entityType: "creator_subscription", entityId: subscription.id, metadata: { amount: charge.amount, currency: charge.currency } });
    if (charge.kind === "initial") {
      await publishEvent(events, NotificationRequestedEvent, {
        userId: charge.creatorId, category: "social", title: "New subscriber", body: "Someone just subscribed to you.", data: { type: "creator_subscription", subscriptionId: subscription.id },
      });
    }
  }

  private async markChargeFailure(charge: CreatorSubscriptionChargeRecord): Promise<void> {
    const { subscriptions } = this.dependencies;
    if (charge.kind === "initial") await subscriptions.update(charge.subscriptionId, ["pending"], { status: "failed" });
    else await subscriptions.update(charge.subscriptionId, ["active"], { status: "past_due" });
  }

  public findGatewayOrThrow(provider: string): PaymentGateway {
    const gateway = Object.hasOwn(this.dependencies.gateways, provider) ? this.dependencies.gateways[provider] : undefined;
    if (gateway === undefined) throw unprocessable("This payment provider is not supported.");
    return gateway;
  }
}
