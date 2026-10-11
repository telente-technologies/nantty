import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { Prisma, type Message } from "../../src/generated/prisma/client.js";
import type { ConversationRow } from "../../src/modules/conversations/repositories/conversation.repository.js";
import { requireSealedGroupAttributes } from "../../src/modules/conversations/services/groupAttributes.service.js";
import { createReactToMessageHandler } from "../../src/modules/messages/commands/reactToMessage/reactToMessage.handler.js";
import { createStopLiveLocationHandler } from "../../src/modules/messages/commands/stopLiveLocation/stopLiveLocation.handler.js";
import { createUpdateLiveLocationHandler } from "../../src/modules/messages/commands/updateLiveLocation/updateLiveLocation.handler.js";
import { createVoteOnPollHandler } from "../../src/modules/messages/commands/voteOnPoll/voteOnPoll.handler.js";
import { applyMessageDelivery } from "../../src/modules/messages/services/messageDelivery.service.js";
import { createGroupBodySchema, updateConversationBodySchema } from "../../src/modules/conversations/validators/conversations.validator.js";
import type { Db } from "../../src/types/database.type.js";

const plaintextColumns = ["location", "document", "sharedContent", "pollQuestion", "pollAllowMultiple", "text", "body", "emoji"];

describe("the server never stores chat plaintext", () => {
  it("has no plaintext message columns or reaction/poll tables", () => {
    const messageColumns = Object.keys(Prisma.MessageScalarFieldEnum);
    for (const column of plaintextColumns) expect(messageColumns).not.toContain(column);
    for (const model of ["MessageReaction", "MessagePollOption", "MessagePollVote"]) expect(Object.keys(Prisma.ModelName)).not.toContain(model);
    expect(Object.keys(Prisma.ConversationScalarFieldEnum)).toContain("encryptedAttributes");
    const chatSchema = readFileSync(new URL("../../prisma/schema/chat.prisma", import.meta.url), "utf8");
    expect(chatSchema).not.toMatch(/emoji|pollQuestion|sharedContent|\blocation\s+Json/);
  });

  it("forbids plaintext group names at the database level and wipes legacy rows", () => {
    const migration = readFileSync(new URL("../../prisma/migrations/20261011120000_chat_e2ee_rich_content/migration.sql", import.meta.url), "utf8");
    expect(migration).toContain(`CHECK ("kind" <> 'group' OR ("title" IS NULL AND "description" IS NULL))`);
    expect(migration).toMatch(/DELETE FROM "messages"\s+WHERE "ciphertext" IS NULL/);
  });

  it("answers old clients' plaintext reaction, vote and live-location calls with 410", async () => {
    const calls = [
      createReactToMessageHandler()({ viewerId: "a", messageId: "m", emoji: "🔥" }),
      createVoteOnPollHandler()({ viewerId: "a", messageId: "m", optionId: "o" }),
      createUpdateLiveLocationHandler()({ viewerId: "a", messageId: "m", latitude: 6.5, longitude: 3.3, address: "Lekki" }),
      createStopLiveLocationHandler()({ viewerId: "a", messageId: "m" }),
    ];
    for (const call of calls) await expect(call).rejects.toMatchObject({ status: 410, code: "ENCRYPTED_CLIENT_REQUIRED" });
  });

  it("refuses plaintext group names and accepts only sealed attributes", () => {
    const sealed = "A".repeat(120);
    expect(() => requireSealedGroupAttributes("Lagos crew", sealed)).toThrow(expect.objectContaining({ code: "PLAINTEXT_NOT_ACCEPTED" }));
    expect(() => requireSealedGroupAttributes(undefined, undefined)).toThrow(expect.objectContaining({ code: "ENCRYPTION_REQUIRED" }));
    expect(() => requireSealedGroupAttributes(undefined, "Lagos crew")).toThrow(expect.objectContaining({ code: "ENCRYPTION_REQUIRED" }));
    expect(requireSealedGroupAttributes(undefined, sealed)).toBe(sealed);
    expect(createGroupBodySchema.parse({ name: "Old client", memberIds: [] })).toMatchObject({ name: "Old client" });
    expect(updateConversationBodySchema.parse({ encryptedAttributes: sealed })).toMatchObject({ encryptedAttributes: sealed });
  });

  it("relays control messages without unread counts, previews, pushes or streaks", async () => {
    const touched: string[] = [];
    const db = new Proxy({}, { get: (_target, model: string) => new Proxy({}, { get: (_inner, method: string) => async () => void touched.push(`${model}.${method}`) }) }) as unknown as Db;
    const conversation = { id: "c1", kind: "direct", title: null, members: [{ accountId: "s", inboxFolder: "chats" }, { accountId: "r", inboxFolder: "chats" }] } as unknown as ConversationRow;
    const message = { id: "m1", conversationId: "c1", senderId: "s", kind: "control", createdAt: new Date() } as unknown as Message;
    const events = await applyMessageDelivery(db, { conversation, message, now: new Date(), isNewConversation: false, messageEnvelope: { id: "m1" }, actor: { id: "s", name: "Ada" }, mentions: { userIdsToNotify: [], mentionsAll: false } as never });
    expect(events.map((event) => event.eventType)).toEqual(["message.created"]);
    expect(events[0]?.data).toMatchObject({ recipientIds: ["r"] });
    expect(touched).toEqual([]);
  });
});

describe("encrypted group photos", () => {
  it("only accepts an encrypted chat upload the admin owns as the group photo", async () => {
    const { verifyEncryptedGroupPhoto } = await import("../../src/modules/conversations/services/groupAttributes.service.js");
    const media = (ownerId: string, kind = "encrypted") => ({ describe: async () => ({ id: "m1", ownerId, purpose: "chat", kind, status: "ready", sizeBytes: 10 }), signForParticipant: async () => "https://media/signed" });
    await expect(verifyEncryptedGroupPhoto({ chatMedia: media("admin") } as never, "admin", "m1")).resolves.toBeUndefined();
    await expect(verifyEncryptedGroupPhoto({ chatMedia: media("someone-else") } as never, "admin", "m1")).rejects.toMatchObject({ code: "MEDIA_NOT_OWNED" });
    await expect(verifyEncryptedGroupPhoto({ chatMedia: media("admin") } as never, "admin", null)).resolves.toBeUndefined();
  });
});

describe("send body schema keeps plaintext visible to the E2EE check", () => {
  it("does not strip plaintext fields, so old clients get 422 instead of a silently empty message", async () => {
    const { sendMessageBodySchema } = await import("../../src/modules/messages/validators/messages.validator.js");
    const { validateOutgoingMessage } = await import("../../src/modules/messages/services/messageValidation.service.js");
    const oldClient = { kind: "poll", text: "Which fabric?", poll: { question: "Which fabric?", options: ["Ankara", "Aso oke"] }, location: { latitude: 6.5, longitude: 3.3 }, document: { fileName: "a.pdf" }, sharedContent: { kind: "post", id: "p1" } };
    const body = sendMessageBodySchema.parse(oldClient) as Record<string, unknown>;
    for (const field of ["text", "poll", "location", "document", "sharedContent"]) expect(body[field]).toEqual(oldClient[field as keyof typeof oldClient]);
    const attempt = () => validateOutgoingMessage({ kind: "poll", encryption: undefined, media: undefined, linkPreview: undefined, plaintext: { text: body["text"], location: body["location"], poll: body["poll"], document: body["document"], sharedContent: body["sharedContent"] } }, new Date());
    expect(attempt).toThrow(expect.objectContaining({ status: 422, code: "PLAINTEXT_NOT_ACCEPTED", details: { fields: ["text", "location", "poll", "document", "sharedContent"] } }));
  });

  it("accepts every encrypted kind including control, and rejects unknown kinds", async () => {
    const { sendMessageBodySchema } = await import("../../src/modules/messages/validators/messages.validator.js");
    const encryption = { deviceId: "d1", ciphertext: "sealed", protocol: "signal-v1" };
    for (const kind of ["text", "voice", "image", "video", "shared", "location", "liveLocation", "document", "poll", "control"]) expect(sendMessageBodySchema.parse({ kind, encryption })).toMatchObject({ kind });
    expect(() => sendMessageBodySchema.parse({ kind: "system", encryption })).toThrow();
    expect(() => sendMessageBodySchema.parse({ kind: "reaction", encryption })).toThrow();
  });
});
