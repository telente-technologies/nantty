import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ChatCryptoClient, createHttpKeyDirectory, MemoryKeyValueStore } from "@zudomart/chat-crypto";

import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { getSignedInMockUser } from "@/mocks/fixtures.mock";
import type { Message } from "@/types";

const send = (method: string, path: string, body?: unknown) =>
  dispatchMockApiRequest(method, path, new URLSearchParams(), body === undefined ? null : new TextEncoder().encode(JSON.stringify(body)));

const directory = createHttpKeyDirectory({
  get: (path) => send("GET", path) as never,
  post: (path, body) => send("POST", path, body) as never,
  put: (path, body) => send("PUT", path, body) as never,
  delete: async (path) => void (await send("DELETE", path)),
  isNotFound: (error) => (error as { status?: number }).status === 404,
});

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

  it("rejects plaintext like the backend", async () => {
    const failure = await send("POST", "/api/v1/conversations/c_1/messages", { text: "plain" }).catch((error: unknown) => error);
    assert.equal((failure as { code?: string }).code, "PLAINTEXT_NOT_ACCEPTED");
  });
});
