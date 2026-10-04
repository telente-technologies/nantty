import type { HttpRouterContext } from "@zudojs/http";

import { agentActivityWindowDays, defaultPageSize, maximumPageSize } from "../../../constants/support.constant.js";
import { openTicketStatuses, ticketStatuses, type TicketCategory, type TicketPriority, type TicketStatus } from "../../../enums/ticket.enum.js";
import { badRequest } from "../../../errors/support.error.js";
import { staffHoldsAnyPermission } from "../../../middlewares/staffAuth.middleware.js";
import { flattenQuery, json, parseJsonBody, parseWithSchema, readPage } from "../../../utils/http.util.js";
import { handleAssignTicket } from "../commands/assignTicket/assignTicket.handler.js";
import { handleChangeTicketStatus } from "../commands/changeTicketStatus/changeTicketStatus.handler.js";
import { handlePostStaffReply } from "../commands/postStaffReply/postStaffReply.handler.js";
import { handleListTicketQueue } from "../queries/listTicketQueue/listTicketQueue.handler.js";
import type { StaffAccess } from "../services/staffAccess.service.js";
import { presentTicketDetailForStaff } from "../services/ticketPresenter.service.js";
import type { TicketModuleDependencies } from "../tickets.module.js";
import { staffAssignBodySchema, staffQueueQuerySchema, staffReplyBodySchema, staffStatusBodySchema, ticketIdSchema } from "../validators/ticket.validator.js";
import type { TicketWithThread } from "../../../types/ticket.type.js";
import { notFound } from "../../../errors/support.error.js";

export const readPermissions = ["support:tickets", "support:assign"] as const;

export function readStaffTicketId(context: HttpRouterContext): string {
  const parsed = ticketIdSchema.safeParse(context.params["ticketId"] ?? context.params["chatId"]);
  if (!parsed.success) throw badRequest("VALIDATION_FAILED", "ticketId must be a uuid.");
  return parsed.data;
}

function parseStatusFilter(raw: string | undefined): readonly TicketStatus[] | undefined {
  if (raw === undefined || raw === "" || raw === "ALL") return undefined;
  if (raw === "ACTIVE") return openTicketStatuses;
  const statuses = raw.split(",").map((value) => value.trim().toLowerCase()).filter((value): value is TicketStatus => (ticketStatuses as readonly string[]).includes(value));
  if (statuses.length === 0) throw badRequest("VALIDATION_FAILED", "Unknown ticket status.");
  return statuses;
}

export function createStaffTicketsController(dependencies: TicketModuleDependencies, access: StaffAccess) {
  const detail = async (ticket: TicketWithThread) => presentTicketDetailForStaff(ticket, dependencies.clock.now(), await dependencies.identity.findRequesterProfile(ticket.requesterAccountId));
  const audit = (staffId: string, action: string, ticket: TicketWithThread, reason: string | null) =>
    void dependencies.identity.recordStaffAudit({ action, actorId: staffId, targetType: "supportTicket", targetId: ticket.id, reason: reason ?? "", detail: { status: ticket.status } });
  return {
    queue: async (context: HttpRouterContext) => {
      const staff = await access.require(context, readPermissions);
      const query = flattenQuery(context.query);
      const filters = parseWithSchema(staffQueueQuerySchema, { ...query, status: query["status"] || undefined, priority: query["priority"] || undefined, category: query["category"] || undefined, search: query["search"] || undefined, assignee: query["assignee"] || undefined });
      const assignee = filters.assignee ?? "all";
      return json(200, await handleListTicketQueue(dependencies, {
        statuses: parseStatusFilter(filters.status), priority: filters.priority?.toLowerCase() as TicketPriority | undefined, category: filters.category?.toLowerCase() as TicketCategory | undefined,
        channel: undefined, assignee: assignee === "me" ? { kind: "staff", staffId: staff.id } : assignee === "unassigned" ? { kind: "unassigned" } : { kind: "all" }, search: filters.search,
        ...readPage(query, maximumPageSize, defaultPageSize),
      }));
    },
    detail: async (context: HttpRouterContext) => {
      await access.require(context, readPermissions);
      const ticket = await dependencies.store.findTicket(readStaffTicketId(context));
      if (ticket === null) throw notFound("Ticket");
      return json(200, await detail(ticket));
    },
    reply: async (context: HttpRouterContext) => {
      const staff = await access.require(context, ["support:tickets"]);
      const body = parseWithSchema(staffReplyBodySchema, parseJsonBody(context.request.body));
      const ticket = await handlePostStaffReply(dependencies, { staff, ticketId: readStaffTicketId(context), body: body.body, isInternalNote: body.isInternalNote === true, statusAfterReply: body.statusAfterReply?.toLowerCase() as TicketStatus | undefined });
      audit(staff.id, body.isInternalNote === true ? "support.internal_note_added" : "support.reply_sent", ticket, null);
      return json(201, await detail(ticket));
    },
    status: async (context: HttpRouterContext) => {
      const staff = await access.require(context, ["support:tickets"]);
      const body = parseWithSchema(staffStatusBodySchema, parseJsonBody(context.request.body));
      const ticket = await handleChangeTicketStatus(dependencies, { actor: staff, ticketId: readStaffTicketId(context), status: body.status.toLowerCase() as TicketStatus, reason: body.reason ?? null });
      audit(staff.id, "support.status_changed", ticket, body.reason ?? null);
      return json(200, await detail(ticket));
    },
    assign: async (context: HttpRouterContext) => {
      const staff = await access.require(context, readPermissions);
      const body = parseWithSchema(staffAssignBodySchema, parseJsonBody(context.request.body));
      const ticket = await handleAssignTicket(dependencies, { staff, canAssignOthers: staffHoldsAnyPermission(staff, ["support:assign"]), ticketId: readStaffTicketId(context), assigneeId: body.assigneeId, reason: body.reason ?? null });
      audit(staff.id, body.assigneeId === null ? "support.ticket_unassigned" : "support.ticket_assigned", ticket, body.reason ?? null);
      return json(200, await detail(ticket));
    },
    agents: async (context: HttpRouterContext) => {
      await access.require(context, readPermissions);
      const since = new Date(dependencies.clock.now().getTime() - agentActivityWindowDays * 86_400_000);
      return json(200, { items: (await dependencies.store.listAgentsSeenSince(since)).map((agent) => ({ id: agent.staffId, name: agent.name, email: "" })) });
    },
  };
}
