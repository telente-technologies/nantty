import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { CreatorAccess } from "../interfaces/creatorAccess.interface.js";
import type { SocialGraph } from "../interfaces/socialGraph.interface.js";
import type { UserDirectory } from "../interfaces/userDirectory.interface.js";
import { CreatorSubscriptionsController } from "../modules/creatorSubscriptions/controllers/creatorSubscriptions.controller.js";
import { registerCreatorSubscriptionsCommandAndQueryHandlers } from "../modules/creatorSubscriptions/creatorSubscriptions.module.js";
import { createCreatorSubscriptionRenewalsJob } from "../modules/creatorSubscriptions/jobs/creatorSubscriptionRenewals.job.js";
import { CREATOR_SUBSCRIPTION_REFERENCE_PREFIX } from "../modules/creatorSubscriptions/models/creatorSubscriptions.model.js";
import { PrismaCreatorPlansRepository } from "../modules/creatorSubscriptions/repositories/creatorPlans.prisma.repository.js";
import { InMemoryCreatorPlansRepository, type CreatorPlansRepository } from "../modules/creatorSubscriptions/repositories/creatorPlans.repository.js";
import { PrismaCreatorSubscriptionsRepository } from "../modules/creatorSubscriptions/repositories/creatorSubscriptions.prisma.repository.js";
import { InMemoryCreatorSubscriptionsRepository, type CreatorSubscriptionsRepository } from "../modules/creatorSubscriptions/repositories/creatorSubscriptions.repository.js";
import { CreatorPlansService } from "../modules/creatorSubscriptions/services/creatorPlans.service.js";
import { CreatorSubscriptionBillingService } from "../modules/creatorSubscriptions/services/creatorSubscriptionBilling.service.js";
import { CreatorSubscriptionLifecycleService, RepositoryCreatorSubscriberLookup } from "../modules/creatorSubscriptions/services/creatorSubscriptionLifecycle.service.js";
import type { CreatorEarningsRepository } from "../modules/creators/repositories/creatorEarnings.repository.js";
import type { PaymentGateway } from "../modules/payments/gateways/paymentGateway.interface.js";
import type { PaymentReturnUrls } from "../modules/payments/services/paymentReturnUrl.service.js";
import type { PaymentWebhookRegistry } from "../modules/payments/services/paymentWebhookRegistry.service.js";
import type { LedgerService } from "../modules/wallets/services/ledger.service.js";
import type { Core } from "./core.loader.js";

export interface CreatorSubscriptionsStore {
  readonly plans: CreatorPlansRepository;
  readonly subscriptions: CreatorSubscriptionsRepository;
  readonly lookup: RepositoryCreatorSubscriberLookup;
}

export function createCreatorSubscriptionsStore(core: Core): CreatorSubscriptionsStore {
  const usePrisma = core.persistence === "prisma";
  const subscriptions = usePrisma ? new PrismaCreatorSubscriptionsRepository() : new InMemoryCreatorSubscriptionsRepository();
  return {
    plans: usePrisma ? new PrismaCreatorPlansRepository() : new InMemoryCreatorPlansRepository(),
    subscriptions,
    lookup: new RepositoryCreatorSubscriberLookup(subscriptions, () => core.clock.now()),
  };
}

export interface CreatorSubscriptionsSharedServices {
  readonly store: CreatorSubscriptionsStore;
  readonly earnings: CreatorEarningsRepository;
  readonly creatorAccess: CreatorAccess;
  readonly audit: AuditRecorder;
  readonly userDirectory: UserDirectory;
  readonly socialGraph: SocialGraph;
  readonly gateways: Readonly<Record<string, PaymentGateway>>;
  readonly webhookRegistry: PaymentWebhookRegistry;
  readonly returnUrls: PaymentReturnUrls;
  readonly ledger: LedgerService;
}

export function createCreatorSubscriptionsModule(core: Core, shared: CreatorSubscriptionsSharedServices) {
  const { commands, queries, settings } = core;
  const billing = new CreatorSubscriptionBillingService({
    plans: shared.store.plans,
    subscriptions: shared.store.subscriptions,
    earnings: shared.earnings,
    gateways: shared.gateways,
    returnUrls: shared.returnUrls,
    userDirectory: shared.userDirectory,
    socialGraph: shared.socialGraph,
    creatorAccess: shared.creatorAccess,
    ledger: shared.ledger,
    cipher: core.cipher,
    audit: shared.audit,
    events: core.events,
    clock: core.clock,
    settings: settings.monetization,
    gracePeriodDays: settings.subscriptions.gracePeriodDays,
  });
  const lifecycle = new CreatorSubscriptionLifecycleService(billing, core.logger);
  const services = { billing, lifecycle, plans: new CreatorPlansService(billing) };
  shared.webhookRegistry.registerReferencePrefix("creator-subscriptions", CREATOR_SUBSCRIPTION_REFERENCE_PREFIX, (delivery) => billing.handleCreatorSubscriptionWebhook(delivery));
  registerCreatorSubscriptionsCommandAndQueryHandlers(commands, queries, services);
  return {
    creatorSubscriptions: services,
    scheduledJobs: [createCreatorSubscriptionRenewalsJob(lifecycle)],
    controllers: { creatorSubscriptionsController: new CreatorSubscriptionsController(commands, queries) },
  };
}
