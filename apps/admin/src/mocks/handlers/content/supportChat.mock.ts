import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { readMockAreaStore, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { MockHttpError, createMockId, failNotFound, matchesSearchText, paginateItems, readIsoNow, readJsonObjectBody, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockQueueCounter } from "@/mocks/mockQueueCounters.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { presentPlatformUserSummary } from "@/mocks/seed/demoPlatformUsers.mock";
import { buildDemoLiveChats, type MockLiveChatRecord } from "@/mocks/seed/supportOutreachSeed.mock";
import type { LiveChatDetail, LiveChatSummary } from "@/types/supportOutreach.type";

function readChats(): MockLiveChatRecord[] {
  return readMockAreaStore("support:liveChats", buildDemoLiveChats);
}

function findChatOrFail(request: MockRequest): MockLiveChatRecord {
  const chat = readChats().find((candidate) => candidate.id === request.params.chatId);
  if (!chat) failNotFound("Chat");
  return chat;
}

function presentSummary(chat: MockLiveChatRecord): LiveChatSummary {
  const user = readMockDatabase().platformUsers.find((candidate) => candidate.id === chat.userId);
  const admin = readMockDatabase().admins.find((candidate) => candidate.id === chat.assigneeId);
  const last = chat.messages[chat.messages.length - 1];
  if (!user || !last) throw new MockHttpError(500, "BAD_FIXTURE", "Chat fixture is incomplete.");
  return { id: chat.id, user: presentPlatformUserSummary(user), status: chat.status, assignee: admin ? { id: admin.id, name: admin.name, email: admin.email } : null, startedAt: chat.startedAt, lastMessageAt: last.createdAt, lastMessagePreview: last.body.slice(0, 90), topic: chat.topic };
}

function presentDetail(chat: MockLiveChatRecord): LiveChatDetail {
  return { chat: presentSummary(chat), messages: chat.messages, isRecorded: true, isEndToEndEncrypted: false, history: listMockAuditEntriesForTarget("liveChat", chat.id) };
}

function auditChat(request: MockRequest, chat: MockLiveChatRecord, action: string, after: unknown) {
  recordMockAuditEntry(request, { action: `support.chat_${action}`, area: "support", target: { type: "liveChat", id: chat.id, label: `@${presentSummary(chat).user.username}` }, after });
}

export function registerSupportChatMockHandlers(): void {
  registerMockQueueCounter({ key: "liveChats", label: "Live chats", href: "/support/chat", readCount: () => {
    const waiting = readChats().filter((chat) => chat.status === "WAITING");
    return { count: waiting.length, oldestAt: waiting.map((chat) => chat.startedAt).sort()[0] ?? null };
  } });

  registerMockRoute("GET", "/admin/support/chats", (request) => {
    requireMockPermission(request, "support:chat");
    const status = request.query.get("status") ?? "OPEN";
    const search = request.query.get("search");
    const items = readChats().filter((chat) => (status === "OPEN" ? chat.status !== "ENDED" : status === "ALL" || chat.status === status)).map(presentSummary).filter((chat) => matchesSearchText(search, chat.user.username, chat.user.displayName, chat.topic)).sort((first, second) => (first.status === "WAITING" ? 0 : 1) - (second.status === "WAITING" ? 0 : 1) || second.lastMessageAt.localeCompare(first.lastMessageAt));
    return respondWithJson(200, paginateItems(items, request));
  });

  registerMockRoute("GET", "/admin/support/chats/:chatId", (request) => {
    requireMockPermission(request, "support:chat");
    const chat = findChatOrFail(request);
    auditChat(request, chat, "opened", { transcriptViewed: true });
    return respondWithJson(200, presentDetail(chat));
  });

  registerMockRoute("POST", "/admin/support/chats/:chatId/claim", (request) => {
    const principal = requireMockPermission(request, "support:chat");
    const chat = findChatOrFail(request);
    if (chat.status === "ENDED") throw new MockHttpError(409, "CHAT_ENDED", "This chat has ended.");
    if (chat.assigneeId && chat.assigneeId !== principal.adminId) throw new MockHttpError(409, "CHAT_CLAIMED", "Another agent already took this chat.");
    chat.assigneeId = principal.adminId;
    chat.status = "ACTIVE";
    auditChat(request, chat, "claimed", { assignee: principal.name });
    return respondWithJson(200, presentDetail(chat));
  });

  registerMockRoute("POST", "/admin/support/chats/:chatId/messages", (request) => {
    const principal = requireMockPermission(request, "support:chat");
    const chat = findChatOrFail(request);
    if (chat.status === "ENDED") throw new MockHttpError(409, "CHAT_ENDED", "This chat has ended.");
    if (chat.assigneeId !== principal.adminId) throw new MockHttpError(409, "NOT_ASSIGNED", "Take this chat before replying.");
    const body = readRequiredTrimmedString(readJsonObjectBody(request), "body", 2000);
    chat.messages.push({ id: createMockId("cm"), authorKind: "AGENT", authorName: principal.name, body, createdAt: readIsoNow() });
    const reply = chat.scriptedReplies.shift();
    if (reply) chat.messages.push({ id: createMockId("cm"), authorKind: "CUSTOMER", authorName: presentSummary(chat).user.displayName, body: reply, createdAt: readIsoNow() });
    auditChat(request, chat, "message_sent", { length: body.length });
    return respondWithJson(200, presentDetail(chat));
  });

  registerMockRoute("POST", "/admin/support/chats/:chatId/end", (request) => {
    requireMockPermission(request, "support:chat");
    const chat = findChatOrFail(request);
    if (chat.status === "ENDED") throw new MockHttpError(409, "CHAT_ENDED", "This chat has already ended.");
    chat.status = "ENDED";
    auditChat(request, chat, "ended", { status: "ENDED" });
    return respondWithJson(200, presentDetail(chat));
  });
}
