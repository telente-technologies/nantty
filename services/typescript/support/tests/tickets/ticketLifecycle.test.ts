import { describe, expect, it } from "vitest";

import { processQueuedAutoFaqTickets } from "../../src/jobs/autoFaq.job.js";
import { handleChangeTicketStatus } from "../../src/modules/tickets/commands/changeTicketStatus/changeTicketStatus.handler.js";
import { handleCreateSupportTicket } from "../../src/modules/tickets/commands/createSupportTicket/createSupportTicket.handler.js";
import { handlePostCustomerReply } from "../../src/modules/tickets/commands/postCustomerReply/postCustomerReply.handler.js";
import { handlePostStaffReply } from "../../src/modules/tickets/commands/postStaffReply/postStaffReply.handler.js";
import { handleRateTicket } from "../../src/modules/tickets/commands/rateTicket/rateTicket.handler.js";
import { handleAssignTicket } from "../../src/modules/tickets/commands/assignTicket/assignTicket.handler.js";
import { presentTicketThreadForRequester } from "../../src/modules/tickets/services/ticketPresenter.service.js";
import { createSupportHarness, lead, otherRequesterId, requesterId, staff } from "../fakes/supportHarness.fake.js";

const silentLogger = { warn: () => undefined, info: () => undefined, error: () => undefined, debug: () => undefined } as never;

async function openTicket(harness: Awaited<ReturnType<typeof createSupportHarness>>, overrides: Partial<Parameters<typeof handleCreateSupportTicket>[1]> = {}) {
  return handleCreateSupportTicket(harness.ticketDependencies, {
    accountId: requesterId, category: "payment", subject: "Refund has not arrived", message: "My refund for the cancelled order has not arrived yet.", attachmentUrls: [],
    linkedReference: { kind: "order", id: "ord_7F3K2Q", label: "Order ZM-48213" }, channel: "form", idempotencyKey: null, ...overrides,
  });
}

describe("ticket lifecycle", () => {
  it("opens a ticket with SLA targets, a ticket.created event and an idempotent replay", async () => {
    const harness = await createSupportHarness();
    const ticket = await openTicket(harness, { idempotencyKey: "create-key-0001" });
    const replay = await openTicket(harness, { idempotencyKey: "create-key-0001" });
    expect(replay.id).toBe(ticket.id);
    expect(ticket.status).toBe("open");
    expect(ticket.priority).toBe("high");
    expect(ticket.firstResponseDueAt.toISOString()).toBe("2026-10-04T13:00:00.000Z");
    expect(ticket.requesterName).toBe("Amaka Obi");
    expect(harness.ticketStore.events.map((event) => event.eventType)).toEqual(["ticket.created"]);
    expect(harness.ticketStore.events[0]?.data).toMatchObject({ accountId: requesterId, reference: `SUP-${ticket.number}`, firstResponseHours: 4 });
  });

  it("only accepts attachments the requester uploaded through the media service", async () => {
    const harness = await createSupportHarness();
    const mine = "0b6a3c9e-5a2d-4c3b-9f00-1d2e3f4a5b6c";
    const theirs = "1c7b4dae-6b3e-4d4c-8a11-2e3f4a5b6c7d";
    const failed = "2d8c5ebf-7c4f-4e5d-9b22-3f4a5b6c7d8e";
    harness.media.add({ id: mine, ownerId: requesterId, purpose: "chat", kind: "image", status: "ready" });
    harness.media.add({ id: theirs, ownerId: otherRequesterId, purpose: "chat", kind: "image", status: "ready" });
    harness.media.add({ id: failed, ownerId: requesterId, purpose: "chat", kind: "image", status: "rejected" });
    await expect(openTicket(harness, { attachmentUrls: ["https://evil.example/photo.jpg"] })).rejects.toMatchObject({ code: "INVALID_ATTACHMENT" });
    await expect(openTicket(harness, { attachmentUrls: ["https://media.nantty.com/u/1/photo.jpg"] })).rejects.toMatchObject({ code: "INVALID_ATTACHMENT" });
    await expect(openTicket(harness, { attachmentUrls: [`https://media.nantty.com/m/${theirs}/display.jpg`] })).rejects.toMatchObject({ code: "INVALID_ATTACHMENT" });
    await expect(openTicket(harness, { attachmentUrls: [`https://media.nantty.com/m/${failed}/display.jpg`] })).rejects.toMatchObject({ code: "INVALID_ATTACHMENT" });
    await expect(openTicket(harness, { attachmentUrls: [`https://media.nantty.com/m/${crypto.randomUUID()}/display.jpg`] })).rejects.toMatchObject({ code: "INVALID_ATTACHMENT" });
    const url = `https://media.nantty.com/m/${mine}/display.jpg`;
    const ticket = await openTicket(harness, { attachmentUrls: [url, `https://media.nantty.com/m/${mine}/thumb.jpg`] });
    expect(ticket.messages[0]?.attachments).toEqual([{ url, contentType: "image/jpeg" }, { url: `https://media.nantty.com/m/${mine}/thumb.jpg`, contentType: "image/jpeg" }]);
    await expect(handlePostCustomerReply(harness.ticketDependencies, { accountId: requesterId, ticketId: ticket.id, text: "Another one", attachmentUrls: [`https://media.nantty.com/m/${theirs}/display.jpg`], idempotencyKey: null })).rejects.toMatchObject({ code: "INVALID_ATTACHMENT" });
  });

  it("refuses attachments when the media service is not configured, but still accepts plain messages", async () => {
    const harness = await createSupportHarness();
    const { media: _unused, ...withoutMedia } = harness.ticketDependencies;
    await expect(handleCreateSupportTicket(withoutMedia, { accountId: requesterId, category: "payment", subject: "Refund", message: "My refund has not arrived yet at all.", attachmentUrls: ["https://media.nantty.com/m/0b6a3c9e-5a2d-4c3b-9f00-1d2e3f4a5b6c/a.jpg"], linkedReference: null, channel: "form", idempotencyKey: null })).rejects.toMatchObject({ status: 503 });
    expect((await openTicket(harness)).messages[0]?.attachments).toEqual([]);
  });

  it("emails the user on a staff reply: ticket.replied carries the agent message, internal notes stay private", async () => {
    const harness = await createSupportHarness();
    const ticket = await openTicket(harness);
    harness.advanceMinutes(30);
    const noted = await handlePostStaffReply(harness.ticketDependencies, { staff, ticketId: ticket.id, body: "Checking with the payouts desk.", isInternalNote: true, statusAfterReply: undefined });
    expect(noted.status).toBe("open");
    expect(presentTicketThreadForRequester(noted).messages).toHaveLength(1);
    const replied = await handlePostStaffReply(harness.ticketDependencies, { staff, ticketId: ticket.id, body: "The refund left us today and takes up to 5 working days.", isInternalNote: false, statusAfterReply: undefined });
    expect(replied).toMatchObject({ status: "awaiting_user", assigneeStaffId: staff.id, requesterUnread: 1 });
    expect(replied.firstRespondedAt?.toISOString()).toBe("2026-10-04T09:30:00.000Z");
    const replyEvent = harness.ticketStore.events.find((event) => event.eventType === "ticket.replied");
    expect(replyEvent?.data).toMatchObject({ authorKind: "agent", agentName: "Ngozi Eze", message: "The refund left us today and takes up to 5 working days.", accountId: requesterId });
    expect(await harness.ticketStore.countRequesterUnread(requesterId)).toBe(1);
  });

  it("moves to awaiting support when the user answers and resets their unread count", async () => {
    const harness = await createSupportHarness();
    const ticket = await openTicket(harness);
    await handlePostStaffReply(harness.ticketDependencies, { staff, ticketId: ticket.id, body: "Can you share the bank name?", isInternalNote: false, statusAfterReply: undefined });
    const answered = await handlePostCustomerReply(harness.ticketDependencies, { accountId: requesterId, ticketId: ticket.id, text: "It is GTBank.", attachmentUrls: [], idempotencyKey: null });
    expect(answered).toMatchObject({ status: "awaiting_support", requesterUnread: 0 });
    await expect(handlePostCustomerReply(harness.ticketDependencies, { accountId: otherRequesterId, ticketId: ticket.id, text: "hi", attachmentUrls: [], idempotencyKey: null })).rejects.toMatchObject({ status: 404 });
  });

  it("replays a customer reply with the same key and rejects key reuse with a different payload", async () => {
    const harness = await createSupportHarness();
    const ticket = await openTicket(harness);
    const command = { accountId: requesterId, ticketId: ticket.id, text: "The transfer reference is ABC123.", attachmentUrls: [], idempotencyKey: "reply-retry-0001" };
    const first = await handlePostCustomerReply(harness.ticketDependencies, command);
    const eventCount = harness.ticketStore.events.length;
    const replay = await handlePostCustomerReply(harness.ticketDependencies, command);

    expect(replay.messages.filter((message) => message.idempotencyKey === command.idempotencyKey)).toHaveLength(1);
    expect(replay.messageCount).toBe(first.messageCount);
    expect(harness.ticketStore.events).toHaveLength(eventCount);
    await expect(handlePostCustomerReply(harness.ticketDependencies, { ...command, text: "A different transfer reference." })).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED", status: 409 });
  });

  it("replays a committed attachment reply without requiring the media record to remain active", async () => {
    const harness = await createSupportHarness();
    const ticket = await openTicket(harness);
    const mediaId = "0b6a3c9e-5a2d-4c3b-9f00-1d2e3f4a5b6c";
    const url = `https://media.nantty.com/m/${mediaId}/proof.jpg`;
    harness.media.add({ id: mediaId, ownerId: requesterId, purpose: "support", kind: "image", status: "ready" });
    const command = { accountId: requesterId, ticketId: ticket.id, text: "Here is the transfer receipt.", attachmentUrls: [url], idempotencyKey: "reply-attachment-retry-1" };
    await handlePostCustomerReply(harness.ticketDependencies, command);
    const lookupsAfterCommit = harness.media.lookups;
    harness.media.records.set(mediaId, { id: mediaId, ownerId: requesterId, purpose: "support", kind: "image", status: "deleted" });

    const replay = await handlePostCustomerReply(harness.ticketDependencies, command);

    expect(replay.messages.filter((message) => message.idempotencyKey === command.idempotencyKey)).toHaveLength(1);
    expect(harness.media.lookups).toBe(lookupsAfterCommit);
  });

  it("resolves with a ticket.resolved event, queues the auto-FAQ, allows rating, reopens within 7 days and then closes", async () => {
    const harness = await createSupportHarness();
    const ticket = await openTicket(harness);
    await expect(handleRateTicket(harness.ticketDependencies, { accountId: requesterId, ticketId: ticket.id, score: 5, comment: null })).rejects.toMatchObject({ code: "TICKET_NOT_RESOLVED" });
    const resolved = await handlePostStaffReply(harness.ticketDependencies, { staff, ticketId: ticket.id, body: "Refunds go back to the card you paid with and take up to 5 working days.", isInternalNote: false, statusAfterReply: "resolved" });
    expect(resolved).toMatchObject({ status: "resolved", autoFaqStatus: "queued" });
    expect(harness.ticketStore.events.map((event) => event.eventType)).toEqual(["ticket.created", "ticket.replied", "ticket.resolved"]);
    expect((await handleRateTicket(harness.ticketDependencies, { accountId: requesterId, ticketId: ticket.id, score: 4, comment: "Quick" })).satisfactionScore).toBe(4);
    harness.advanceMinutes(60);
    const reopened = await handlePostCustomerReply(harness.ticketDependencies, { accountId: requesterId, ticketId: ticket.id, text: "Still nothing.", attachmentUrls: [], idempotencyKey: null });
    expect(reopened.status).toBe("awaiting_support");
    expect(reopened.history.map((entry) => entry.action)).toContain("support.ticket_reopened");
    await handleChangeTicketStatus(harness.ticketDependencies, { actor: staff, ticketId: ticket.id, status: "closed", reason: null });
    await expect(handlePostCustomerReply(harness.ticketDependencies, { accountId: requesterId, ticketId: ticket.id, text: "hello?", attachmentUrls: [], idempotencyKey: null })).rejects.toMatchObject({ code: "TICKET_CLOSED" });
    await expect(handlePostStaffReply(harness.ticketDependencies, { staff, ticketId: ticket.id, body: "Hello again", isInternalNote: false, statusAfterReply: undefined })).rejects.toMatchObject({ code: "TICKET_CLOSED" });
  });

  it("refuses to reopen a ticket resolved more than 7 days ago and auto-closes old resolved tickets", async () => {
    const harness = await createSupportHarness();
    const ticket = await openTicket(harness);
    await handlePostStaffReply(harness.ticketDependencies, { staff, ticketId: ticket.id, body: "This is sorted now, thank you for waiting.", isInternalNote: false, statusAfterReply: "resolved" });
    harness.advanceMinutes(8 * 24 * 60);
    await expect(handlePostCustomerReply(harness.ticketDependencies, { accountId: requesterId, ticketId: ticket.id, text: "again", attachmentUrls: [], idempotencyKey: null })).rejects.toMatchObject({ code: "TICKET_CLOSED" });
    expect(await harness.ticketStore.closeResolvedTicketsBefore(new Date(harness.clock.now().getTime() - 7 * 86_400_000), harness.clock.now())).toBe(1);
  });

  it("only lets leads assign tickets to other agents", async () => {
    const harness = await createSupportHarness();
    const ticket = await openTicket(harness);
    await harness.ticketStore.recordAgentSeen({ staffId: lead.id, name: lead.name }, harness.clock.now());
    await expect(handleAssignTicket(harness.ticketDependencies, { staff, canAssignOthers: false, ticketId: ticket.id, assigneeId: lead.id, reason: null })).rejects.toMatchObject({ status: 403 });
    expect((await handleAssignTicket(harness.ticketDependencies, { staff, canAssignOthers: false, ticketId: ticket.id, assigneeId: staff.id, reason: null })).assigneeName).toBe(staff.name);
    expect((await handleAssignTicket(harness.ticketDependencies, { staff: lead, canAssignOthers: true, ticketId: ticket.id, assigneeId: lead.id, reason: null })).assigneeStaffId).toBe(lead.id);
  });

  it("turns a resolved ticket into a published help topic through the job", async () => {
    const harness = await createSupportHarness();
    const ticket = await openTicket(harness, { category: "order", subject: "How do I confirm delivery?", message: "Hi, I'm Amaka. How do I confirm delivery for order ZM-48213? Call 08031234567." });
    await handlePostStaffReply(harness.ticketDependencies, { staff, ticketId: ticket.id, body: "Hi Amaka, open Orders, choose the order and tap Confirm delivery. The seller is paid once you confirm.", isInternalNote: false, statusAfterReply: "resolved" });
    expect(await processQueuedAutoFaqTickets(harness.ticketStore, harness.publisher, harness.clock, silentLogger)).toBe(1);
    expect((await harness.ticketStore.findTicket(ticket.id))?.autoFaqStatus).toBe("published");
    const topics = [...harness.helpStore.topics.values()];
    expect(topics).toHaveLength(1);
    expect(topics[0]).toMatchObject({ origin: "resolved_question", status: "published" });
    expect(JSON.stringify(topics[0])).not.toMatch(/Amaka|48213|08031234567|Ngozi/);
  });
});
