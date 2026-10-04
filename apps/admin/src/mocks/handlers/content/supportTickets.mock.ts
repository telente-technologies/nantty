import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { MockHttpError, createMockId, failValidation, matchesSearchText, paginateItems, readEnumValue, readIsoNow, readJsonObjectBody, readOptionalTrimmedString, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { MockSupportTicketRecord } from "@/mocks/seed/supportSeed.mock";
import type { SupportTicketStatus } from "@/types/support.type";

import { readSupportMockStore } from "./contentStores.mock";
import { findSupportTicketOrFail, listAssignableSupportAgents, presentSupportTicketSummary } from "./supportTicketPresenter.mock";

const ticketStatuses = ["OPEN", "AWAITING_USER", "AWAITING_SUPPORT", "RESOLVED", "CLOSED"] as const;
const priorityRank = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as const;

function auditTargetForTicket(ticket: MockSupportTicketRecord) {
  return { type: "supportTicket", id: ticket.id, label: ticket.subject.slice(0, 60) };
}

function applyStatusChange(ticket: MockSupportTicketRecord, status: SupportTicketStatus): void {
  ticket.status = status;
  ticket.resolvedAt = status === "RESOLVED" || status === "CLOSED" ? (ticket.resolvedAt ?? readIsoNow()) : null;
  ticket.updatedAt = readIsoNow();
}

export function registerSupportTicketMockHandlers(): void {
  registerMockRoute("GET", "/admin/support/agents", (request) => {
    requireMockPermission(request, "support:tickets", "support:assign");
    return respondWithJson(200, { items: listAssignableSupportAgents() });
  });

  registerMockRoute("GET", "/admin/support/tickets", (request) => {
    const principal = requireMockPermission(request, "support:tickets", "support:assign");
    const status = request.query.get("status");
    const priority = request.query.get("priority");
    const category = request.query.get("category");
    const assignee = request.query.get("assignee") ?? "all";
    const search = request.query.get("search");
    const tickets = readSupportMockStore()
      .tickets.filter(
        (ticket) =>
          (!status || status.split(",").includes(ticket.status)) &&
          (!priority || ticket.priority === priority) &&
          (!category || ticket.category === category) &&
          (assignee === "all" || (assignee === "me" ? ticket.assigneeAdminId === principal.adminId : ticket.assigneeAdminId === null)) &&
          matchesSearchText(search, ticket.id, ticket.subject, ticket.linkedOrderId, ticket.linkedDisputeId),
      )
      .map(presentSupportTicketSummary)
      .sort((first, second) => Number(second.isSlaBreached) - Number(first.isSlaBreached) || priorityRank[first.priority] - priorityRank[second.priority] || first.resolutionDueAt.localeCompare(second.resolutionDueAt));
    return respondWithJson(200, paginateItems(tickets, request));
  });

  registerMockRoute("GET", "/admin/support/tickets/:ticketId", (request) => {
    requireMockPermission(request, "support:tickets", "support:assign");
    const ticket = findSupportTicketOrFail(request.params.ticketId);
    return respondWithJson(200, { ticket: presentSupportTicketSummary(ticket), messages: ticket.messages, history: listMockAuditEntriesForTarget("supportTicket", ticket.id) });
  });

  registerMockRoute("POST", "/admin/support/tickets/:ticketId/replies", (request) => {
    const principal = requireMockPermission(request, "support:tickets");
    const ticket = findSupportTicketOrFail(request.params.ticketId);
    const body = readJsonObjectBody(request);
    const text = readRequiredTrimmedString(body, "body", 5000, 2);
    if (body.isInternalNote !== undefined && typeof body.isInternalNote !== "boolean") failValidation("isInternalNote", "isInternalNote must be true or false.");
    const isInternalNote = body.isInternalNote === true;
    if (ticket.status === "CLOSED" && !isInternalNote) throw new MockHttpError(409, "TICKET_CLOSED", "This ticket is closed. Reopen it before replying to the customer.");
    const statusAfterReply = body.statusAfterReply === undefined ? (isInternalNote ? ticket.status : "AWAITING_USER") : readEnumValue(body, "statusAfterReply", ticketStatuses);
    const before = { status: ticket.status, messageCount: ticket.messages.length, firstRespondedAt: ticket.firstRespondedAt };
    const message = { id: createMockId("msg"), authorKind: isInternalNote ? ("INTERNAL_NOTE" as const) : ("AGENT" as const), authorName: principal.name, body: text, createdAt: readIsoNow() };
    ticket.messages.push(message);
    if (!isInternalNote && !ticket.firstRespondedAt) ticket.firstRespondedAt = message.createdAt;
    if (!ticket.assigneeAdminId) ticket.assigneeAdminId = principal.adminId;
    applyStatusChange(ticket, statusAfterReply);
    recordMockAuditEntry(request, { action: isInternalNote ? "support.internal_note_added" : "support.reply_sent", area: "support", target: auditTargetForTicket(ticket), before, after: { status: ticket.status, messageCount: ticket.messages.length, firstRespondedAt: ticket.firstRespondedAt, messageId: message.id } });
    return respondWithJson(201, { ticket: presentSupportTicketSummary(ticket), messages: ticket.messages, history: listMockAuditEntriesForTarget("supportTicket", ticket.id) });
  });

  registerMockRoute("POST", "/admin/support/tickets/:ticketId/status", (request) => {
    requireMockPermission(request, "support:tickets");
    const ticket = findSupportTicketOrFail(request.params.ticketId);
    const body = readJsonObjectBody(request);
    const status = readEnumValue(body, "status", ticketStatuses);
    const reason = readOptionalTrimmedString(body, "reason", 500);
    if (status === ticket.status) throw new MockHttpError(409, "NO_CHANGE", `This ticket is already ${status.toLowerCase()}.`);
    const before = { status: ticket.status, resolvedAt: ticket.resolvedAt };
    applyStatusChange(ticket, status);
    recordMockAuditEntry(request, { action: "support.status_changed", area: "support", target: auditTargetForTicket(ticket), reason, before, after: { status: ticket.status, resolvedAt: ticket.resolvedAt } });
    return respondWithJson(200, { ticket: presentSupportTicketSummary(ticket), messages: ticket.messages, history: listMockAuditEntriesForTarget("supportTicket", ticket.id) });
  });

  registerMockRoute("POST", "/admin/support/tickets/:ticketId/assign", (request) => {
    const principal = requireMockPermission(request, "support:tickets", "support:assign");
    const ticket = findSupportTicketOrFail(request.params.ticketId);
    const body = readJsonObjectBody(request);
    const assigneeId = body.assigneeId === null ? null : readRequiredTrimmedString(body, "assigneeId", 64);
    const canAssignOthers = principal.role === "SUPERADMIN" || principal.permissions.includes("support:assign");
    if (!canAssignOthers && assigneeId !== principal.adminId) throw new MockHttpError(403, "FORBIDDEN", "You can only assign tickets to yourself. Ask a lead with ticket assignment access.");
    if (assigneeId && !listAssignableSupportAgents().some((agent) => agent.id === assigneeId)) failValidation("assigneeId", "Choose an active support agent.");
    if (assigneeId === ticket.assigneeAdminId) throw new MockHttpError(409, "NO_CHANGE", "The ticket is already assigned to this agent.");
    const before = { assigneeAdminId: ticket.assigneeAdminId };
    ticket.assigneeAdminId = assigneeId;
    ticket.updatedAt = readIsoNow();
    recordMockAuditEntry(request, { action: assigneeId ? "support.ticket_assigned" : "support.ticket_unassigned", area: "support", target: auditTargetForTicket(ticket), reason: readOptionalTrimmedString(body, "reason", 500), before, after: { assigneeAdminId: assigneeId } });
    return respondWithJson(200, { ticket: presentSupportTicketSummary(ticket), messages: ticket.messages, history: listMockAuditEntriesForTarget("supportTicket", ticket.id) });
  });
}
