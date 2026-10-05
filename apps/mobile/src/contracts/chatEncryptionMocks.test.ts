import { ChatCryptoClient, createHttpKeyDirectory, MemoryKeyValueStore } from "@zudomart/chat-crypto";
import { webcrypto } from "node:crypto";

import { resolveMockApiRequest } from "@/mocks";
import { getSignedInMockUser } from "@/mocks/fixtures.mock";
import type { Message } from "@/types";

jest.mock("@/services/chatCrypto/mobileKeyStore", () => ({
  randomBytesFromDevice: (length: number) => require("node:crypto").webcrypto.getRandomValues(new Uint8Array(length)),
  createMobileChatCryptoStorage: () => ({ secrets: new (require("@zudomart/chat-crypto").MemoryKeyValueStore)(), records: new (require("@zudomart/chat-crypto").MemoryKeyValueStore)() }),
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
    const preview = { url: "https://zudomart.com/p/1", domain: "zudomart.com", title: "Ankara set", description: null, imageUrl: null };
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
});
