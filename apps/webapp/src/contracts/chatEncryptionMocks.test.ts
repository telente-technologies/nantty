import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { ChatCryptoClient, createHttpKeyDirectory, createPollOptions, defaultRandomSource, MemoryKeyValueStore } from "@zudomart/chat-crypto";

import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { getSignedInMockUser } from "@/mocks/fixtures.mock";
import type { ChatSettings, Conversation, Message } from "@/types";

const send = (method: string, path: string, body?: unknown, query = new URLSearchParams()) =>
  dispatchMockApiRequest(method, path, query, body === undefined ? null : new TextEncoder().encode(JSON.stringify(body)));
const failure = async (promise: Promise<unknown>) => (await promise.then(() => null, (error: unknown) => error)) as { status?: number; code?: string } | null;

const directory = createHttpKeyDirectory({
  get: (path) => send("GET", path) as never,
  post: (path, body) => send("POST", path, body) as never,
  put: (path, body) => send("PUT", path, body) as never,
  delete: async (path) => void (await send("DELETE", path)),
  isNotFound: (error) => (error as { status?: number }).status === 404,
});

async function readyClient() {
  const client = new ChatCryptoClient({ storage: { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() }, directory });
  await client.ensureReady(getSignedInMockUser().id);
  return client;
}

describe("encrypted chat in mock mode", () => {
  it("registers this device, encrypts for the peer's mock device and stores only ciphertext", async () => {
    const viewerId = getSignedInMockUser().id;
    const client = new ChatCryptoClient({ storage: { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() }, directory });
    const identity = await client.ensureReady(viewerId);
    const status = (await send("GET", `/api/v1/chat/keys/devices/${identity.deviceId}`)) as { oneTimePreKeyCount: number };
    assert.equal(status.oneTimePreKeyCount, 100);
    const encrypted = await client.encryptMessage({ kind: "direct", conversationId: "c_1", memberUserIds: ["u_21"] }, { text: "hello from the browser" });
    assert.ok(!encrypted.encryption.ciphertext.includes("hello from the browser"));
    const stored = (await send("POST", "/api/v1/conversations/c_1/messages", { kind: "text", encryption: encrypted.encryption })) as Message;
    assert.equal(stored.text, "");
    await encrypted.confirmSent(stored.id);
    const result = await client.decryptMessage(stored);
    assert.equal(result.status === "decrypted" ? result.payload.text : result.status, "hello from the browser");
  });

  it("rejects an old client's plaintext text, poll, location, document or shared item like the backend", async () => {
    const plaintext = [
      { text: "plain" },
      { kind: "poll", poll: { question: "q", allowMultipleAnswers: false, options: ["a", "b"] } },
      { kind: "location", location: { latitude: 6.5, longitude: 3.3, address: "Lekki" } },
      { kind: "document", mediaId: "med_1", document: { fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 10 } },
      { kind: "shared", sharedContent: { kind: "post", id: "p1" } },
    ];
    for (const body of plaintext) assert.equal((await failure(send("POST", "/api/v1/conversations/c_1/messages", body)))?.code, "PLAINTEXT_NOT_ACCEPTED");
    assert.equal((await failure(send("POST", "/api/v1/conversations/c_1/messages", { kind: "poll" })))?.code, "ENCRYPTION_REQUIRED");
  });

  it("answers the old plaintext reaction, vote and live-location endpoints with 410", async () => {
    for (const [method, path, body] of [
      ["POST", "/api/v1/messages/m_c1_1/reactions", { emoji: "🔥" }],
      ["DELETE", "/api/v1/messages/m_c1_1/reactions/%F0%9F%94%A5", undefined],
      ["POST", "/api/v1/messages/m_c1_1/poll-votes", { optionId: "o" }],
      ["PATCH", "/api/v1/messages/m_c1_1/location", { latitude: 1, longitude: 1 }],
      ["POST", "/api/v1/messages/m_c1_1/live-location/stop", undefined],
    ] as const) {
      assert.deepEqual(await failure(send(method, path, body)).then((error) => ({ status: error?.status, code: error?.code })), { status: 410, code: "ENCRYPTED_CLIENT_REQUIRED" });
    }
  });

  it("sends polls, votes, reactions and locations as ciphertext only", async () => {
    const client = await readyClient();
    const target = { kind: "direct" as const, conversationId: "c_1", memberUserIds: ["u_21"] };
    const poll = { question: "Ankara or lace?", allowMultipleAnswers: false, options: createPollOptions(["Ankara", "Lace"], defaultRandomSource) };
    const sealedPoll = await client.encryptMessage(target, { text: "", poll });
    const storedPoll = (await send("POST", "/api/v1/conversations/c_1/messages", { kind: "poll", encryption: sealedPoll.encryption })) as Message;
    const vote = await client.encryptMessage(target, { text: "", control: { type: "pollVote", targetMessageId: storedPoll.id, optionIds: [poll.options[0]!.id] } });
    const reaction = await client.encryptMessage(target, { text: "", control: { type: "reaction", targetMessageId: storedPoll.id, emoji: "🔥", remove: false } });
    const location = await client.encryptMessage(target, { text: "", location: { latitude: 6.4281, longitude: 3.4219, label: "Balogun Market" } });
    await send("POST", "/api/v1/conversations/c_1/messages", { kind: "control", encryption: vote.encryption });
    await send("POST", "/api/v1/conversations/c_1/messages", { kind: "control", encryption: reaction.encryption });
    await send("POST", "/api/v1/conversations/c_1/messages", { kind: "location", encryption: location.encryption });
    const page = (await send("GET", "/api/v1/conversations/c_1/messages")) as { data: Message[] };
    const stored = JSON.stringify(page.data);
    for (const secret of ["Ankara", "Balogun", "6.4281", "🔥", "pollVote"]) assert.ok(!stored.includes(secret), `server stored ${secret}`);
    assert.equal((await failure(send("POST", "/api/v1/conversations/c_1/messages", { kind: "control", encryption: vote.encryption, mediaId: "med_x" })))?.code, "MEDIA_NOT_ALLOWED");
  });

  it("creates groups with sealed attributes only and lets members open them with the group key", async () => {
    const client = await readyClient();
    assert.equal((await failure(send("POST", "/api/v1/conversations/groups", { name: "Lagos crew", memberIds: ["u_21"] })))?.code, "PLAINTEXT_NOT_ACCEPTED");
    const prepared = client.prepareNewGroup({ title: "Lagos crew", description: null, avatar: null });
    const created = (await send("POST", "/api/v1/conversations/groups", { encryptedAttributes: prepared.encryptedAttributes, memberIds: ["u_21"] })) as Conversation;
    assert.equal(created.title, null);
    assert.ok(!JSON.stringify(created).includes("Lagos crew"));
    assert.equal(await client.openGroupAttributes(created.id, created.encryptedAttributes), null);
    await client.rememberGroupKey(created.id, prepared.groupKey);
    assert.equal((await client.openGroupAttributes(created.id, created.encryptedAttributes))?.title, "Lagos crew");
    assert.equal((await failure(send("PATCH", `/api/v1/conversations/${created.id}`, { name: "Renamed in plaintext" })))?.code, "PLAINTEXT_NOT_ACCEPTED");
    const renamed = await client.sealGroupAttributes(created.id, { title: "Lagos crew 2", description: null, avatar: null }, { rotate: true });
    const updated = (await send("PATCH", `/api/v1/conversations/${created.id}`, { encryptedAttributes: renamed })) as Conversation;
    assert.equal((await client.openGroupAttributes(created.id, updated.encryptedAttributes))?.title, "Lagos crew 2");
    const search = (await send("GET", "/api/v1/conversations/search", undefined, new URLSearchParams({ q: "lagos" }))) as { conversations: unknown[] };
    assert.equal(search.conversations.length, 0);
  });

  it("encrypts store chats to the customer and the whole store team, never in plaintext", async () => {
    const client = await readyClient();
    const opened = (await send("POST", "/api/v1/conversations/stores/s_ada")) as Conversation;
    assert.equal(opened.kind, "business");
    assert.equal(opened.store?.id, "s_ada");
    assert.equal(opened.store?.name, "Adaeze Styles");
    assert.equal(opened.peer.name, "Adaeze Styles");
    assert.equal(((await send("POST", "/api/v1/conversations/stores/s_ada")) as Conversation).id, opened.id);
    const recipients = (await send("GET", `/api/v1/conversations/${opened.id}/recipients`)) as { userIds: string[]; storeTeamUserIds: string[] };
    assert.deepEqual(recipients.storeTeamUserIds, ["u_1"]);
    assert.ok(recipients.userIds.includes(getSignedInMockUser().id));
    assert.equal((await failure(send("POST", "/api/v1/conversations/stores/s_ada/messages", { body: "Is the kaftan in stock?" })))?.code, "PLAINTEXT_NOT_ACCEPTED");
    assert.equal((await failure(send("POST", `/api/v1/conversations/${opened.id}/messages`, { text: "Is the kaftan in stock?" })))?.code, "PLAINTEXT_NOT_ACCEPTED");
    const sealed = await client.encryptMessage({ kind: "group", conversationId: opened.id, memberUserIds: recipients.userIds.filter((id) => id !== getSignedInMockUser().id) }, { text: "Is the kaftan in stock?" });
    const stored = (await send("POST", `/api/v1/conversations/${opened.id}/messages`, { kind: "text", encryption: sealed.encryption })) as Message;
    assert.ok(!JSON.stringify(stored).includes("kaftan"));
  });

  it("stores the encrypted group photo id and never a plaintext photo", async () => {
    const client = await readyClient();
    const prepared = client.prepareNewGroup({ title: "Photo crew", description: null, avatar: { mediaId: "med_photo", pointer: { key: "k".repeat(43) + "=", digest: "d".repeat(43) + "=", sizeBytes: 10, contentType: "image/jpeg" } } });
    const created = (await send("POST", "/api/v1/conversations/groups", { encryptedAttributes: prepared.encryptedAttributes, memberIds: ["u_21"], photoMediaId: "med_photo" })) as Conversation;
    assert.equal(created.photoMediaId, "med_photo");
    await client.rememberGroupKey(created.id, prepared.groupKey);
    assert.equal((await client.openGroupAttributes(created.id, created.encryptedAttributes))?.avatar?.mediaId, "med_photo");
    const cleared = (await send("PATCH", `/api/v1/conversations/${created.id}`, { photoMediaId: null })) as Conversation;
    assert.equal(cleared.photoMediaId, null);
  });

  it("requires an encrypted envelope for every chat a post is shared to", async () => {
    assert.equal((await failure(send("POST", "/api/v1/chat/shares", { conversationIds: ["c_1"], reference: { kind: "post", id: "p_1" } })))?.code, "ENCRYPTION_REQUIRED");
  });

  it("saves chat settings and mutes", async () => {
    const saved = (await send("PATCH", "/api/v1/chat/settings", { messageRequestsFrom: "followers", notifications: { showMessagePreview: false } })) as ChatSettings;
    assert.equal(saved.messageRequestsFrom, "followers");
    assert.equal(saved.notifications.showMessagePreview, false);
    assert.equal(saved.notifications.messages, true);
    const muted = (await send("PUT", "/api/v1/conversations/c_1/mute", { duration: "always" })) as { mutedUntil: string };
    assert.equal(muted.mutedUntil, "always");
  });

  it("never keeps decrypted chat content in plain browser storage", () => {
    const root = join(process.cwd(), "src");
    const files = [
      ...readdirSync(join(root, "components/messages")).map((name) => join(root, "components/messages", name)),
      ...readdirSync(join(root, "services/chatCrypto")).map((name) => join(root, "services/chatCrypto", name)),
      join(root, "services/messages.service.ts"),
      join(root, "services/chatGroups.service.ts"),
      join(root, "utils/chatThread.util.ts"),
      join(root, "utils/chatOptimistic.util.ts"),
      join(root, "utils/groupPhoto.util.ts"),
    ].filter((path) => /\.tsx?$/.test(path));
    for (const path of files) assert.ok(!/localStorage|sessionStorage/.test(readFileSync(path, "utf8")), `${path} touches web storage`);
  });
});
