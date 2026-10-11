import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ChatCryptoClient, decryptAttachment, encryptAttachment, encryptedAttachmentMimeType, InMemoryKeyDirectory, MemoryKeyValueStore } from "@zudomart/chat-crypto";

import { grantsChatMediaAccess } from "@/config/rolePermissions.config";
import { dispatchMockApiRequest } from "@/mocks/mockBackend.mock";
import { allowedApiPathPattern } from "@/server/bffGateway.service";
import { broadcastFrame, createTabLeader, type LeaderChannel, type LeaderLocks } from "@/services/chatCrypto/tabLeader";
import { createInboxRealtimeConnection, reconnectDelay } from "@/services/realtime/inboxRealtimeConnection";
import type { ConversationMessage, DecryptedConversationMessage } from "@/types/conversation.type";
import { mergeThreadMessages, withoutDeliveredPending } from "@/utils/storeChat.util";

const flush = () => new Promise((resolve) => setTimeout(resolve, 5));

function createBrowser() {
  const endpoints = new Set<{ deliver: (data: unknown) => void }>();
  const waiting: (() => void)[] = [];
  let held = false;
  const locks: LeaderLocks = {
    request: (_name, _options, callback) => new Promise((resolve) => {
      const run = () => {
        held = true;
        void callback().then(() => {
          held = false;
          resolve(undefined);
          waiting.shift()?.();
        });
      };
      if (held) waiting.push(run);
      else run();
    }),
  };
  const channel = (): LeaderChannel => {
    const listeners: ((event: { data: unknown }) => void)[] = [];
    const endpoint = { deliver: (data: unknown) => listeners.forEach((listener) => listener({ data: structuredClone(data) })) };
    endpoints.add(endpoint);
    return {
      postMessage: (data) => endpoints.forEach((other) => other !== endpoint && setTimeout(() => other.deliver(data), 0)),
      addEventListener: (_type, listener) => void listeners.push(listener),
      close: () => void endpoints.delete(endpoint),
    };
  };
  return { locks, channel };
}

const conversationId = "0192a4f0-0000-7000-8000-00000000cccc";

describe("two dashboard tabs share one secure chat device", () => {
  it("lets only the leader tab touch ratchet state; the other tab follows and takes over cleanly", async () => {
    const directory = new InMemoryKeyDirectory();
    const sharedBrowserStorage = { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() };
    const customer = new ChatCryptoClient({ storage: { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() }, directory: directory.forUser("customer") });
    await customer.ensureReady("customer");
    const clientsCreated: string[] = [];
    const handlersFor = (tab: string) => {
      let client: ChatCryptoClient | null = null;
      const ready = async () => {
        if (client === null) {
          clientsCreated.push(tab);
          client = new ChatCryptoClient({ storage: sharedBrowserStorage, directory: directory.forUser("staff") });
        }
        await client.ensureReady("staff");
        return client;
      };
      return {
        ensureReady: async () => void (await ready()),
        decrypt: async (message: { id: string; senderId: string; encryption: never }) => {
          const result = (await (await ready()).decryptMessages([{ ...message, conversationId }])).get(message.id);
          return result?.status === "decrypted" ? result.payload.text : `failed:${result?.status}`;
        },
      };
    };
    const browser = createBrowser();
    const tabA = createTabLeader({ name: "engine", channel: browser.channel(), locks: browser.locks, handlers: handlersFor("A"), tabId: "A" });
    await flush();
    const tabB = createTabLeader({ name: "engine", channel: browser.channel(), locks: browser.locks, handlers: handlersFor("B"), tabId: "B" });
    await flush();
    assert.equal(tabA.isLeader(), true);
    assert.equal(tabB.isLeader(), false);
    await tabB.call("ensureReady");

    const send = async (id: string, text: string) => {
      const sent = await customer.encryptMessage({ kind: "group", conversationId, memberUserIds: ["customer", "staff"] }, { text });
      await sent.confirmSent(id);
      return { id, senderId: "customer", encryption: sent.encryption as never };
    };
    const first = await send("m-1", "Is the blue dress in stock?");
    assert.equal(await tabB.call("decrypt", first), "Is the blue dress in stock?");
    assert.equal(await tabA.call("decrypt", first), "Is the blue dress in stock?");
    assert.deepEqual(clientsCreated, ["A"]);

    tabA.close();
    await flush();
    assert.equal(tabB.isLeader(), true);
    const second = await send("m-2", "Can it ship today?");
    assert.equal(await tabB.call("decrypt", second), "Can it ship today?");
    assert.deepEqual(clientsCreated, ["A", "B"]);
    tabB.close();
  });

  it("re-sends a call that was in flight when the leader tab closed", async () => {
    const browser = createBrowser();
    let release: (() => void) | null = null;
    const ran: string[] = [];
    const tabA = createTabLeader({ name: "engine", channel: browser.channel(), locks: browser.locks, tabId: "A", handlers: { work: () => (ran.push("A"), new Promise<void>((resolve) => (release = resolve))) } });
    await flush();
    const tabB = createTabLeader({ name: "engine", channel: browser.channel(), locks: browser.locks, tabId: "B", handlers: { work: async () => void ran.push("B") } });
    await flush();
    const pending = tabB.call("work");
    await flush();
    tabA.close();
    await pending;
    assert.deepEqual(ran, ["A", "B"]);
    (release as (() => void) | null)?.();
    tabB.close();
  });

  it("tells the leader tab to drop its keys when another tab, even one that never opened chat, signs out", async () => {
    const browser = createBrowser();
    const leader = createTabLeader({ name: "engine", channel: browser.channel(), locks: browser.locks, tabId: "A", handlers: {} });
    const dropped: string[] = [];
    leader.onBroadcast("signed-out", () => dropped.push("A"));
    await flush();
    const signingOutTab = browser.channel();
    signingOutTab.postMessage(broadcastFrame("signed-out", null));
    await flush();
    assert.deepEqual(dropped, ["A"]);
    leader.close();
  });

  it("removes this browser's device from the key directory on sign-out even when chat was never opened in this page", async () => {
    const directory = new InMemoryKeyDirectory();
    const storage = { secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() };
    await new ChatCryptoClient({ storage, directory: directory.forUser("staff") }).ensureReady("staff");
    assert.equal((await directory.forUser("x").listDevices(["staff"]))[0]?.devices.length, 1);
    await new ChatCryptoClient({ storage, directory: directory.forUser("staff") }).signOut({ removeFromDirectory: true });
    assert.equal((await directory.forUser("x").listDevices(["staff"]))[0]?.devices.length, 0);
  });
});

class FakeSocket {
  public static opened: FakeSocket[] = [];
  public readyState = 0;
  public sent: Record<string, unknown>[] = [];
  public onopen: (() => void) | null = null;
  public onmessage: ((frame: { data: unknown }) => void) | null = null;
  public onclose: ((event: { code?: number }) => void) | null = null;
  public onerror: (() => void) | null = null;
  public constructor(public readonly url: string) {
    FakeSocket.opened.push(this);
  }
  public send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  public close() {
    this.readyState = 3;
    this.onclose?.({ code: 1006 });
  }
  public open() {
    this.readyState = 1;
    this.onopen?.();
  }
  public receive(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

describe("store inbox realtime connection", () => {
  it("authenticates, subscribes after auth, forwards chat events and reconnects with backoff after going offline", async () => {
    FakeSocket.opened = [];
    const statuses: string[] = [];
    const events: unknown[] = [];
    const delays: number[] = [];
    const scheduled: (() => void)[] = [];
    const connection = createInboxRealtimeConnection({
      fetchTicket: async () => ({ kind: "ticket", ticket: { url: "wss://api.example/ws", realtimeToken: "token-1" } }),
      onEvent: (event) => events.push(event),
      onStatus: (status) => statuses.push(status),
      openSocket: (url) => new FakeSocket(url),
      random: () => 0.5,
      schedule: (run, delay) => (delays.push(delay), scheduled.push(run), 0 as never),
    });
    connection.setTopics(new Set([`conversation:${conversationId}`]));
    connection.start();
    await flush();
    const socket = FakeSocket.opened[0] as FakeSocket;
    socket.open();
    assert.deepEqual(socket.sent[0], { type: "auth", accessToken: "token-1" });
    assert.equal(socket.sent.length, 1, "no subscribe before auth.ok");
    socket.receive({ type: "auth.ok" });
    assert.deepEqual(socket.sent[1], { type: "subscribe", topic: `conversation:${conversationId}` });
    connection.sendTyping(conversationId, true);
    assert.deepEqual(socket.sent[2], { type: "typing", conversationId, isTyping: true });
    socket.receive({ type: "message.created", conversationId, message: { id: "m-9", senderId: "customer", kind: "text" } });
    socket.receive({ type: "pong" });
    assert.equal(events.length, 1);

    socket.close();
    assert.deepEqual(statuses, ["connecting", "live", "polling"]);
    assert.equal(delays[0], reconnectDelay(0, () => 0.5));
    scheduled.shift()?.();
    await flush();
    const second = FakeSocket.opened[1] as FakeSocket;
    second.open();
    second.receive({ type: "auth.ok" });
    assert.ok(second.sent.some((frame) => frame.type === "subscribe"));
    assert.equal(statuses.at(-1), "live");
    connection.stop();
  });

  it("falls back to polling for minutes when live updates are unavailable", async () => {
    const delays: number[] = [];
    const statuses: string[] = [];
    const connection = createInboxRealtimeConnection({ fetchTicket: async () => ({ kind: "unavailable" }), onEvent: () => undefined, onStatus: (status) => statuses.push(status), schedule: (_run, delay) => (delays.push(delay), 0 as never) });
    connection.start();
    await flush();
    assert.equal(delays[0], 5 * 60_000);
    assert.equal(statuses.at(-1), "polling");
    connection.stop();
  });

  it("caps backoff at 30 seconds with jitter", () => {
    assert.equal(reconnectDelay(0, () => 0), 500);
    assert.equal(reconnectDelay(10, () => 1), 30_000);
    assert.equal(reconnectDelay(10, () => 0), 15_000);
  });
});

const message = (id: string, createdAt: string, clientMessageId: string | null = null) => ({ id, createdAt, clientMessageId }) as unknown as ConversationMessage;

describe("thread merging after reconnect", () => {
  it("keeps one copy of each message in time order and drops pending copies the server confirmed", () => {
    const existing = [message("b", "2026-10-11T10:01:00Z"), message("a", "2026-10-11T10:00:00Z")];
    const caughtUp = [message("b", "2026-10-11T10:01:00Z"), message("c", "2026-10-11T10:02:00Z", "msg_1"), message("d", "2026-10-11T10:02:00Z")];
    assert.deepEqual(mergeThreadMessages(existing, caughtUp).map((entry) => entry.id), ["a", "b", "c", "d"]);
    const pending = [{ clientMessageId: "msg_1" }, { clientMessageId: "msg_2" }] as unknown as DecryptedConversationMessage[];
    assert.deepEqual(withoutDeliveredPending(pending, caughtUp).map((entry) => entry.clientMessageId), ["msg_2"]);
  });
});

describe("dashboard gateway for the inbox", () => {
  it("lets inbox staff read shared cards and upload chat media without product permissions", () => {
    assert.ok(allowedApiPathPattern.test("/chat/content"));
    const sales = { role: "sales", permissions: null } as never;
    assert.equal(grantsChatMediaAccess(sales, "/media/uploads"), true);
    assert.equal(grantsChatMediaAccess(sales, "/media/uploads/upl_1/chunks/0"), true);
    assert.equal(grantsChatMediaAccess(sales, "/media/m_1/encrypted-blob"), true);
    assert.equal(grantsChatMediaAccess(sales, "/media/m_1"), false);
    assert.equal(grantsChatMediaAccess({ role: "inventory", permissions: null } as never, "/media/uploads"), false);
  });
});

async function mockCall(method: string, path: string, headers: Record<string, string>, body?: unknown, raw?: Uint8Array) {
  const [pathname, search = ""] = path.split("?");
  const response = await dispatchMockApiRequest({ method, path: pathname ?? "", query: new URLSearchParams(search), headers: new Headers({ "content-type": raw ? "application/octet-stream" : "application/json", ...headers }), body: raw ?? (body === undefined ? null : new TextEncoder().encode(JSON.stringify(body))) });
  return response;
}

describe("encrypted attachments (mock backend)", () => {
  it("abandons a failed upload without sending, then delivers an encrypted file the dashboard can open", async () => {
    const login = await mockCall("POST", "/auth/login", {}, { identifier: "adaeze@ifelifestyle.ng", password: "Zudomart2026!" });
    const auth = { authorization: `Bearer ${(login.body as { accessToken: string }).accessToken}` };
    const { blob, pointer } = encryptAttachment(new TextEncoder().encode("%PDF-1.7 invoice"), { contentType: "application/pdf", fileName: "invoice.pdf", width: null, height: null, thumbnail: null, durationSeconds: null });
    const start = async () => (await mockCall("POST", "/media/uploads", auth, { fileName: "attachment.bin", mimeType: encryptedAttachmentMimeType, sizeBytes: blob.byteLength, purpose: "chat" })).body as { uploadId: string };
    const plaintextUpload = await mockCall("POST", "/media/uploads", auth, { fileName: "invoice.pdf", mimeType: "application/pdf", sizeBytes: 10, purpose: "chat" });
    assert.equal(plaintextUpload.status, 415);

    const failed = await start();
    const damaged = await mockCall("PUT", `/media/uploads/${failed.uploadId}/chunks/0`, { ...auth, "x-chunk-sha256": "0".repeat(64) }, undefined, blob);
    assert.equal(damaged.status, 422);
    assert.equal((await mockCall("DELETE", `/media/uploads/${failed.uploadId}`, auth)).status, 204);
    assert.equal((await mockCall("POST", `/media/uploads/${failed.uploadId}/complete`, auth)).status, 404);

    const upload = await start();
    const { createHash } = await import("node:crypto");
    await mockCall("PUT", `/media/uploads/${upload.uploadId}/chunks/0`, { ...auth, "x-chunk-sha256": createHash("sha256").update(blob).digest("hex") }, undefined, blob);
    const completed = (await mockCall("POST", `/media/uploads/${upload.uploadId}/complete`, auth)).body as { mediaId: string };
    const stored = await mockCall("GET", `/media/${completed.mediaId}/encrypted-blob`, auth);
    const bytes = stored.body as Uint8Array;
    assert.equal(new TextDecoder().decode(decryptAttachment(bytes, pointer)), "%PDF-1.7 invoice");
    assert.equal(new TextDecoder().decode(bytes).includes("invoice"), false);
  });
});
