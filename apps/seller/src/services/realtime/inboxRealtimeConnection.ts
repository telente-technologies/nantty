import type { InboxRealtimeEvent, InboxRealtimeStatus } from "@/types/conversation.type";

export interface RealtimeTicket {
  readonly url: string;
  readonly realtimeToken: string;
}

export type TicketResult = { readonly kind: "ticket"; readonly ticket: RealtimeTicket } | { readonly kind: "unavailable" } | { readonly kind: "retry" };

interface SocketLike {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((frame: { readonly data: unknown }) => void) | null;
  onclose: ((event: { readonly code?: number }) => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(): void;
}

export interface RealtimeConnectionOptions {
  readonly fetchTicket: () => Promise<TicketResult>;
  readonly onEvent: (event: InboxRealtimeEvent) => void;
  readonly onStatus: (status: InboxRealtimeStatus) => void;
  readonly openSocket?: (url: string) => SocketLike;
  readonly random?: () => number;
  readonly schedule?: (run: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
}

const openState = 1;
const heartbeatMs = 25_000;
const missedHeartbeatMs = 60_000;
const baseDelayMs = 1_000;
const maximumDelayMs = 30_000;
const unavailableRetryMs = 5 * 60_000;
const forwardedTypes = new Set(["message.created", "message.updated", "message.removed", "read", "typing", "subscriptions.revoked"]);

export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const exponential = Math.min(maximumDelayMs, baseDelayMs * 2 ** attempt);
  return Math.round(exponential / 2 + random() * (exponential / 2));
}

export function createInboxRealtimeConnection(options: RealtimeConnectionOptions) {
  const openSocket = options.openSocket ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);
  const schedule = options.schedule ?? ((run: () => void, delayMs: number) => setTimeout(run, delayMs));
  const topics = new Set<string>();
  let socket: SocketLike | null = null;
  let authenticated = false;
  let running = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let lastFrameAt = 0;
  let status: InboxRealtimeStatus = "polling";

  const setStatus = (next: InboxRealtimeStatus) => {
    if (next === status) return;
    status = next;
    options.onStatus(next);
  };
  const sendFrame = (frame: Record<string, unknown>) => {
    if (authenticated && socket?.readyState === openState) socket.send(JSON.stringify(frame));
  };

  function clearTimers() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    heartbeatTimer = null;
    reconnectTimer = null;
  }

  function scheduleReconnect(delayMs = reconnectDelay(attempt, options.random)) {
    if (!running || reconnectTimer) return;
    attempt += 1;
    setStatus("polling");
    reconnectTimer = schedule(() => {
      reconnectTimer = null;
      void connect();
    }, delayMs);
  }

  function handleFrame(raw: unknown) {
    lastFrameAt = Date.now();
    let frame: { readonly type?: string } & Record<string, unknown>;
    try {
      frame = JSON.parse(String(raw)) as typeof frame;
    } catch {
      return;
    }
    if (frame.type === "auth.ok") {
      authenticated = true;
      attempt = 0;
      topics.forEach((topic) => sendFrame({ type: "subscribe", topic }));
      setStatus("live");
    } else if (frame.type === "session.ended" || frame.type === "auth.failed") {
      authenticated = false;
    } else if (typeof frame.type === "string" && forwardedTypes.has(frame.type)) {
      options.onEvent(frame as unknown as InboxRealtimeEvent);
    }
  }

  async function connect() {
    if (!running || socket) return;
    setStatus("connecting");
    const result = await options.fetchTicket().catch((): TicketResult => ({ kind: "retry" }));
    if (!running) return;
    if (result.kind === "unavailable") return scheduleReconnect(unavailableRetryMs);
    if (result.kind === "retry") return scheduleReconnect();
    let opened: SocketLike;
    try {
      opened = openSocket(result.ticket.url);
    } catch {
      return scheduleReconnect();
    }
    socket = opened;
    opened.onopen = () => {
      opened.send(JSON.stringify({ type: "auth", accessToken: result.ticket.realtimeToken }));
      lastFrameAt = Date.now();
      heartbeatTimer = setInterval(() => {
        if (Date.now() - lastFrameAt > missedHeartbeatMs) opened.close();
        else if (opened.readyState === openState) opened.send(JSON.stringify({ type: "ping" }));
      }, heartbeatMs);
    };
    opened.onmessage = (frame) => handleFrame(frame.data);
    opened.onerror = () => opened.close();
    opened.onclose = () => {
      if (socket === opened) socket = null;
      authenticated = false;
      clearTimers();
      scheduleReconnect();
    };
  }

  return {
    status: () => status,
    start() {
      if (running) return;
      running = true;
      void connect();
    },
    stop() {
      running = false;
      clearTimers();
      const current = socket;
      socket = null;
      authenticated = false;
      current?.close();
      setStatus("polling");
    },
    reconnectNow() {
      if (!running || socket) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      attempt = 0;
      void connect();
    },
    setTopics(next: ReadonlySet<string>) {
      topics.forEach((topic) => !next.has(topic) && sendFrame({ type: "unsubscribe", topic }));
      next.forEach((topic) => !topics.has(topic) && sendFrame({ type: "subscribe", topic }));
      topics.clear();
      next.forEach((topic) => topics.add(topic));
    },
    sendTyping(conversationId: string, isTyping: boolean) {
      sendFrame({ type: "typing", conversationId, isTyping });
    },
  };
}
