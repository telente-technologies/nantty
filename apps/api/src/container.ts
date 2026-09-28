import { createToken } from "@zudojs/container";

import type { AppSettings } from "./configs/settings.config.js";
import type { Clock } from "./interfaces/clock.interface.js";
import type { Persistence } from "./interfaces/persistence.interface.js";
import { createCatalogModules, type CatalogExternalServices } from "./loaders/catalog.loader.js";
import { createCommerceModules, type CommerceExternalServices } from "./loaders/commerce.loader.js";
import { createCommunicationModules, type CommunicationExternalServices } from "./loaders/communication.loader.js";
import { createCore } from "./loaders/core.loader.js";
import { createIdentityModules, type IdentityExternalServices } from "./loaders/identity.loader.js";
import { createSocialModules } from "./loaders/social.loader.js";
import { createWebKit } from "./loaders/web.loader.js";
import type { AppLogger } from "./loggers/app.logger.js";
import { AuditController } from "./modules/audit/controllers/audit.controller.js";
import { registerAuditCommandAndQueryHandlers } from "./modules/audit/audit.module.js";
import { InMemoryAuditRepository } from "./modules/audit/repositories/audit.repository.js";
import { PrismaAuditRepository } from "./modules/audit/repositories/audit.prisma.repository.js";
import { AuditService } from "./modules/audit/services/audit.service.js";
import type { HealthCheck } from "./routes/health.routes.js";
// zudojs:container-imports:start
// zudojs:container-imports:end

export const APP_DEPENDENCIES = createToken<AppDependencies>("app.dependencies");

export interface ExternalServices
  extends IdentityExternalServices, CatalogExternalServices, CommerceExternalServices, CommunicationExternalServices {}

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
  const identity = createIdentityModules(core, audit, external);
  const web = createWebKit(core.settings, core.persistence, core.clock, identity.accessTokenVerifier);
  const catalog = createCatalogModules(core, { audit, userDirectory: identity.userDirectory }, external);
  const commerce = createCommerceModules(core, { audit, userDirectory: identity.userDirectory, ...catalog }, external);
  const social = createSocialModules(core, { audit, userDirectory: identity.userDirectory, ...catalog, orderLookup: commerce.orderLookup });
  const communication = createCommunicationModules(core, { audit, userDirectory: identity.userDirectory, socialGraph: social.socialGraph }, external);

  return {
    health,
    core,
    web,
    scheduledJobs: commerce.scheduledJobs,
    ports: {
      audit,
      userDirectory: identity.userDirectory,
      storeAccess: catalog.storeAccess,
      productCatalog: catalog.productCatalog,
      orderLookup: commerce.orderLookup,
      socialGraph: social.socialGraph,
    },
    // zudojs:container:start
    auditController: new AuditController(core.queries),
    authController: identity.authController,
    usersController: identity.usersController,
    ...catalog.controllers,
    ...commerce.controllers,
    ...social.controllers,
    ...communication.controllers,
    // zudojs:container:end
  };
}

export type AppDependencies = ReturnType<typeof createDependencies>;
