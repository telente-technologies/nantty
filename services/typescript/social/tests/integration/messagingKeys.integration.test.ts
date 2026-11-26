import { generateKeyPairSync, type KeyObject, randomUUID, sign } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createSocialDatabase } from "../../src/databases/prisma.database.js";
import { deterministicFeedRanker } from "../../src/integrations/deterministicFeedRanker.integration.js";
import { noPremiumEntitlements } from "../../src/integrations/premiumEntitlements.integration.js";
import { systemClock } from "../../src/interfaces/clock.interface.js";
import type { IdentityDirectory } from "../../src/interfaces/identityDirectory.interface.js";
import { conversationRepository } from "../../src/modules/conversations/repositories/conversation.repository.js";
import { createSendMessageHandler } from "../../src/modules/messages/commands/sendMessage/sendMessage.handler.js";
import { createClaimPreKeyBundlesHandler } from "../../src/modules/messagingKeys/commands/claimPreKeyBundles/claimPreKeyBundles.handler.js";
import { createAcknowledgeMailboxHandler, createDepositMailboxHandler, createReadMailboxHandler } from "../../src/modules/messagingKeys/commands/keyMailbox/keyMailbox.handler.js";
import { createRegisterDeviceHandler } from "../../src/modules/messagingKeys/commands/registerDevice/registerDevice.handler.js";
import { maximumClaimsPerTargetPerWindow } from "../../src/modules/messagingKeys/services/preKeyClaimLimit.service.js";

const enabled = process.env["RUN_INTEGRATION"] === "1" && process.env["DATABASE_URL"] !== undefined;
const rawKey = (key: KeyObject) => Buffer.from(key.export({ format: "jwk" }).x as string, "base64url");

function deviceRegistration(oneTimePreKeys: number) {
  const identity = generateKeyPairSync("ed25519");
  const signedPreKey = rawKey(generateKeyPairSync("x25519").publicKey);
  const keyId = Buffer.alloc(4);
  keyId.writeUInt32BE(7);
  const signature = sign(null, Buffer.concat([Buffer.from("nantty-signed-prekey-v1"), keyId, signedPreKey]), identity.privateKey);
  return {
    registrationId: 42, identityKey: rawKey(identity.publicKey).toString("base64"),
    signedPreKey: { keyId: 7, publicKey: signedPreKey.toString("base64"), signature: signature.toString("base64") },
    oneTimePreKeys: Array.from({ length: oneTimePreKeys }, (_, index) => ({ keyId: index + 1, publicKey: rawKey(generateKeyPairSync("x25519").publicKey).toString("base64") })),
  };
}

const emptyDirectory: IdentityDirectory = {
  findUserSummaries: async (ids) => new Map(ids.map((id) => [id, { id, name: id, username: id.slice(0, 8), avatarUrl: null, verified: false, isCreator: false }])),
  findAccountIdsByUsernames: async () => new Map(), searchUserSummaries: async () => [], findPrivateAccountIds: async () => new Set(), findMentionPrivacy: async () => new Map(),
  findMentionTargetStatuses: async () => new Map(), hasPersonalizationConsent: async () => false, findAccountsAllowingPersonalizedAds: async () => new Set<string>(), findCheckmarkColors: async () => new Map(), findProfileCheckmarkColors: async () => new Map(), findAccountCreatedAt: async () => undefined,
  findOwnedPostableProfile: async () => null, findProfilesByIds: async () => new Map(),
};

describe.skipIf(!enabled)("messaging keys (needs Postgres with the social schema migrated)", () => {
  it("rate-limits prekey claims, verifies the sending device and relays sender keys through the mailbox", async () => {
    const database = createSocialDatabase(process.env["DATABASE_URL"] as string);
    const context = { database, directory: emptyDirectory, clock: systemClock, premium: noPremiumEntitlements, ranker: deterministicFeedRanker };
    const [alice, bob] = [randomUUID(), randomUUID()];
    const register = createRegisterDeviceHandler(context);
    await register({ accountId: alice, deviceId: "alice-device-1", ...deviceRegistration(0) });
    const bobStatus = await register({ accountId: bob, deviceId: "bob-device-1", ...deviceRegistration(2) });
    expect(bobStatus.oneTimePreKeyCount).toBe(2);

    const claim = createClaimPreKeyBundlesHandler(context);
    const first = await claim({ requesterId: alice, devices: [{ userId: bob, deviceId: "bob-device-1" }] });
    expect(first.data[0]?.oneTimePreKey?.keyId).toBe(1);
    for (let index = 1; index < maximumClaimsPerTargetPerWindow; index++) await claim({ requesterId: alice, devices: [{ userId: bob, deviceId: "bob-device-1" }] });
    await expect(claim({ requesterId: alice, devices: [{ userId: bob, deviceId: "bob-device-1" }] })).rejects.toMatchObject({ status: 429, code: "PREKEY_CLAIMS_RATE_LIMITED" });

    const conversation = await conversationRepository.create(database.client, { kind: "group", createdById: alice, encryptedAttributes: "sealed-group-metadata" }, [
      { accountId: alice, role: "owner", inboxFolder: "chats" }, { accountId: bob, role: "member", inboxFolder: "chats" },
    ]);
    const send = createSendMessageHandler(context);
    const message = (deviceId: string, ciphertext = "{}") => ({ kind: "text" as const, text: undefined, encryption: { deviceId, ciphertext, protocol: "signal-v1" }, media: undefined, linkPreview: "sealed-preview", sharedContent: undefined, location: undefined, document: undefined, poll: undefined });
    await expect(send({ senderId: alice, conversationId: conversation.id, idempotencyKey: undefined, mentions: undefined, message: message("ghost-device") })).rejects.toMatchObject({ status: 403, code: "DEVICE_NOT_REGISTERED" });
    const sent = await send({ senderId: alice, conversationId: conversation.id, idempotencyKey: undefined, mentions: undefined, message: message("alice-device-1") });
    expect(sent.encryption?.deviceId).toBe("alice-device-1");
    const keyedSend = { senderId: alice, conversationId: conversation.id, idempotencyKey: "stable-client-message-id", mentions: undefined, message: message("alice-device-1") };
    const [firstRetry, concurrentRetry] = await Promise.all([send(keyedSend), send(keyedSend)]);
    expect(firstRetry.id).toBe(concurrentRetry.id);
    expect(await database.client.message.count({ where: { conversationId: conversation.id, senderId: alice, clientMessageId: keyedSend.idempotencyKey } })).toBe(1);
    await expect(send({ ...keyedSend, message: message("alice-device-1", "different-ciphertext") })).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_KEY_REUSED" });
    const event = await database.client.outboxEvent.findFirst({ where: { subject: conversation.id, eventType: "message.created" } });
    expect((event?.payload as { data?: { message?: { linkPreview?: string } } } | null)?.data?.message?.linkPreview).toBe("sealed-preview");

    const deposited = await createDepositMailboxHandler(context)({ senderId: alice, senderDeviceId: "alice-device-1", conversationId: conversation.id, entries: [{ userId: bob, deviceId: "bob-device-1", ciphertext: "distribution" }] });
    expect(deposited.accepted).toBe(1);
    await expect(createDepositMailboxHandler(context)({ senderId: alice, senderDeviceId: "alice-device-1", conversationId: conversation.id, entries: [{ userId: randomUUID(), deviceId: "x", ciphertext: "y" }] })).rejects.toMatchObject({ code: "RECIPIENT_NOT_A_MEMBER" });
    const mailbox = await createReadMailboxHandler(context)({ accountId: bob, deviceId: "bob-device-1" });
    expect(mailbox.data).toEqual([expect.objectContaining({ senderId: alice, senderDeviceId: "alice-device-1", conversationId: conversation.id, ciphertext: "distribution" })]);
    await createAcknowledgeMailboxHandler(context)({ accountId: bob, deviceId: "bob-device-1", ids: mailbox.data.map((entry) => entry.id) });
    expect((await createReadMailboxHandler(context)({ accountId: bob, deviceId: "bob-device-1" })).data).toHaveLength(0);
    await database.disconnect();
  }, 60_000);
});
