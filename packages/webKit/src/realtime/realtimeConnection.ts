export interface RealtimeTicket {
  readonly url: string;
  readonly realtimeToken: string;
}

export type TicketResult =
  | { readonly kind: "ticket"; readonly ticket: RealtimeTicket }
  | { readonly kind: "unavailable" }
  | { readonly kind: "retry"; readonly retryAfterMs?: number }
  | { readonly kind: "ended" };

export type RealtimeStatus = "connecting" | "live" | "polling";

export interface TicketRequest {
  readonly fresh: boolean;
}

export interface RealtimeSocketLike {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((frame: { readonly data: unknown }) => void) | null;
  onclose: ((event: { readonly code?: number }) => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(): void;
}

export interface RealtimeConnectionOptions<Event> {
  readonly fetchTicket: (request: TicketRequest) => Promise<TicketResult>;
  readonly onEvent: (event: Event) => void;
  readonly onStatus: (status: RealtimeStatus) => void;
  readonly acceptsEvent?: (type: string) => boolean;
  readonly onSessionEnded?: () => void;
  readonly onTopicRejected?: (topic: string) => void;
  readonly pauseWhenReplaced?: boolean;
  readonly openSocket?: (url: string) => RealtimeSocketLike;
  readonly random?: () => number;
  readonly schedule?: (run: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
}

export interface RealtimeConnection {
  status(): RealtimeStatus;
  start(): void;
  stop(): void;
  reconnectNow(): void;
  setTopics(next: ReadonlySet<string>): void;
  sendTyping(conversationId: string, isTyping: boolean): void;
}

const openState = 1;
const heartbeatMs = 25_000;
const missedHeartbeatMs = 60_000;
const baseDelayMs = 1_000;
const maximumDelayMs = 30_000;
const unavailableRetryMs = 5 * 60_000;
const replacedCloseCode = 4409;
const controlFrameTypes = new Set(["auth.ok", "auth.failed", "session.ended", "pong", "subscribed", "unsubscribed", "error"]);

export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const exponential = Math.min(maximumDelayMs, baseDelayMs * 2 ** attempt);
  return Math.round(exponential / 2 + random() * (exponential / 2));
}

export function createRealtimeConnection<Event>(options: RealtimeConnectionOptions<Event>): RealtimeConnection {
  const openSocket = options.openSocket ?? ((url: string) => new WebSocket(url) as unknown as RealtimeSocketLike);
  const schedule = options.schedule ?? ((run: () => void, delayMs: number) => setTimeout(run, delayMs));
  const acceptsEvent = options.acceptsEvent ?? ((type: string) => !controlFrameTypes.has(type));
  const topics = new Set<string>();
  let socket: RealtimeSocketLike | null = null;
  let authenticated = false;
  let running = false;
  let fetchingTicket = false;
  let needsFreshTicket = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let lastFrameAt = 0;
  let status: RealtimeStatus = "polling";

  const setStatus = (next: RealtimeStatus) => {
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

  function endSession() {
    stop();
    options.onSessionEnded?.();
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
    } else if (frame.type === "session.ended" && options.onSessionEnded) {
      endSession();
    } else if (frame.type === "session.ended" || frame.type === "auth.failed") {
      authenticated = false;
      needsFreshTicket = true;
    } else if (frame.type === "error" && frame.code === "FORBIDDEN" && typeof frame.topic === "string" && options.onTopicRejected) {
      topics.delete(frame.topic);
      options.onTopicRejected(frame.topic);
    } else if (typeof frame.type === "string" && acceptsEvent(frame.type)) {
      options.onEvent(frame as unknown as Event);
    }
  }

  async function connect() {
    if (!running || socket || fetchingTicket) return;
    setStatus("connecting");
    const fresh = needsFreshTicket;
    fetchingTicket = true;
    const result = await options.fetchTicket({ fresh }).catch((): TicketResult => ({ kind: "retry" }));
    fetchingTicket = false;
    if (!running || socket) return;
    if (result.kind === "ended") return endSession();
    if (result.kind === "unavailable") return scheduleReconnect(unavailableRetryMs);
    if (result.kind === "retry") return scheduleReconnect(Math.max(result.retryAfterMs ?? 0, reconnectDelay(attempt, options.random)));
    if (fresh) needsFreshTicket = false;
    let opened: RealtimeSocketLike;
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
    opened.onmessage = (frame) => {
      if (socket === opened) handleFrame(frame.data);
    };
    opened.onerror = () => opened.close();
    opened.onclose = (event) => {
      if (socket !== opened) return;
      socket = null;
      authenticated = false;
      clearTimers();
      if (options.pauseWhenReplaced && event?.code === replacedCloseCode) return setStatus("polling");
      scheduleReconnect();
    };
  }

  function stop() {
    running = false;
    clearTimers();
    const current = socket;
    socket = null;
    authenticated = false;
    current?.close();
    setStatus("polling");
  }

  return {
    status: () => status,
    start() {
      if (running) return;
      running = true;
      void connect();
    },
    stop,
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
