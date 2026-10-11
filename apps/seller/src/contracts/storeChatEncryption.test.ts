import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ChatCryptoClient, createHttpKeyDirectory, MemoryKeyValueStore } from "@zudomart/chat-crypto";

import { findPermissionRequiredForApiCall } from "@/config/rolePermissions.config";
import { dispatchMockApiRequest } from "@/mocks/mockBackend.mock";
import { allowedApiPathPattern } from "@/server/bffGateway.service";
import type { Conversation, ConversationMessage, ConversationThread, DecryptedConversationMessage } from "@/types/conversation.type";
import { filterConversationsLocally, foldStoreThread, previewFor, withoutPayload } from "@/utils/storeChat.util";

class MockCallError extends Error {
  public constructor(public readonly status: number, public readonly body: unknown) {
    super(`HTTP ${status}`);
  }
}

async function callMock(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const [pathname, search = ""] = path.replace(/^\/api\/v1/, "").split("?");
  const encoded = body === undefined ? null : new TextEncoder().encode(JSON.stringify(body));
  const response = await dispatchMockApiRequest({ method, path: pathname ?? "", query: new URLSearchParams(search), headers: new Headers({ "content-type": "application/json", ...headers }), body: encoded });
  return { status: response.status, body: response.body as Record<string, unknown> };
}

async function signIn() {
  const login = await callMock("POST", "/auth/login", {}, { identifier: "adaeze@ifelifestyle.ng", password: "Zudomart2026!" });
  const { accessToken, user } = login.body as { accessToken: string; user: { id: string } };
  const headers = { authorization: `Bearer ${accessToken}` };
  const call = async <T>(method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<T> => {
    const response = await callMock(method, path, { ...headers, ...extra }, body);
    if (response.status >= 400) throw new MockCallError(response.status, response.body);
    return response.body as T;
  };
  const directory = createHttpKeyDirectory({
    get: (path) => call("GET", path), post: (path, body) => call("POST", path, body), put: (path, body) => call("PUT", path, body), delete: (path) => call<void>("DELETE", path),
    isNotFound: (error) => error instanceof MockCallError && error.status === 404,
  });
  const client = new ChatCryptoClient({ storage: { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() }, directory });
  await client.ensureReady(user.id);
  return { headers, call, client, viewerId: user.id };
}

describe("encrypted store inbox (mock backend)", () => {
  it("serves only ciphertext, which this browser's keys can read, and accepts only encrypted replies", async () => {
    const { headers, call, client, viewerId } = await signIn();
    const page = await call<{ data: Conversation[] }>("GET", "/seller/conversations");
    const conversation = page.data.find((candidate) => candidate.lastMessage !== null) as Conversation;
    assert.ok(conversation);
    assert.equal("body" in (conversation.lastMessage ?? {}), false);
    const thread = await call<ConversationThread>("GET", `/seller/conversations/${conversation.id}`);
    assert.ok(thread.messages.length > 0);
    assert.ok(thread.messages.every((message) => message.encryption?.ciphertext && !("body" in message)));
    const results = await client.decryptMessages(thread.messages.map((message) => ({ ...message, linkPreview: message.linkPreview ?? undefined })));
    const texts = thread.messages.map((message) => results.get(message.id)).map((result) => (result?.status === "decrypted" ? result.payload.text : result?.status));
    assert.ok(texts.every((text) => typeof text === "string" && text.length > 0 && text !== "failed"), JSON.stringify(texts));

    const recipients = await call<{ userIds: string[] }>("GET", `/seller/conversations/${conversation.id}/recipients`);
    assert.ok(recipients.userIds.includes(conversation.customer.id) && recipients.userIds.includes(viewerId));
    const encrypted = await client.encryptMessage({ kind: "group", conversationId: conversation.id, memberUserIds: recipients.userIds }, { text: "Your parcel ships tomorrow" });
    assert.equal(encrypted.encryption.ciphertext.includes("parcel"), false);
    const sent = await call<ConversationMessage>("POST", `/seller/conversations/${conversation.id}/messages`, { kind: "text", encryption: encrypted.encryption }, { "idempotency-key": "msg_test_1" });
    const replay = await call<ConversationMessage>("POST", `/seller/conversations/${conversation.id}/messages`, { kind: "text", encryption: encrypted.encryption }, { "idempotency-key": "msg_test_1" });
    assert.equal(replay.id, sent.id);

    const plaintext = await callMock("POST", `/seller/conversations/${conversation.id}/messages`, headers, { body: "Old dashboard reply" });
    assert.equal(plaintext.status, 422);
    assert.equal(plaintext.body.code, "PLAINTEXT_NOT_ACCEPTED");
    const missing = await callMock("POST", `/seller/conversations/${conversation.id}/messages`, headers, { kind: "text" });
    assert.equal(missing.body.code, "ENCRYPTION_REQUIRED");
  });
});

describe("store inbox client logic", () => {
  const base = (id: string, overrides: Partial<DecryptedConversationMessage> = {}): DecryptedConversationMessage => ({
    ...withoutPayload({ id, conversationId: "c1", senderId: "buyer", kind: "text", from: "customer", senderName: "Kemi", createdAt: `2026-10-11T10:00:0${id.length}Z`, expiresAt: null, encryption: null, media: null, document: null, linkPreview: null, moderationHidden: false, clientMessageId: null }, null),
    ...overrides,
  });

  it("hides control messages and tallies reactions from them", () => {
    const { visible, ledger } = foldStoreThread([base("m1", { text: "Hi" }), base("c22", { kind: "control", control: { type: "reaction", targetMessageId: "m1", emoji: "👍", remove: false } })]);
    assert.deepEqual(visible.map((message) => message.id), ["m1"]);
    assert.deepEqual(ledger.reactions("m1", "seller").map((reaction) => [reaction.emoji, reaction.count]), [["👍", 1]]);
  });

  it("searches on this device only, using cached decrypted previews", () => {
    const conversation: Conversation = { id: "c1", customer: { id: "b", name: "Kemi Ade", username: "kemi", avatarUrl: null }, orderId: null, orderNumber: "ZM-100", lastMessage: { kind: "image", from: "customer", createdAt: "2026-10-11T10:00:00Z" }, unreadCount: 1, updatedAt: "2026-10-11T10:00:00Z" };
    const previews = new Map([["c1", { text: "Is the ankara tote back?", createdAt: "2026-10-11T10:00:00Z" }]]);
    assert.equal(filterConversationsLocally([conversation], previews, "ankara").length, 1);
    assert.equal(filterConversationsLocally([conversation], new Map(), "ankara").length, 0);
    assert.equal(filterConversationsLocally([conversation], new Map(), "@kemi").length, 1);
    assert.equal(previewFor(conversation, new Map()), "Photo");
    assert.equal(previewFor(conversation, previews), "Is the ankara tote back?");
  });

  it("lets only the chat key directory and shared-card lookup through the BFF, for staff who can manage messages", () => {
    assert.ok(allowedApiPathPattern.test("/chat/keys/devices/abc123"));
    assert.ok(allowedApiPathPattern.test("/chat/keys/bundles"));
    assert.equal(findPermissionRequiredForApiCall("GET", "/chat/content"), "messages:manage");
    assert.equal(findPermissionRequiredForApiCall("POST", "/chat/content"), null);
    assert.equal(allowedApiPathPattern.test("/conversations/c1/messages"), false);
    assert.equal(findPermissionRequiredForApiCall("POST", "/chat/keys/bundles"), "messages:manage");
  });
});
