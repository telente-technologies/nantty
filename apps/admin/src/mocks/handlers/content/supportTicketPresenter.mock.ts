import { findMockPlatformUser, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { failNotFound } from "@/mocks/mockResponses.mock";
import { firstResponseTargetMinutesByPriority, resolutionTargetMinutesByPriority, type MockSupportTicketRecord } from "@/mocks/seed/supportSeed.mock";
import { presentPlatformUserSummary } from "@/mocks/seed/demoPlatformUsers.mock";
import type { SupportAgent, SupportTicketSummary } from "@/types/support.type";

import { readSupportMockStore } from "./contentStores.mock";

function addMinutesToIso(isoText: string, minutes: number): string {
  return new Date(new Date(isoText).getTime() + minutes * 60_000).toISOString();
}

export function listAssignableSupportAgents(): SupportAgent[] {
  return readMockDatabase()
    .admins.filter((admin) => admin.status === "ACTIVE" && (admin.role === "SUPERADMIN" || admin.permissions.includes("support:tickets")))
    .map((admin) => ({ id: admin.id, name: admin.name, email: admin.email }));
}

export function findSupportAgent(adminId: string | null): SupportAgent | null {
  if (!adminId) return null;
  const admin = readMockDatabase().admins.find((candidate) => candidate.id === adminId);
  return admin ? { id: admin.id, name: admin.name, email: admin.email } : null;
}

export function isSupportTicketBreachingSla(record: MockSupportTicketRecord, nowEpochMs = Date.now()): boolean {
  if (record.status === "RESOLVED" || record.status === "CLOSED") return false;
  const firstResponseDue = new Date(addMinutesToIso(record.createdAt, firstResponseTargetMinutesByPriority[record.priority])).getTime();
  const resolutionDue = new Date(addMinutesToIso(record.createdAt, resolutionTargetMinutesByPriority[record.priority])).getTime();
  return (!record.firstRespondedAt && nowEpochMs > firstResponseDue) || nowEpochMs > resolutionDue;
}

export function presentSupportTicketSummary(record: MockSupportTicketRecord): SupportTicketSummary {
  const requester = findMockPlatformUser(record.requesterUserId);
  if (!requester) failNotFound("Ticket requester");
  const publicMessages = record.messages.filter((message) => message.authorKind !== "INTERNAL_NOTE");
  return {
    id: record.id,
    reference: `SUP-${record.id.replace(/\D/g, "")}`,
    subject: record.subject,
    category: record.category,
    priority: record.priority,
    status: record.status,
    channel: "FORM",
    requester: presentPlatformUserSummary(requester),
    assignee: findSupportAgent(record.assigneeAdminId),
    linkedOrderId: record.linkedOrderId,
    linkedDisputeId: record.linkedDisputeId,
    linkedReference: record.linkedOrderId ? { kind: "order", id: record.linkedOrderId, label: `Order ${record.linkedOrderId}` } : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    firstResponseDueAt: addMinutesToIso(record.createdAt, firstResponseTargetMinutesByPriority[record.priority]),
    firstRespondedAt: record.firstRespondedAt,
    resolutionDueAt: addMinutesToIso(record.createdAt, resolutionTargetMinutesByPriority[record.priority]),
    resolvedAt: record.resolvedAt,
    closedAt: record.status === "CLOSED" ? record.resolvedAt : null,
    satisfactionScore: record.satisfactionScore,
    satisfactionComment: null,
    autoFaqStatus: record.status === "RESOLVED" || record.status === "CLOSED" ? "PUBLISHED" : "NONE",
    lastMessagePreview: (publicMessages[publicMessages.length - 1]?.body ?? "").slice(0, 140),
    messageCount: record.messages.length,
    isSlaBreached: isSupportTicketBreachingSla(record),
  };
}

export function findSupportTicketOrFail(ticketId: string | undefined): MockSupportTicketRecord {
  const ticket = readSupportMockStore().tickets.find((candidate) => candidate.id === ticketId);
  if (!ticket) failNotFound("Ticket");
  return ticket;
}
