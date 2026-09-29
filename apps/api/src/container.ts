import { createToken } from "@zudojs/container";

import type { AppSettings } from "./configs/settings.config.js";
import type { Clock } from "./interfaces/clock.interface.js";
import type { Persistence } from "./interfaces/persistence.interface.js";
import { createAdminModule, type AdminExternalServices } from "./loaders/admin.loader.js";
import { createCatalogModules, type CatalogExternalServices } from "./loaders/catalog.loader.js";
import { createCommerceModules, type CommerceExternalServices } from "./loaders/commerce.loader.js";
import { createCommunicationModules, type CommunicationExternalServices } from "./loaders/communication.loader.js";
import { createCore } from "./loaders/core.loader.js";
import { createCurrencyModule, type CurrencyExternalServices } from "./loaders/currency.loader.js";
import { createCreatorSubscriptionsStore } from "./loaders/creatorSubscriptions.loader.js";
import { createMonetizationModules, type MonetizationExternalServices } from "./loaders/monetization.loader.js";
import { createIdentityModules, type IdentityExternalServices } from "./loaders/identity.loader.js";
import { createSellerProgramModules, createVerificationBadgeSource } from "./loaders/sellerProgram.loader.js";
import { createSocialModules, type SocialExternalServices } from "./loaders/social.loader.js";
import { createModerationDecisionsRepository } from "./loaders/trustAndSafety.loader.js";
import { createWebKit } from "./loaders/web.loader.js";
import type { AppLogger } from "./loggers/app.logger.js";
import { AuditController } from "./modules/audit/controllers/audit.controller.js";
import { registerAuditCommandAndQueryHandlers } from "./modules/audit/audit.module.js";
import { InMemoryAuditRepository } from "./modules/audit/repositories/audit.repository.js";
import { PrismaAuditRepository } from "./modules/audit/repositories/audit.prisma.repository.js";
import { AuditService } from "./modules/audit/services/audit.service.js";
import { RepositoryAccountSuspensionLookup, SuspensionAwareAccessTokenVerifier } from "./modules/moderation/services/accountSuspension.service.js";
import type { HealthCheck } from "./routes/health.routes.js";
// zudojs:container-imports:start
// zudojs:container-imports:end

export const APP_DEPENDENCIES = createToken<AppDependencies>("app.dependencies");

export interface ExternalServices
  extends IdentityExternalServices,
    AdminExternalServices,
    CurrencyExternalServices,
    MonetizationExternalServices,
    CatalogExternalServices, CommerceExternalServices, CommunicationExternalServices, SocialExternalServices {}

export interface DependencyOptions {
  readonly settings: AppSettings;
  readonly health?: HealthCheck;
  readonly persistence?: Persistence;
  readonly clock?: Clock;
  readonly logger?: AppLogger;
  readonly external?: ExternalServices;
}

export function createDependencies(options: DependencyOptions) {
  const health: HealthCheck = options.health ?? (async () => ({ ready: true, checks: {} }));
  const external = options.external ?? {};
  const core = createCore({
    settings: options.settings,
    persistence: options.persistence ?? "prisma",
    ...(options.clock === undefined ? {} : { clock: options.clock }),
    ...(options.logger === undefined ? {} : { logger: options.logger }),
  });

  const audit = new AuditService(core.persistence === "prisma" ? new PrismaAuditRepository() : new InMemoryAuditRepository(), core.clock);
  registerAuditCommandAndQueryHandlers(core.commands, core.queries, audit);
  const badgeSource = createVerificationBadgeSource(core);
  const identity = createIdentityModules(core, audit, external, badgeSource.lookup);
  const admin = createAdminModule(core, identity.internals, audit, external);
  const currency = createCurrencyModule(core, identity.userDirectory, external);
  const moderationDecisions = createModerationDecisionsRepository(core);
  const accessTokenVerifier = new SuspensionAwareAccessTokenVerifier(identity.accessTokenVerifier, new RepositoryAccountSuspensionLookup(moderationDecisions), core.clock);
  const web = createWebKit(core.settings, core.persistence, core.clock, accessTokenVerifier, currency.resolveViewerLocale, admin.platformStaff);
  const { currencyConverter } = currency;
  const catalog = createCatalogModules(core, { audit, userDirectory: identity.userDirectory, currencyConverter, verificationBadges: badgeSource.lookup }, external);
  const commerce = createCommerceModules(
    core,
    { audit, userDirectory: identity.userDirectory, addressBook: identity.addressBook, currencyConverter, ...catalog },
    external,
  );
  const sellerProgram = createSellerProgramModules(core, {
    audit, userDirectory: identity.userDirectory, storeAccess: catalog.storeAccess, badgeSource, payments: commerce.payments,
  });
  const creatorSubscriptionsStore = createCreatorSubscriptionsStore(core);
  const social = createSocialModules(core, {
    audit,
    userDirectory: identity.userDirectory,
    currencyConverter,
    ...catalog,
    orderLookup: commerce.orderLookup,
    creatorWallets: commerce.creatorWallets,
    verificationBadges: badgeSource.lookup,
    subscriberLookup: creatorSubscriptionsStore.lookup,
  }, external);
  const monetization = createMonetizationModules(core, { audit, userDirectory: identity.userDirectory, socialGraph: social.socialGraph, payments: commerce.payments, creatorSubscriptionsStore, creatorProgram: social.creatorProgram, productCatalog: catalog.productCatalog, currencyConverter }, external);
  const communication = createCommunicationModules(core, {
    audit,
    userDirectory: identity.userDirectory,
    socialGraph: social.socialGraph,
    storeAccess: catalog.storeAccess,
    mediaLibrary: catalog.mediaLibrary,
    accessTokenVerifier,
    moderationDecisions,
    moderationTargets: [...catalog.moderationTargets, ...social.moderationTargets],
  }, external);

  return {
    health,
    core,
    web,
    scheduledJobs: [...commerce.scheduledJobs, ...currency.scheduledJobs, ...catalog.scheduledJobs, ...sellerProgram.scheduledJobs, ...monetization.scheduledJobs, ...communication.scheduledJobs],
    ports: {
      audit,
      platformStaff: admin.platformStaff,
      currencyConverter,
      userDirectory: identity.userDirectory,
      storeAccess: catalog.storeAccess,
      productCatalog: catalog.productCatalog,
      mediaLibrary: catalog.mediaLibrary,
      mediaProcessingQueue: catalog.mediaProcessingQueue,
      orderLookup: commerce.orderLookup,
      creatorWallets: commerce.creatorWallets,
      advertiserBilling: commerce.advertiserBilling,
      ledger: commerce.payments.ledger,
      sellerAccess: sellerProgram.sellerAccess,
      entitlements: sellerProgram.entitlements,
      requireSellerEntitlement: sellerProgram.requireSellerEntitlement,
      verificationBadges: badgeSource.lookup,
      socialGraph: social.socialGraph,
      realtime: communication.realtimeHub,
      supportInbox: communication.supportInbox,
      moderationQueue: communication.moderationQueue,
      accountSuspensions: communication.accountSuspensions,
    },
    // zudojs:container:start
    ...admin.controllers,
    auditController: new AuditController(core.queries),
    authController: identity.authController,
    usersController: identity.usersController,
    currencyController: currency.currencyController,
    ...catalog.controllers,
    ...commerce.controllers,
    ...sellerProgram.controllers,
    ...social.controllers,
    ...monetization.controllers,
    ...communication.controllers,
    // zudojs:container:end
  };
}

export type AppDependencies = ReturnType<typeof createDependencies>;
