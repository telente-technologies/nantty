import type { HttpRouterContext } from "@nantty/fastify-platform";

import { defaultPageSize, maximumPageSize } from "../../../constants/support.constant.js";
import { isTicketStatusStopped, openTicketStatuses, ticketStatuses } from "../../../enums/ticket.enum.js";
import { conflict, notFound } from "../../../errors/support.error.js";
import type { TicketRecord, TicketWithThread } from "../../../types/ticket.type.js";
import { flattenQuery, json, parseJsonBody, parseWithSchema, readPage } from "../../../utils/http.util.js";
import { handleChangeTicketStatus } from "../commands/changeTicketStatus/changeTicketStatus.handler.js";
import { handlePostStaffReply } from "../commands/postStaffReply/postStaffReply.handler.js";
import type { StaffAccess } from "../services/staffAccess.service.js";
import { presentRequesterSummaryForStaff, presentTicketDetailForStaff } from "../services/ticketPresenter.service.js";
import type { TicketModuleDependencies } from "../tickets.module.js";
import { chatMessageBodySchema } from "../validators/ticket.validator.js";
import { readStaffTicketId } from "./staffTickets.controller.js";

const chatPermission = ["support:chat"] as const;

function chatStatus(ticket: TicketRecord): "WAITING" | "ACTIVE" | "ENDED" {
  if (isTicketStatusStopped(ticket.status)) return "ENDED";
  return ticket.assigneeStaffId === null ? "WAITING" : "ACTIVE";
}

function presentChatSummary(ticket: TicketRecord) {
  return {
    id: ticket.id, user: presentRequesterSummaryForStaff(ticket, null), status: chatStatus(ticket),
    assignee: ticket.assigneeStaffId === null ? null : { id: ticket.assigneeStaffId, name: ticket.assigneeName ?? "Agent", email: "" },
    startedAt: ticket.createdAt.toISOString(), lastMessageAt: ticket.lastMessageAt.toISOString(), lastMessagePreview: ticket.lastMessagePreview.slice(0, 90), topic: ticket.subject,
  };
}

export function createStaffChatsController(dependencies: TicketModuleDependencies, access: StaffAccess) {
  const presentDetail = (ticket: TicketWithThread) => {
    const detail = presentTicketDetailForStaff(ticket, dependencies.clock.now(), null);
    return { chat: presentChatSummary(ticket), messages: detail.messages, isRecorded: true, isEndToEndEncrypted: false, history: detail.history };
  };
  const loadChat = async (context: HttpRouterContext) => {
    const ticket = await dependencies.store.findTicket(readStaffTicketId(context));
    if (ticket === null || ticket.channel !== "chat") throw notFound("Chat");
    return ticket;
  };
  return {
    list: async (context: HttpRouterContext) => {
      await access.require(context, chatPermission);
      const query = flattenQuery(context.query);
      const status = query["status"] ?? "OPEN";
      const { page, pageSize } = readPage(query, maximumPageSize, defaultPageSize);
      const statuses = status === "ENDED" ? (["resolved", "closed"] as const) : status === "ALL" ? ticketStatuses : openTicketStatuses;
      const assignee = status === "WAITING" ? ({ kind: "unassigned" } as const) : ({ kind: "all" } as const);
      const result = await dependencies.store.listTicketQueue({ statuses, priority: undefined, category: undefined, channel: "chat", assignee, search: query["search"] || undefined, page, pageSize });
      const items = result.items.map(presentChatSummary).filter((chat) => status !== "ACTIVE" || chat.status === "ACTIVE")
        .sort((first, second) => Number(second.status === "WAITING") - Number(first.status === "WAITING") || second.lastMessageAt.localeCompare(first.lastMessageAt));
      return json(200, { items, page, pageSize, total: result.total });
    },
    detail: async (context: HttpRouterContext) => {
      const staff = await access.require(context, chatPermission);
      const ticket = await loadChat(context);
      void dependencies.identity.recordStaffAudit({ action: "support.chat_opened", actorId: staff.id, targetType: "liveChat", targetId: ticket.id, reason: "", detail: { transcriptViewed: true } });
      return json(200, presentDetail(ticket));
    },
    claim: async (context: HttpRouterContext) => {
      const staff = await access.require(context, chatPermission);
      const ticket = await loadChat(context);
      if (isTicketStatusStopped(ticket.status)) throw conflict("CHAT_ENDED", "This chat has ended.");
      if (ticket.assigneeStaffId !== null && ticket.assigneeStaffId !== staff.id) throw conflict("CHAT_CLAIMED", "Another agent already took this chat.");
      const updated = await dependencies.store.writeTicket(ticket.id, { update: { assigneeStaffId: staff.id, assigneeName: staff.name }, history: { action: "support.chat_claimed", actorId: staff.id, actorName: staff.name } });
      return json(200, presentDetail(updated));
    },
    message: async (context: HttpRouterContext) => {
      const staff = await access.require(context, chatPermission);
      const ticket = await loadChat(context);
      if (isTicketStatusStopped(ticket.status)) throw conflict("CHAT_ENDED", "This chat has ended.");
      if (ticket.assigneeStaffId !== staff.id) throw conflict("NOT_ASSIGNED", "Take this chat before replying.");
      const body = parseWithSchema(chatMessageBodySchema, parseJsonBody(context.request.body));
      return json(200, presentDetail(await handlePostStaffReply(dependencies, { staff, ticketId: ticket.id, body: body.body, isInternalNote: false, statusAfterReply: "awaiting_user" })));
    },
    end: async (context: HttpRouterContext) => {
      const staff = await access.require(context, chatPermission);
      const ticket = await loadChat(context);
      if (isTicketStatusStopped(ticket.status)) throw conflict("CHAT_ENDED", "This chat has already ended.");
      return json(200, presentDetail(await handleChangeTicketStatus(dependencies, { actor: staff, ticketId: ticket.id, status: "resolved", reason: "Chat ended" })));
    },
  };
}
