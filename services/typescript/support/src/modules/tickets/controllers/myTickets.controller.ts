import type { HttpRouterContext } from "@zudojs/http";

import { idempotencyKeyHeaderName } from "../../../constants/support.constant.js";
import { badRequest } from "../../../errors/support.error.js";
import { requireViewerAccountId } from "../../../middlewares/principal.middleware.js";
import { empty, json, parseJsonBody, parseWithSchema } from "../../../utils/http.util.js";
import { handleCreateSupportTicket } from "../commands/createSupportTicket/createSupportTicket.handler.js";
import { handlePostCustomerReply } from "../commands/postCustomerReply/postCustomerReply.handler.js";
import { handleRateTicket } from "../commands/rateTicket/rateTicket.handler.js";
import { handleGetRequesterTicket } from "../queries/getRequesterTicket/getRequesterTicket.handler.js";
import { presentTicketForRequester, presentTicketThreadForRequester } from "../services/ticketPresenter.service.js";
import type { TicketModuleDependencies } from "../tickets.module.js";
import { createTicketBodySchema, customerReplyBodySchema, rateTicketBodySchema, ticketIdSchema } from "../validators/ticket.validator.js";

function readTicketId(context: HttpRouterContext): string {
  const parsed = ticketIdSchema.safeParse(context.params["ticketId"]);
  if (!parsed.success) throw badRequest("VALIDATION_FAILED", "ticketId must be a uuid.");
  return parsed.data;
}

function readIdempotencyKey(context: HttpRouterContext): string | null {
  const key = context.request.getHeader(idempotencyKeyHeaderName)?.trim() ?? "";
  if (key === "") return null;
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw badRequest("INVALID_IDEMPOTENCY_KEY", "Idempotency-Key must be 8 to 128 letters, digits, dashes or underscores.");
  return key;
}

export function createMyTicketsController(dependencies: TicketModuleDependencies) {
  return {
    list: async (context: HttpRouterContext) => json(200, (await dependencies.store.listTicketsForRequester(requireViewerAccountId(context))).map(presentTicketForRequester)),
    unreadCount: async (context: HttpRouterContext) => json(200, { count: await dependencies.store.countRequesterUnread(requireViewerAccountId(context)) }),
    create: async (context: HttpRouterContext) => {
      const accountId = requireViewerAccountId(context);
      const body = parseWithSchema(createTicketBodySchema, parseJsonBody(context.request.body));
      const ticket = await handleCreateSupportTicket(dependencies, {
        accountId, category: body.category, subject: body.subject, message: body.message, attachmentUrls: body.attachmentUrls ?? [], linkedReference: body.linkedReference ?? null,
        channel: body.channel ?? "form", idempotencyKey: readIdempotencyKey(context),
      });
      return json(201, presentTicketThreadForRequester(ticket));
    },
    detail: async (context: HttpRouterContext) => json(200, presentTicketThreadForRequester(await handleGetRequesterTicket(dependencies, { accountId: requireViewerAccountId(context), ticketId: readTicketId(context) }))),
    reply: async (context: HttpRouterContext) => {
      const accountId = requireViewerAccountId(context);
      const body = parseWithSchema(customerReplyBodySchema, parseJsonBody(context.request.body));
      const ticket = await handlePostCustomerReply(dependencies, { accountId, ticketId: readTicketId(context), text: body.text, attachmentUrls: body.attachmentUrls ?? [] });
      const thread = presentTicketThreadForRequester(ticket);
      return json(201, thread.messages[thread.messages.length - 1] ?? null);
    },
    markRead: async (context: HttpRouterContext) => {
      const ticket = await handleGetRequesterTicket(dependencies, { accountId: requireViewerAccountId(context), ticketId: readTicketId(context) });
      if (ticket.requesterUnread > 0) await dependencies.store.writeTicket(ticket.id, { update: { resetRequesterUnread: true } });
      return empty(204);
    },
    rate: async (context: HttpRouterContext) => {
      const accountId = requireViewerAccountId(context);
      const body = parseWithSchema(rateTicketBodySchema, parseJsonBody(context.request.body));
      return json(200, presentTicketForRequester(await handleRateTicket(dependencies, { accountId, ticketId: readTicketId(context), score: body.score, comment: body.comment ?? null })));
    },
  };
}
