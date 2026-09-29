import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { SupportController } from "../controllers/support.controller.js";
import {
  ContactRequestBodySchema,
  CreateTicketBodySchema,
  ListTicketsQuerySchema,
  TicketMessageBodySchema,
  TicketParamsSchema,
  UpdateTicketBodySchema,
} from "../validators/support.validator.js";

const TAG = "support";
const TICKETS = "/api/v1/support/tickets";
const ADMIN_TICKETS = "/api/v1/admin/support/tickets";

export function registerSupportRoutes(router: HttpRouter, controller: SupportController, web: WebKit): void {
  const customer = web.guard.requirePermission("support:use");
  const agent = web.guard.requirePermission("support:manage");
  const byId = { params: TicketParamsSchema };
  router.get(TICKETS, controller.listMyTickets, { ...customer, ...describeRoute(TAG, "List my support tickets") });
  router.post(TICKETS, controller.createTicket, {
    ...web.guard.requirePermission("support:use", web.limitSensitiveRequests, web.requireIdempotencyKey),
    ...describeRoute(TAG, "Open a support ticket", { body: CreateTicketBodySchema }) });
  router.get(`${TICKETS}/:id`, controller.getMyTicket, { ...customer, ...describeRoute(TAG, "Get my support ticket with messages", byId) });
  router.post(`${TICKETS}/:id/messages`, controller.replyAsCustomer, {
    ...web.guard.requirePermission("support:use", web.requireIdempotencyKey),
    ...describeRoute(TAG, "Reply on my ticket", { ...byId, body: TicketMessageBodySchema }) });
  router.post("/api/v1/support/contact", controller.submitContactRequest, {
    ...web.guard.allowAnyone(web.limitSensitiveRequests),
    ...describeRoute(TAG, "Contact, legal or copyright request (emails the support team)", { body: ContactRequestBodySchema }),
  });
  router.get(ADMIN_TICKETS, controller.listTickets, { ...agent, ...describeRoute(TAG, "Support queue", { query: ListTicketsQuerySchema }) });
  router.get(`${ADMIN_TICKETS}/:id`, controller.getTicketAsAgent, { ...agent, ...describeRoute(TAG, "Get a ticket as a support agent", byId) });
  router.post(`${ADMIN_TICKETS}/:id/messages`, controller.replyAsAgent, { ...agent, ...describeRoute(TAG, "Reply as support", { ...byId, body: TicketMessageBodySchema }) });
  router.patch(`${ADMIN_TICKETS}/:id`, controller.updateTicket, { ...agent, ...describeRoute(TAG, "Change ticket status or assignee", { ...byId, body: UpdateTicketBodySchema }) });
}
