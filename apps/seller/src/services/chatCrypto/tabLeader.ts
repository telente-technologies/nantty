export interface LeaderChannel {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: { readonly data: unknown }) => void): void;
  close(): void;
}

export interface LeaderLocks {
  request(name: string, options: { readonly mode: "exclusive" }, callback: () => Promise<void>): Promise<unknown>;
}

type Handler = (...args: never[]) => unknown;
type Listener = (payload: unknown) => void;
type SerializedError = { readonly message: string; readonly code?: string; readonly status?: number };
type Frame =
  | { readonly t: "call"; readonly id: string; readonly method: string; readonly args: readonly unknown[] }
  | { readonly t: "result"; readonly id: string; readonly ok: boolean; readonly value?: unknown; readonly error?: SerializedError }
  | { readonly t: "leader"; readonly tabId: string }
  | { readonly t: "who" }
  | { readonly t: "broadcast"; readonly topic: string; readonly payload: unknown }
  | { readonly t: "notify"; readonly topic: string; readonly payload: unknown };

interface PendingCall {
  readonly method: string;
  readonly args: readonly unknown[];
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: unknown) => void;
  readonly timer: ReturnType<typeof setTimeout>;
  sentTo: string | null;
}

export interface TabLeaderOptions {
  readonly name: string;
  readonly handlers: Record<string, Handler>;
  readonly channel?: LeaderChannel | null;
  readonly locks?: LeaderLocks | null;
  readonly timeoutMs?: number;
  readonly tabId?: string;
}

export class TabLeaderError extends Error {
  public constructor(message: string, public readonly code?: string, public readonly status?: number) {
    super(message);
    this.name = "TabLeaderError";
  }
}

const serializeError = (error: unknown): SerializedError => {
  const candidate = error as { message?: unknown; code?: unknown; status?: unknown } | null;
  return {
    message: typeof candidate?.message === "string" ? candidate.message : "Secure chat couldn't finish that in another tab. Try again.",
    ...(typeof candidate?.code === "string" ? { code: candidate.code } : {}),
    ...(typeof candidate?.status === "number" ? { status: candidate.status } : {}),
  };
};

export const broadcastFrame = (topic: string, payload: unknown): Frame => ({ t: "broadcast", topic, payload });

export function createTabLeader(options: TabLeaderOptions) {
  const tabId = options.tabId ?? crypto.randomUUID();
  const channel = options.channel ?? null;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pending = new Map<string, PendingCall>();
  const broadcastListeners = new Map<string, Set<Listener>>();
  const notifyListeners = new Map<string, Set<Listener>>();
  const leadershipListeners = new Set<(isLeader: boolean, leaderId: string | null) => void>();
  let leader = false;
  let leaderId: string | null = null;
  let releaseLock: (() => void) | null = null;
  let closed = false;

  const post = (frame: Frame) => channel?.postMessage(frame);
  const emit = (listeners: Map<string, Set<Listener>>, topic: string, payload: unknown) => listeners.get(topic)?.forEach((listener) => listener(payload));
  const listen = (listeners: Map<string, Set<Listener>>, topic: string, listener: Listener) => {
    const set = listeners.get(topic) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(topic, set);
    return () => void set.delete(listener);
  };

  async function runLocally(method: string, args: readonly unknown[]): Promise<unknown> {
    const handler = options.handlers[method] as ((...values: readonly unknown[]) => unknown) | undefined;
    if (handler === undefined) throw new TabLeaderError(`Unknown method ${method}.`);
    return handler(...args);
  }

  function settle(id: string, ok: boolean, value: unknown, error?: SerializedError) {
    const call = pending.get(id);
    if (call === undefined) return;
    pending.delete(id);
    clearTimeout(call.timer);
    if (ok) call.resolve(value);
    else call.reject(new TabLeaderError(error?.message ?? "Secure chat couldn't finish that in another tab. Try again.", error?.code, error?.status));
  }

  function sendPending(id: string, call: PendingCall) {
    if (leader) {
      runLocally(call.method, call.args).then((value) => settle(id, true, value), (error: unknown) => settle(id, false, undefined, serializeError(error)));
      return;
    }
    call.sentTo = leaderId;
    post({ t: "call", id, method: call.method, args: call.args });
  }

  function becomeLeader() {
    leader = true;
    leaderId = tabId;
    post({ t: "leader", tabId });
    leadershipListeners.forEach((listener) => listener(true, tabId));
    pending.forEach((call, id) => sendPending(id, call));
  }

  channel?.addEventListener("message", (event) => {
    const frame = event.data as Frame | null;
    if (closed || frame === null || typeof frame !== "object") return;
    if (frame.t === "call" && leader) {
      runLocally(frame.method, frame.args).then(
        (value) => post({ t: "result", id: frame.id, ok: true, value }),
        (error: unknown) => post({ t: "result", id: frame.id, ok: false, error: serializeError(error) }),
      );
    } else if (frame.t === "result") {
      settle(frame.id, frame.ok, frame.value, frame.error);
    } else if (frame.t === "who" && leader) {
      post({ t: "leader", tabId });
      emit(notifyListeners, "follower-joined", null);
    } else if (frame.t === "leader" && frame.tabId !== tabId) {
      const changed = leaderId !== frame.tabId;
      leaderId = frame.tabId;
      if (changed) {
        leadershipListeners.forEach((listener) => listener(false, frame.tabId));
        pending.forEach((call, id) => call.sentTo !== frame.tabId && sendPending(id, call));
      }
    } else if (frame.t === "broadcast") {
      emit(broadcastListeners, frame.topic, frame.payload);
    } else if (frame.t === "notify" && leader) {
      emit(notifyListeners, frame.topic, frame.payload);
    }
  });

  if (channel === null || options.locks === null || options.locks === undefined) {
    becomeLeader();
  } else {
    void options.locks.request(options.name, { mode: "exclusive" }, () => new Promise<void>((release) => {
      releaseLock = release;
      if (!closed) becomeLeader();
      else release();
    }));
    post({ t: "who" });
  }

  return {
    tabId,
    isLeader: () => leader,
    leaderId: () => leaderId,
    call<T>(method: string, ...args: readonly unknown[]): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const id = crypto.randomUUID();
        const timer = setTimeout(() => settle(id, false, undefined, { message: "Secure chat is busy in another tab. Try again.", code: "TAB_LEADER_TIMEOUT" }), timeoutMs);
        const call: PendingCall = { method, args, resolve: resolve as (value: unknown) => void, reject, timer, sentTo: null };
        pending.set(id, call);
        sendPending(id, call);
      });
    },
    broadcast(topic: string, payload: unknown) {
      post({ t: "broadcast", topic, payload });
      emit(broadcastListeners, topic, payload);
    },
    notifyLeader(topic: string, payload: unknown) {
      if (leader) emit(notifyListeners, topic, payload);
      else post({ t: "notify", topic, payload });
    },
    onBroadcast: (topic: string, listener: Listener) => listen(broadcastListeners, topic, listener),
    onNotify: (topic: string, listener: Listener) => listen(notifyListeners, topic, listener),
    onLeadershipChange(listener: (isLeader: boolean, leaderId: string | null) => void) {
      leadershipListeners.add(listener);
      return () => void leadershipListeners.delete(listener);
    },
    close() {
      closed = true;
      leader = false;
      releaseLock?.();
      pending.forEach((call) => clearTimeout(call.timer));
      pending.clear();
      channel?.close();
    },
  };
}

export type TabLeader = ReturnType<typeof createTabLeader>;
