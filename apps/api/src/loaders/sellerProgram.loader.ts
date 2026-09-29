import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { EntitlementsLookup } from "../interfaces/entitlements.interface.js";
import type { SellerAccessPolicy } from "../interfaces/sellerAccess.interface.js";
import type { StoreAccess } from "../interfaces/storeAccess.interface.js";
import type { UserDirectory } from "../interfaces/userDirectory.interface.js";
import type { VerificationBadgeLookup } from "../interfaces/verificationBadge.interface.js";
import type { PaymentGateway } from "../modules/payments/gateways/paymentGateway.interface.js";
import type { PaymentReturnUrls } from "../modules/payments/services/paymentReturnUrl.service.js";
import type { PaymentWebhookRegistry } from "../modules/payments/services/paymentWebhookRegistry.service.js";
import { SellerSubscriptionsController } from "../modules/subscriptions/controllers/sellerSubscriptions.controller.js";
import { SubscriptionPlansAdminController } from "../modules/subscriptions/controllers/subscriptionPlansAdmin.controller.js";
import { SubscriptionsController } from "../modules/subscriptions/controllers/subscriptions.controller.js";
import { createSubscriptionRenewalsJob } from "../modules/subscriptions/jobs/subscriptionRenewals.job.js";
import { createSellerEntitlementGate } from "../modules/subscriptions/middlewares/sellerAccess.middleware.js";
import { SUBSCRIPTION_REFERENCE_PREFIX } from "../modules/subscriptions/models/subscriptions.model.js";
import { PrismaSubscriptionPlansRepository } from "../modules/subscriptions/repositories/subscriptionPlans.prisma.repository.js";
import { InMemorySubscriptionPlansRepository } from "../modules/subscriptions/repositories/subscriptionPlans.repository.js";
import { PrismaSubscriptionChargesRepository, PrismaSubscriptionsRepository } from "../modules/subscriptions/repositories/subscriptions.prisma.repository.js";
import { InMemorySubscriptionChargesRepository, InMemorySubscriptionsRepository } from "../modules/subscriptions/repositories/subscriptions.repository.js";
import { SubscriptionEntitlements } from "../modules/subscriptions/services/entitlements.service.js";
import { SellerAccessService } from "../modules/subscriptions/services/sellerAccess.service.js";
import { SubscriptionBillingService } from "../modules/subscriptions/services/subscriptionBilling.service.js";
import { SubscriptionLifecycleService } from "../modules/subscriptions/services/subscriptionLifecycle.service.js";
import { SubscriptionPlansService } from "../modules/subscriptions/services/subscriptionPlans.service.js";
import { SubscriptionRenewalsService } from "../modules/subscriptions/services/subscriptionRenewals.service.js";
import { registerSubscriptionsCommandAndQueryHandlers } from "../modules/subscriptions/subscriptions.module.js";
import { VerificationsController } from "../modules/verifications/controllers/verifications.controller.js";
import { PrismaVerificationsRepository } from "../modules/verifications/repositories/verifications.prisma.repository.js";
import { InMemoryVerificationsRepository, type VerificationsRepository } from "../modules/verifications/repositories/verifications.repository.js";
import { ProfileResolver } from "../modules/verifications/services/profileResolver.service.js";
import { RepositoryVerificationBadgeLookup } from "../modules/verifications/services/verificationBadgeLookup.service.js";
import { VerificationsService } from "../modules/verifications/services/verifications.service.js";
import { registerVerificationsCommandAndQueryHandlers } from "../modules/verifications/verifications.module.js";
import type { LedgerService } from "../modules/wallets/services/ledger.service.js";
import type { WalletsService } from "../modules/wallets/services/wallets.service.js";
import type { Core } from "./core.loader.js";
import { subscribeSellerProgramEvents } from "./sellerProgramEvents.loader.js";

export interface VerificationBadgeSource {
  readonly verifications: VerificationsRepository;
  readonly lookup: VerificationBadgeLookup;
}

export function createVerificationBadgeSource(core: Core): VerificationBadgeSource {
  const verifications = core.persistence === "prisma" ? new PrismaVerificationsRepository() : new InMemoryVerificationsRepository();
  return { verifications, lookup: new RepositoryVerificationBadgeLookup(verifications) };
}

export interface SellerProgramSharedServices {
  readonly audit: AuditRecorder;
  readonly userDirectory: UserDirectory;
  readonly storeAccess: StoreAccess;
  readonly badgeSource: VerificationBadgeSource;
  readonly payments: {
    readonly gateways: Readonly<Record<string, PaymentGateway>>;
    readonly ledger: LedgerService;
    readonly webhookRegistry: PaymentWebhookRegistry;
    readonly returnUrls: PaymentReturnUrls;
    readonly walletsService: WalletsService;
  };
}

export function createSellerProgramModules(core: Core, shared: SellerProgramSharedServices) {
  const usePrisma = core.persistence === "prisma";
  const { commands, queries, events, clock, cipher, settings } = core;
  const { gateways, ledger, webhookRegistry, returnUrls, walletsService } = shared.payments;
  const profiles = new ProfileResolver(shared.storeAccess);
  const subscriptions = usePrisma ? new PrismaSubscriptionsRepository() : new InMemorySubscriptionsRepository();
  const planRecords = usePrisma ? new PrismaSubscriptionPlansRepository() : new InMemorySubscriptionPlansRepository();
  const entitlements = new SubscriptionEntitlements(subscriptions, planRecords, clock, settings.subscriptions.gracePeriodDays);

  const verificationsService = new VerificationsService({
    verifications: shared.badgeSource.verifications, profiles, cipher, audit: shared.audit, events, clock,
    findSubscribedTier: (profileId) => entitlements.findEntitledTier(profileId),
  });
  const lifecycle = new SubscriptionLifecycleService(subscriptions, shared.audit, events, clock);
  const plans = new SubscriptionPlansService(planRecords, shared.audit);
  const billing = new SubscriptionBillingService({
    lifecycle, plans, profiles, gateways, ledger, returnUrls, cipher,
    charges: usePrisma ? new PrismaSubscriptionChargesRepository() : new InMemorySubscriptionChargesRepository(),
    userDirectory: shared.userDirectory,
    audit: shared.audit,
  });
  const renewals = new SubscriptionRenewalsService(billing, settings.subscriptions.gracePeriodDays, core.logger);
  const sellerAccess = new SellerAccessService(shared.storeAccess, shared.badgeSource.verifications, subscriptions, entitlements);

  webhookRegistry.registerReferencePrefix("subscriptions", SUBSCRIPTION_REFERENCE_PREFIX, (delivery) => billing.handleSubscriptionWebhook(delivery));
  subscribeSellerProgramEvents(core, { verificationsService, walletsService, profiles });
  registerVerificationsCommandAndQueryHandlers(commands, queries, verificationsService);
  registerSubscriptionsCommandAndQueryHandlers(commands, queries, { lifecycle, billing, plans, sellerAccess });

  const sellerAccessPolicy: SellerAccessPolicy = sellerAccess;
  const entitlementsLookup: EntitlementsLookup = entitlements;
  return {
    sellerAccess: sellerAccessPolicy,
    entitlements: entitlementsLookup,
    requireSellerEntitlement: createSellerEntitlementGate(sellerAccess, shared.storeAccess),
    scheduledJobs: [createSubscriptionRenewalsJob(renewals)],
    controllers: {
      verificationsController: new VerificationsController(commands, queries),
      subscriptionsController: new SubscriptionsController(commands, queries),
      sellerSubscriptionsController: new SellerSubscriptionsController(commands, queries),
      subscriptionPlansAdminController: new SubscriptionPlansAdminController(commands, queries),
    },
  };
}
