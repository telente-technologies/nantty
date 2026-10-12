import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRealtimeConnection, type RealtimeConnectionOptions, type RealtimeSocketLike, type TicketRequest, type TicketResult } from "@zudomart/web-kit/src/realtime/realtimeConnection";
import { createRealtimeHub, type RealtimeEvent } from "@zudomart/web-kit/src/realtime/realtimeHub";
import { createRealtimeTicketFetcher } from "@zudomart/web-kit/src/realtime/realtimeTicket";

import type { CategorizedNotification } from "@/types/commerce.type";
import { prependLiveComment, readRealtimeLiveComment, readRealtimeNotification, upsertNotification } from "@/utils/realtimeCache.util";

const flush = () => new Promise((resolve) => setTimeout(resolve, 5));
const ticket = (realtimeToken = "ticket-1"): TicketResult => ({ kind: "ticket", ticket: { url: "wss://api.example/ws", realtimeToken } });

class FakeSocket implements RealtimeSocketLike {
  public static opened: FakeSocket[] = [];
  public readyState = 0;
  public sent: Record<string, unknown>[] = [];
  public onopen: (() => void) | null = null;
  public onmessage: ((frame: { readonly data: unknown }) => void) | null = null;
  public onclose: ((event: { readonly code?: number }) => void) | null = null;
  public onerror: (() => void) | null = null;
  public closed = false;
  public constructor(public readonly url: string) {
    FakeSocket.opened.push(this);
  }
  public send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  public close(code = 1006) {
    if (this.closed) return;
    this.closed = true;
    this.readyState = 3;
    this.onclose?.({ code });
  }
  public authenticate() {
    this.readyState = 1;
    this.onopen?.();
    this.receive({ type: "auth.ok" });
  }
  public receive(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

function createFakeEnvironment() {
  const listeners = new Map<string, Set<() => void>>();
  return {
    document: { visibilityState: "visible" as DocumentVisibilityState },
    addEventListener: (type: string, listener: () => void) => void (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(listener),
    removeEventListener: (type: string, listener: () => void) => void listeners.get(type)?.delete(listener),
    dispatch: (type: string) => listeners.get(type)?.forEach((listener) => listener()),
  };
}

function createTestHub(fetchTicket: (request: TicketRequest) => Promise<TicketResult>, onSessionEnded?: () => void) {
  const scheduled: { run: () => void; delay: number }[] = [];
  const environment = createFakeEnvironment();
  const hub = createRealtimeHub({
    fetchTicket,
    onSessionEnded,
    environment: environment as never,
    createConnection: (options: RealtimeConnectionOptions<RealtimeEvent>) =>
      createRealtimeConnection({ ...options, openSocket: (url) => new FakeSocket(url), random: () => 0.5, schedule: (run, delay) => (scheduled.push({ run, delay }), 0 as never) }),
  });
  return { hub, scheduled, environment };
}

describe("web realtime client", () => {
  it("keeps polling when the socket is down at load and reconnects with backoff", async () => {
    FakeSocket.opened = [];
    const { hub, scheduled } = createTestHub(async () => ticket());
    hub.setEnabled(true);
    await flush();
    FakeSocket.opened[0]!.close();
    assert.equal(hub.status(), "polling");
    assert.equal(scheduled.length, 1);
    scheduled.shift()!.run();
    await flush();
    FakeSocket.opened[1]!.close();
    assert.ok(scheduled[0]!.delay > 1_000, "second attempt backs off further");
    scheduled.shift()!.run();
    await flush();
    FakeSocket.opened[2]!.authenticate();
    assert.equal(hub.status(), "live");
    hub.setEnabled(false);
  });

  it("asks for a fresh ticket after the server rejects an expired one", async () => {
    FakeSocket.opened = [];
    const requests: TicketRequest[] = [];
    const { hub, scheduled } = createTestHub(async (request) => (requests.push(request), ticket(request.fresh ? "fresh" : "cached")));
    hub.setEnabled(true);
    await flush();
    const first = FakeSocket.opened[0]!;
    first.readyState = 1;
    first.onopen?.();
    first.receive({ type: "auth.failed" });
    first.close(4401);
    scheduled.shift()!.run();
    await flush();
    assert.deepEqual(requests.map((request) => request.fresh), [false, true]);
    const second = FakeSocket.opened[1]!;
    second.readyState = 1;
    second.onopen?.();
    assert.deepEqual(second.sent[0], { type: "auth", accessToken: "fresh" });
    hub.setEnabled(false);
  });

  it("honours Retry-After when the ticket endpoint answers 429", async () => {
    const fetcher = createRealtimeTicketFetcher({
      endpoint: "/bff/realtime",
      readCsrfToken: () => "csrf",
      fetchImplementation: (async () => new Response(JSON.stringify({ code: "RATE_LIMITED" }), { status: 429, headers: { "retry-after": "20" } })) as typeof fetch,
    });
    assert.deepEqual(await fetcher({ fresh: false }), { kind: "retry", retryAfterMs: 20_000 });
    FakeSocket.opened = [];
    const { hub, scheduled } = createTestHub(fetcher);
    hub.setEnabled(true);
    await flush();
    assert.equal(FakeSocket.opened.length, 0);
    assert.equal(scheduled[0]!.delay, 20_000);
    assert.equal(hub.status(), "polling");
    hub.setEnabled(false);
  });

  it("maps ticket endpoint answers: 401 ends, 404 means unavailable, a non-websocket url is refused", async () => {
    const answer = (status: number, body: unknown) => createRealtimeTicketFetcher({ endpoint: "/bff/realtime", readCsrfToken: () => "csrf", fetchImplementation: (async () => new Response(JSON.stringify(body), { status })) as typeof fetch });
    assert.equal((await answer(401, {})({ fresh: false })).kind, "ended");
    assert.equal((await answer(404, {})({ fresh: false })).kind, "unavailable");
    assert.equal((await answer(200, { url: "https://evil.example", realtimeToken: "t" })({ fresh: false })).kind, "retry");
    const noCsrf = createRealtimeTicketFetcher({ endpoint: "/bff/realtime", readCsrfToken: () => null, fetchImplementation: (async () => assert.fail("no request without a session")) as typeof fetch });
    assert.equal((await noCsrf({ fresh: false })).kind, "ended");
  });

  it("opens one socket per tab however many components ask, and two tabs each keep their own", async () => {
    FakeSocket.opened = [];
    let release: (result: TicketResult) => void = () => undefined;
    const tabA = createTestHub(() => new Promise((resolve) => (release = resolve)));
    tabA.hub.setEnabled(true);
    tabA.environment.dispatch("online");
    tabA.environment.dispatch("visibilitychange");
    release(ticket());
    await flush();
    assert.equal(FakeSocket.opened.length, 1, "a racing reconnect must not open a second socket");
    const stopOne = tabA.hub.watchTopic("live:abc");
    const stopTwo = tabA.hub.watchTopic("live:abc");
    FakeSocket.opened[0]!.authenticate();
    assert.equal(FakeSocket.opened[0]!.sent.filter((frame) => frame.type === "subscribe").length, 1);
    stopOne();
    assert.equal(FakeSocket.opened[0]!.sent.filter((frame) => frame.type === "unsubscribe").length, 0);
    stopTwo();
    assert.equal(FakeSocket.opened[0]!.sent.filter((frame) => frame.type === "unsubscribe").length, 1);

    const tabB = createTestHub(async () => ticket());
    tabB.hub.setEnabled(true);
    await flush();
    assert.equal(FakeSocket.opened.length, 2);
    FakeSocket.opened[0]!.close(4409);
    assert.equal(tabA.scheduled.length, 0, "a tab replaced by the per-user cap waits instead of fighting back");
    tabA.environment.document.visibilityState = "hidden";
    tabA.environment.dispatch("visibilitychange");
    await flush();
    assert.equal(FakeSocket.opened.length, 2);
    tabA.environment.document.visibilityState = "visible";
    tabA.environment.dispatch("visibilitychange");
    release(ticket());
    await flush();
    assert.equal(FakeSocket.opened.length, 3, "the tab reconnects once the person looks at it again");
    tabA.hub.setEnabled(false);
    tabB.hub.setEnabled(false);
  });

  it("closes the socket and stays closed when the session ends", async () => {
    FakeSocket.opened = [];
    let ended = 0;
    const { hub, scheduled } = createTestHub(async () => ticket(), () => (ended += 1));
    hub.setEnabled(true);
    await flush();
    FakeSocket.opened[0]!.authenticate();
    FakeSocket.opened[0]!.receive({ type: "session.ended", reason: "session.revoked" });
    assert.equal(FakeSocket.opened[0]!.closed, true);
    assert.equal(ended, 1);
    assert.equal(scheduled.length, 0);
    assert.equal(hub.status(), "polling");

    FakeSocket.opened = [];
    const signedOut = createTestHub(async () => ({ kind: "ended" }));
    signedOut.hub.setEnabled(true);
    await flush();
    assert.equal(FakeSocket.opened.length, 0);
    assert.equal(signedOut.scheduled.length, 0);

    const local = createTestHub(async () => ticket());
    const lateEvents: RealtimeEvent[] = [];
    local.hub.subscribe((event) => lateEvents.push(event));
    local.hub.setEnabled(true);
    await flush();
    const socket = FakeSocket.opened[0]!;
    socket.authenticate();
    local.hub.setEnabled(false);
    assert.equal(socket.closed, true);
    socket.receive({ type: "notification.created", notificationId: "late" });
    assert.equal(lateEvents.length, 0, "nothing reaches the page after sign-out");
  });

  it("never asks for another user's topic and drops topics the server refuses", async () => {
    FakeSocket.opened = [];
    const { hub, scheduled } = createTestHub(async () => ticket());
    hub.setEnabled(true);
    hub.watchTopic("user:someone-else");
    hub.watchTopic("conversation:abc def");
    hub.watchTopic("live:theirs");
    await flush();
    const socket = FakeSocket.opened[0]!;
    socket.authenticate();
    assert.deepEqual(socket.sent.filter((frame) => frame.type === "subscribe").map((frame) => frame.topic), ["live:theirs"]);
    assert.equal(hub.isTopicLive("live:theirs"), true);
    socket.receive({ type: "error", code: "FORBIDDEN", topic: "live:theirs" });
    assert.equal(hub.isTopicLive("live:theirs"), false, "the page keeps polling");
    socket.close();
    scheduled.shift()!.run();
    await flush();
    FakeSocket.opened[1]!.authenticate();
    assert.equal(FakeSocket.opened[1]!.sent.filter((frame) => frame.type === "subscribe").length, 0);
    hub.setEnabled(false);
  });

  it("applies duplicate events once", async () => {
    FakeSocket.opened = [];
    const { hub } = createTestHub(async () => ticket());
    const seen: RealtimeEvent[] = [];
    hub.subscribe((event) => seen.push(event));
    hub.setEnabled(true);
    await flush();
    const socket = FakeSocket.opened[0]!;
    socket.authenticate();
    const created = { type: "message.created", conversationId: "c1", message: { id: "m1" } };
    socket.receive(created);
    socket.receive(created);
    socket.receive({ type: "typing", conversationId: "c1", isTyping: true, user: { id: "u2" } });
    socket.receive({ type: "typing", conversationId: "c1", isTyping: true, user: { id: "u2" } });
    assert.deepEqual(seen.map((event) => event.type), ["message.created", "typing", "typing"]);
    hub.setEnabled(false);

    const notification = readRealtimeNotification({ type: "notification.created", notification: { id: "n1", title: "Ada", body: "commented", category: "social", read: false } })!;
    const list: CategorizedNotification[] = [];
    const once = upsertNotification(list, notification)!;
    assert.equal(upsertNotification(once, notification), once);
    assert.equal(once.length, 1);
    const comment = readRealtimeLiveComment({ type: "live.comment", liveId: "l1", id: "lc1", author: { id: "u1", name: "Ada" }, text: "hi", kind: "comment" }, "l1")!;
    const page = prependLiveComment({ data: [], nextCursor: null }, comment)!;
    assert.equal(prependLiveComment(page, comment), page);
    assert.equal(readRealtimeLiveComment({ type: "live.comment", liveId: "other", id: "x", author: { id: "u", name: "A" }, text: "" }, "l1"), null);
  });
});
