import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { PersonalVerificationLookup } from "../interfaces/creatorEligibility.interface.js";
import type { CreatorWallets } from "../interfaces/creatorWallets.interface.js";
import type { OrderLookup } from "../interfaces/orderLookup.interface.js";
import type { ProductCatalog } from "../interfaces/productCatalog.interface.js";
import type { StoreAccess } from "../interfaces/storeAccess.interface.js";
import type { UserAccountStandingLookup, UserDirectory } from "../interfaces/userDirectory.interface.js";
import { CreatorAdminController } from "../modules/creators/controllers/creatorAdmin.controller.js";
import { CreatorsController } from "../modules/creators/controllers/creators.controller.js";
import { registerCreatorsCommandAndQueryHandlers } from "../modules/creators/creators.module.js";
import { PrismaAffiliatesRepository } from "../modules/creators/repositories/affiliates.prisma.repository.js";
import { InMemoryAffiliatesRepository } from "../modules/creators/repositories/affiliates.repository.js";
import { PrismaCreatorEarningsRepository } from "../modules/creators/repositories/creatorEarnings.prisma.repository.js";
import { InMemoryCreatorEarningsRepository } from "../modules/creators/repositories/creatorEarnings.repository.js";
import { PrismaCreatorProgramRepository } from "../modules/creators/repositories/creatorProgram.prisma.repository.js";
import { InMemoryCreatorProgramRepository, type CreatorProgramRepository } from "../modules/creators/repositories/creatorProgram.repository.js";
import { createCreatorProgramServices } from "../modules/creators/services/creatorProgramServices.service.js";
import type { RepositorySocialGraph } from "../modules/follows/services/socialGraph.service.js";
import type { PostsService } from "../modules/posts/services/posts.service.js";
import { EscrowReleasedEvent } from "../modules/escrows/events/escrowReleased.event.js";
import type { Core } from "./core.loader.js";
import { subscribeToEvent } from "./events.loader.js";

export interface CreatorProgramPorts {
  readonly creatorWallets: CreatorWallets;
  readonly personalVerification: PersonalVerificationLookup;
  readonly userDirectory: UserDirectory & UserAccountStandingLookup;
  readonly orderLookup: OrderLookup;
  readonly storeAccess: StoreAccess;
  readonly productCatalog: ProductCatalog;
  readonly audit: AuditRecorder;
}

export function createCreatorProgramRepository(core: Core): CreatorProgramRepository {
  return core.persistence === "prisma" ? new PrismaCreatorProgramRepository() : new InMemoryCreatorProgramRepository();
}

export function createCreatorModule(core: Core, program: CreatorProgramRepository, postsService: PostsService, socialGraph: RepositorySocialGraph, ports: CreatorProgramPorts) {
  const usePrisma = core.persistence === "prisma";
  const services = createCreatorProgramServices({
    program,
    earnings: usePrisma ? new PrismaCreatorEarningsRepository() : new InMemoryCreatorEarningsRepository(),
    affiliates: usePrisma ? new PrismaAffiliatesRepository() : new InMemoryAffiliatesRepository(),
    postsService,
    socialGraph,
    userDirectory: ports.userDirectory,
    verification: ports.personalVerification,
    creatorWallets: ports.creatorWallets,
    orderLookup: ports.orderLookup,
    storeAccess: ports.storeAccess,
    productCatalog: ports.productCatalog,
    audit: ports.audit,
    events: core.events,
    clock: core.clock,
    settings: core.settings.creators,
    logger: core.logger,
  });
  registerCreatorsCommandAndQueryHandlers(core.commands, core.queries, services);
  subscribeToEvent(core.events, EscrowReleasedEvent, async ({ orderId }) => {
    try {
      await services.commissions.creditCommissionsForReleasedOrder(orderId);
    } catch (error) {
      core.logger.error("Crediting affiliate commissions failed", { orderId, error: String(error) });
    }
  });
  return {
    creatorProgram: services,
    controllers: {
      creatorsController: new CreatorsController(core.commands, core.queries),
      creatorAdminController: new CreatorAdminController(core.commands, core.queries),
    },
  };
}
