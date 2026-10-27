import { ChatCryptoClient, createHttpKeyDirectory, MemoryKeyValueStore } from "@nantty/chat-crypto";
import { webcrypto } from "node:crypto";

import { resolveMockApiRequest } from "@/mocks";
import { getSignedInMockUser } from "@/mocks/fixtures.mock";
import type { Message } from "@/types";

jest.mock("@/services/chatCrypto/mobileKeyStore", () => ({
  randomBytesFromDevice: (length: number) => require("node:crypto").webcrypto.getRandomValues(new Uint8Array(length)),
  createMobileChatCryptoStorage: () => ({ secrets: new (require("@nantty/chat-crypto").MemoryKeyValueStore)(), records: new (require("@nantty/chat-crypto").MemoryKeyValueStore)() }),
}));

const random = (length: number) => webcrypto.getRandomValues(new Uint8Array(length));
const call = <T>(method: string, path: string, body?: unknown) => resolveMockApiRequest<T>(method, path, body);

const directory = createHttpKeyDirectory({
  get: (path) => call("GET", path),
  post: (path, body) => call("POST", path, body),
  put: (path, body) => call("PUT", path, body),
  delete: async (path) => void (await call("DELETE", path)),
  isNotFound: (error) => (error as { status?: number }).status === 404,
});

jest.setTimeout(30_000);

describe("encrypted chat in mock mode", () => {
  it("encrypts text and link previews for the peer and stores only ciphertext", async () => {
    const client = new ChatCryptoClient({ storage: { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() }, directory, random });
    await client.ensureReady(getSignedInMockUser().id);
    const preview = { url: "https://nantty.com/p/1", domain: "nantty.com", title: "Ankara set", description: null, imageUrl: null };
    const encrypted = await client.encryptMessage({ kind: "direct", conversationId: "c_1", memberUserIds: ["u_21"] }, { text: "see this", linkPreview: preview });
    expect(encrypted.encryption.ciphertext).not.toContain("see this");
    expect(encrypted.linkPreview).not.toContain("Ankara");
    const stored = await call<Message>("POST", "/api/v1/conversations/c_1/messages", { kind: "text", encryption: encrypted.encryption, linkPreview: encrypted.linkPreview });
    expect(stored.text).toBe("");
    await encrypted.confirmSent(stored.id);
    const result = await client.decryptMessage(stored);
    expect(result.status === "decrypted" ? [result.payload.text, result.payload.linkPreview?.title] : result.status).toEqual(["see this", "Ankara set"]);
  });

  it("rejects plaintext messages and story replies like the backend", async () => {
    await expect(call("POST", "/api/v1/conversations/c_1/messages", { text: "plain" })).rejects.toMatchObject({ code: "PLAINTEXT_NOT_ACCEPTED" });
    await expect(call("POST", "/api/v1/stories/s_1/replies", { text: "plain" })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("rejects an old client's plaintext poll, location, document and shared item", async () => {
    const encryption = { deviceId: "d1", ciphertext: "sealed" };
    for (const body of [
      { kind: "poll", poll: { question: "Which?", allowMultipleAnswers: false, options: ["a", "b"] }, text: "Which?" },
      { kind: "location", location: { latitude: 6.5, longitude: 3.3, address: "Lekki" } },
      { kind: "document", mediaId: "m1", document: { fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 1 }, encryption },
      { kind: "shared", sharedContent: { kind: "post", id: "p1" }, encryption },
    ]) {
      await expect(call("POST", "/api/v1/conversations/c_1/messages", body)).rejects.toMatchObject({ status: 422, code: "PLAINTEXT_NOT_ACCEPTED" });
    }
    await expect(call("POST", "/api/v1/conversations/c_1/messages", { kind: "poll" })).rejects.toMatchObject({ code: "ENCRYPTION_REQUIRED" });
  });

  it("answers the old plaintext reaction, vote and live-location endpoints with 410", async () => {
    await expect(call("POST", "/api/v1/messages/m_1/reactions", { emoji: "🔥" })).rejects.toMatchObject({ status: 410, code: "ENCRYPTED_CLIENT_REQUIRED" });
    await expect(call("POST", "/api/v1/messages/m_1/poll-votes", { optionId: "o" })).rejects.toMatchObject({ status: 410 });
    await expect(call("PATCH", "/api/v1/messages/m_1/location", { latitude: 1, longitude: 1 })).rejects.toMatchObject({ status: 410 });
  });

  it("keeps group names sealed and shares only with an envelope per chat", async () => {
    await expect(call("POST", "/api/v1/conversations/groups", { name: "Lagos crew", memberIds: ["u_21"] })).rejects.toMatchObject({ code: "PLAINTEXT_NOT_ACCEPTED" });
    const created = await call<{ id: string; title: string | null; encryptedAttributes: string }>("POST", "/api/v1/conversations/groups", { encryptedAttributes: "A".repeat(96), memberIds: ["u_21"] });
    expect(created.title).toBeNull();
    expect(created.encryptedAttributes).toBe("A".repeat(96));
    await expect(call("POST", "/api/v1/chat/shares", { conversationIds: ["c_1"], reference: { kind: "post", id: "p_1" } })).rejects.toMatchObject({ code: "ENCRYPTION_REQUIRED" });
  });

  it("relays control messages without touching the chat preview", async () => {
    const before = (await call<{ id: string; lastMessage: string }[]>("GET", "/api/v1/conversations")).find((conversation) => conversation.id === "c_1");
    const control = await call<Message>("POST", "/api/v1/conversations/c_1/messages", { kind: "control", encryption: { deviceId: "d1", ciphertext: "sealed-reaction" } });
    expect(control.kind).toBe("control");
    const after = (await call<{ id: string; lastMessage: string }[]>("GET", "/api/v1/conversations")).find((conversation) => conversation.id === "c_1");
    expect(after?.lastMessage).toBe(before?.lastMessage);
  });

  it("encrypts store chats to the customer and the whole store team, and refuses plaintext store sends", async () => {
    const opened = await call<{ id: string; kind: string; store: { id: string; name: string; avatarUrl: string | null }; peer: { name: string } }>("POST", "/api/v1/conversations/stores/st_1");
    expect(opened.kind).toBe("business");
    expect(opened.store).toMatchObject({ id: "st_1", name: expect.any(String) });
    expect(opened.peer.name).toBe(opened.store.name);
    const recipients = await call<{ userIds: string[]; storeTeamUserIds: string[] }>("GET", `/api/v1/conversations/${opened.id}/recipients`);
    expect(recipients.userIds).toEqual(expect.arrayContaining(["u_store_owner", "u_store_agent", getSignedInMockUser().id]));
    await expect(call("POST", "/api/v1/conversations/stores/st_1/messages", { body: "Is this in stock?" })).rejects.toMatchObject({ code: "PLAINTEXT_NOT_ACCEPTED" });
    const client = new ChatCryptoClient({ storage: { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() }, directory, random });
    await client.ensureReady(getSignedInMockUser().id);
    const sealed = await client.encryptMessage({ kind: "group", conversationId: opened.id, memberUserIds: recipients.userIds }, { text: "Is this in stock?" });
    expect(sealed.encryption.ciphertext).not.toContain("stock");
    const sent = await call<Message>("POST", `/api/v1/conversations/${opened.id}/messages`, { kind: "text", encryption: sealed.encryption });
    expect(sent.text).toBe("");
  });

  it("stores only the encrypted group photo id and gives members a signed link", async () => {
    const created = await call<{ id: string; photoMediaId: string | null; photoUrl: string | null }>("POST", "/api/v1/conversations/groups", { encryptedAttributes: "B".repeat(96), memberIds: ["u_21"], photoMediaId: "md_photo" });
    expect(created.photoMediaId).toBe("md_photo");
    expect(created.photoUrl).toContain("md_photo");
    const cleared = await call<{ photoMediaId: string | null; photoUrl: string | null }>("PATCH", `/api/v1/conversations/${created.id}`, { photoMediaId: null, encryptedAttributes: "C".repeat(96) });
    expect(cleared).toMatchObject({ photoMediaId: null, photoUrl: null });
  });
});
