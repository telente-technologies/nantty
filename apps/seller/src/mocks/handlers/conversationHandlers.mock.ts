import { appendMessageToConversation, findConversationRecordOrThrow, readConversationRecords } from "@/mocks/handlers/conversationMockStore.mock";
import { demoChatClient, demoTeammateId, hasRegisteredDevice, registerStoreChatKeyMockHandlers } from "@/mocks/handlers/storeChatKeys.mock";
import { MockHttpError, paginateMockList, readJsonObjectBody, requireMockStorePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { MockConversationRecord } from "@/mocks/seed/demoConversations.mock";
import type { ConversationMessage, ConversationMessageKind } from "@/types/conversation.type";

const plaintextFields = ["body", "text", "location", "poll", "document", "sharedContent"] as const;
const messageKinds = new Set<ConversationMessageKind>(["text", "voice", "image", "video", "shared", "location", "liveLocation", "document", "poll", "control"]);

const recipientsOf = (record: MockConversationRecord, viewerId: string) => {
  const team = [...new Set([viewerId, demoTeammateId])];
  return { userIds: [record.conversation.customer.id, ...team], storeTeamUserIds: team };
};

function baseMessage(record: MockConversationRecord, overrides: Partial<ConversationMessage> & Pick<ConversationMessage, "id" | "senderId" | "from" | "senderName" | "createdAt">): ConversationMessage {
  return { conversationId: record.conversation.id, kind: "text", expiresAt: null, encryption: null, media: null, document: null, linkPreview: null, moderationHidden: false, clientMessageId: null, ...overrides };
}

async function encryptSeedsFor(record: MockConversationRecord, viewerId: string, sellerName: string): Promise<void> {
  if (record.seeds.length === 0 || !hasRegisteredDevice(viewerId)) return;
  const recipients = recipientsOf(record, viewerId).userIds;
  for (const seed of record.seeds.splice(0)) {
    const senderId = seed.from === "customer" ? record.conversation.customer.id : demoTeammateId;
    const sender = await demoChatClient(senderId);
    const sent = await sender.encryptMessage({ kind: "group", conversationId: record.conversation.id, memberUserIds: recipients }, { text: seed.text, sentAt: seed.createdAt });
    await sent.confirmSent(seed.id);
    record.messages.push(baseMessage(record, { id: seed.id, senderId, from: seed.from, senderName: seed.from === "customer" ? record.conversation.customer.name : sellerName, createdAt: seed.createdAt, encryption: sent.encryption }));
  }
}

export function registerConversationMockHandlers(): void {
  registerStoreChatKeyMockHandlers();

  registerMockRoute("GET", "/seller/conversations", (request) => {
    requireMockStorePrincipal(request);
    const filter = request.query.get("filter");
    const records = readConversationRecords();
    const conversations = records
      .map((record) => record.conversation)
      .filter((conversation) => (filter === "unread" ? conversation.unreadCount > 0 : filter === "orders" ? conversation.orderId !== null : true))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const unreadConversationsCount = records.filter((record) => record.conversation.unreadCount > 0).length;
    return respondWithJson(200, { ...paginateMockList(conversations, request.query, 50), unreadConversationsCount });
  });

  registerMockRoute("GET", "/seller/conversations/:conversationId", async (request) => {
    const principal = requireMockStorePrincipal(request);
    const record = findConversationRecordOrThrow(request.params.conversationId ?? "");
    await encryptSeedsFor(record, principal.userId, "Ada (store)");
    const after = request.query.get("after");
    const afterIndex = after ? record.messages.findIndex((message) => message.id === after) : -1;
    const messages = afterIndex >= 0 ? record.messages.slice(afterIndex + 1) : record.messages;
    return respondWithJson(200, { conversation: { customerLastReadAt: null, ...record.conversation }, messages, nextCursor: null });
  });

  registerMockRoute("GET", "/seller/conversations/:conversationId/recipients", (request) => {
    const principal = requireMockStorePrincipal(request);
    return respondWithJson(200, recipientsOf(findConversationRecordOrThrow(request.params.conversationId ?? ""), principal.userId));
  });

  registerMockRoute("POST", "/seller/conversations/:conversationId/messages", (request) => {
    const principal = requireMockStorePrincipal(request);
    const record = findConversationRecordOrThrow(request.params.conversationId ?? "");
    const body = readJsonObjectBody(request);
    const plaintext = plaintextFields.filter((field) => body[field] !== undefined && body[field] !== null && body[field] !== "");
    if (plaintext.length > 0) throw new MockHttpError(422, "PLAINTEXT_NOT_ACCEPTED", "Store chats are end-to-end encrypted. Update the seller dashboard to reply: messages must be encrypted on your device.");
    const encryption = body.encryption as { deviceId?: unknown; ciphertext?: unknown } | undefined;
    if (!encryption || typeof encryption.deviceId !== "string" || typeof encryption.ciphertext !== "string" || encryption.ciphertext === "") throw new MockHttpError(422, "ENCRYPTION_REQUIRED", "Every chat message needs an encryption envelope.");
    if (!hasRegisteredDevice(principal.userId)) throw new MockHttpError(403, "DEVICE_NOT_REGISTERED", "This device is not registered for secure chat. Sign in again on this device.");
    const kind = typeof body.kind === "string" && messageKinds.has(body.kind as ConversationMessageKind) ? (body.kind as ConversationMessageKind) : "text";
    const idempotencyKey = request.headers.get("idempotency-key");
    const existing = idempotencyKey ? record.messages.find((message) => message.clientMessageId === idempotencyKey && message.senderId === principal.userId) : undefined;
    if (existing) return respondWithJson(201, existing);
    const mediaId = typeof body.mediaId === "string" ? body.mediaId : null;
    const media = mediaId ? readMockDatabase().media.get(mediaId) : undefined;
    if (mediaId && !media) throw new MockHttpError(422, "MEDIA_NOT_FOUND", "Upload the encrypted attachment first.");
    if ((kind === "image" || kind === "video" || kind === "document") && !media) throw new MockHttpError(422, "MEDIA_REQUIRED", "Upload the encrypted attachment first and send its media id.");
    const attachment = media === undefined ? {} : kind === "document" ? { document: { url: media.url } } : { media: { id: media.mediaId, type: kind === "video" ? ("video" as const) : ("image" as const), url: media.url } };
    const message = baseMessage(record, {
      ...attachment,
      id: `msg_${crypto.randomUUID().slice(0, 12)}`, senderId: principal.userId, kind, from: "seller", senderName: principal.actorName, createdAt: new Date().toISOString(),
      encryption: { deviceId: encryption.deviceId, ciphertext: encryption.ciphertext, protocol: "signal-v1" }, linkPreview: typeof body.linkPreview === "string" ? body.linkPreview : null, clientMessageId: idempotencyKey,
    });
    appendMessageToConversation(record, message);
    return respondWithJson(201, message);
  });

  registerMockRoute("GET", "/chat/content", (request) => {
    requireMockStorePrincipal(request);
    const kind = request.query.get("kind");
    if (kind === "order") {
      const order = readMockDatabase().onlineOrders.find((candidate) => candidate.id === request.query.get("id"));
      if (!order) return respondWithJson(200, { reference: { kind, id: request.query.get("id") }, availability: "unavailable", title: null, subtitle: null, imageUrl: null });
      const items = order.lines.reduce((sum, line) => sum + line.quantity, 0);
      return respondWithJson(200, { reference: { kind, id: order.id }, availability: "available", title: `Order ${order.orderNumber}`, subtitle: `${items} item${items === 1 ? "" : "s"} · ${order.status}`, imageUrl: order.lines[0]?.imageUrl ?? null, priceLabel: `${order.total.currency} ${(order.total.amountMinor / 100).toFixed(2)}` });
    }
    const product = kind === "product" ? readMockDatabase().products.find((candidate) => candidate.id === request.query.get("id")) : undefined;
    if (!product) return respondWithJson(200, { reference: { kind, id: request.query.get("id") }, availability: "unavailable", title: "", subtitle: null, imageUrl: null });
    return respondWithJson(200, { reference: { kind, id: product.id }, availability: "available", title: product.name, subtitle: product.categoryName, imageUrl: product.images[0]?.url ?? null, priceLabel: null });
  });

  registerMockRoute("POST", "/seller/conversations/:conversationId/read", (request) => {
    requireMockStorePrincipal(request);
    const record = findConversationRecordOrThrow(request.params.conversationId ?? "");
    record.conversation = { ...record.conversation, unreadCount: 0 };
    return respondWithJson(200, record.conversation);
  });
}
