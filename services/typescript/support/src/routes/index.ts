import { createRouter, type HttpRouter } from "@nantty/fastify-platform";

import type { Clock } from "../interfaces/clock.interface.js";
import type { HelpContentStore } from "../interfaces/helpContentStore.interface.js";
import type { MediaDirectory } from "../interfaces/mediaDirectory.interface.js";
import type { IdentityDirectory } from "../interfaces/identityDirectory.interface.js";
import type { TicketStore } from "../interfaces/ticketStore.interface.js";
import type { StaffAuthenticator } from "../middlewares/staffAuth.middleware.js";
import { assertInternalToken } from "../middlewares/principal.middleware.js";
import { createAdminHelpController } from "../modules/helpContent/controllers/adminHelp.controller.js";
import { createPublicHelpController } from "../modules/helpContent/controllers/publicHelp.controller.js";
import { registerHelpContentRoutes } from "../modules/helpContent/routes/helpContent.routes.js";
import { createMacrosController } from "../modules/tickets/controllers/macros.controller.js";
import { createMyTicketsController } from "../modules/tickets/controllers/myTickets.controller.js";
import { createStaffChatsController } from "../modules/tickets/controllers/staffChats.controller.js";
import { createStaffTicketsController } from "../modules/tickets/controllers/staffTickets.controller.js";
import { registerTicketRoutes } from "../modules/tickets/routes/tickets.routes.js";
import { createStaffAccess } from "../modules/tickets/services/staffAccess.service.js";
import { errorToResponse, json } from "../utils/http.util.js";
import { runReadinessChecks } from "../utils/readiness.util.js";

export interface RouteDependencies {
  readonly ticketStore: TicketStore;
  readonly helpStore: HelpContentStore;
  readonly identity: IdentityDirectory;
  readonly staffAuthenticator: StaffAuthenticator;
  readonly clock: Clock;
  readonly internalToken: string;
  readonly mediaPublicBaseUrls: readonly string[];
  readonly media?: MediaDirectory;
  readonly probeDatabase: (() => Promise<void>) | undefined;
  readonly probeBroker?: () => Promise<void>;
  readonly runAutoFaqNow: (() => Promise<number>) | undefined;
}

export function buildSupportRouter(dependencies: RouteDependencies): HttpRouter {
  const router = createRouter({
    onError: (error) => errorToResponse(error) ?? json(500, { message: "Internal Server Error", code: "INTERNAL_ERROR" }),
    notFoundHandler: () => json(404, { message: "Not found.", code: "NOT_FOUND" }),
    methodNotAllowedHandler: () => json(405, { message: "Method not allowed.", code: "METHOD_NOT_ALLOWED" }),
  });
  router.get("/healthz", () => json(200, { status: "up", service: "support" }));
  router.get("/readyz", async () => {
    const { ready } = await runReadinessChecks({
      database: async () => dependencies.probeDatabase?.(),
      rabbitmq: async () => dependencies.probeBroker?.(),
    });
    return ready ? json(200, { status: "ready" }) : json(503, { status: "unavailable" });
  });
  router.post("/internal/support/auto-faq/run", async (context) => {
    assertInternalToken(context, dependencies.internalToken);
    return json(200, { processed: (await dependencies.runAutoFaqNow?.()) ?? 0 });
  });
  const ticketDependencies = { store: dependencies.ticketStore, clock: dependencies.clock, identity: dependencies.identity, mediaPublicBaseUrls: dependencies.mediaPublicBaseUrls, ...(dependencies.media === undefined ? {} : { media: dependencies.media }) };
  const access = createStaffAccess(dependencies.staffAuthenticator, dependencies.ticketStore, dependencies.clock);
  registerTicketRoutes(router, {
    mine: createMyTicketsController(ticketDependencies),
    staff: createStaffTicketsController(ticketDependencies, access),
    chats: createStaffChatsController(ticketDependencies, access),
    macros: createMacrosController(ticketDependencies, access),
  });
  registerHelpContentRoutes(router, createPublicHelpController({ store: dependencies.helpStore }), createAdminHelpController({ store: dependencies.helpStore }, access));
  return router;
}
