import { createRealtimeConnection, type RealtimeConnection, type RealtimeConnectionOptions, type RealtimeStatus, type TicketRequest, type TicketResult } from "./realtimeConnection";

export interface RealtimeEvent {
  readonly type: string;
  readonly [field: string]: unknown;
}

export interface RealtimeHubOptions {
  readonly fetchTicket: (request: TicketRequest) => Promise<TicketResult>;
  readonly onSessionEnded?: () => void;
  readonly createConnection?: (options: RealtimeConnectionOptions<RealtimeEvent>) => RealtimeConnection;
  readonly environment?: Pick<Window, "addEventListener" | "removeEventListener"> & { readonly document?: Pick<Document, "visibilityState"> };
}

export interface RealtimeHub {
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  status(): RealtimeStatus;
  subscribe(listener: (event: RealtimeEvent) => void): () => void;
  onChange(listener: () => void): () => void;
  watchTopic(topic: string): () => void;
  isTopicLive(topic: string): boolean;
  sendTyping(conversationId: string, isTyping: boolean): void;
}

const watchableTopicPattern = /^(conversation|live|battle):[A-Za-z0-9_-]{1,80}$/;
const dedupedEventTypes = new Set(["message.created", "live.comment", "notification.created", "gift.sent"]);
const rememberedEventLimit = 300;

export function isWatchableTopic(topic: string): boolean {
  return watchableTopicPattern.test(topic);
}

export function readRealtimeEventIdentity(event: RealtimeEvent): string | null {
  if (!dedupedEventTypes.has(event.type)) return null;
  const message = event.message as { readonly id?: unknown } | undefined;
  const candidates = [event.notificationId, event.giftTransactionId, message?.id, event.id];
  const identity = candidates.find((value): value is string => typeof value === "string" && value !== "");
  return identity ? `${event.type}:${identity}` : null;
}

export function createRealtimeHub(options: RealtimeHubOptions): RealtimeHub {
  const listeners = new Set<(event: RealtimeEvent) => void>();
  const changeListeners = new Set<() => void>();
  const topicCounts = new Map<string, number>();
  const rejectedTopics = new Set<string>();
  const recentEvents = new Set<string>();
  const environment = options.environment ?? (typeof window === "undefined" ? null : window);
  let currentStatus: RealtimeStatus = "polling";
  let enabled = false;
  let connection: RealtimeConnection | null = null;

  const notifyChange = () => changeListeners.forEach((listener) => listener());
  const activeTopics = () => new Set([...topicCounts.keys()].filter((topic) => !rejectedTopics.has(topic)));
  const syncTopics = () => connection?.setTopics(activeTopics());

  function rejectTopics(topics: readonly string[]) {
    topics.forEach((topic) => rejectedTopics.add(topic));
    syncTopics();
    notifyChange();
  }

  function deliver(event: RealtimeEvent) {
    if (event.type === "subscriptions.revoked" && Array.isArray(event.topics)) rejectTopics(event.topics.filter((topic): topic is string => typeof topic === "string"));
    const identity = readRealtimeEventIdentity(event);
    if (identity) {
      if (recentEvents.has(identity)) return;
      recentEvents.add(identity);
      if (recentEvents.size > rememberedEventLimit) recentEvents.delete(recentEvents.values().next().value as string);
    }
    listeners.forEach((listener) => listener(event));
  }

  const resume = () => {
    if (environment?.document && environment.document.visibilityState !== "visible") return;
    connection?.reconnectNow();
  };

  function ensureConnection(): RealtimeConnection {
    if (connection) return connection;
    const create = options.createConnection ?? createRealtimeConnection<RealtimeEvent>;
    connection = create({
      fetchTicket: options.fetchTicket,
      onEvent: deliver,
      onStatus: (status) => {
        currentStatus = status;
        notifyChange();
      },
      onSessionEnded: () => {
        enabled = false;
        notifyChange();
        options.onSessionEnded?.();
      },
      onTopicRejected: (topic) => rejectTopics([topic]),
      pauseWhenReplaced: true,
    });
    syncTopics();
    environment?.addEventListener("online", resume);
    environment?.addEventListener("visibilitychange", resume);
    return connection;
  }

  return {
    setEnabled(next) {
      if (next === enabled) return;
      enabled = next;
      if (next) {
        rejectedTopics.clear();
        recentEvents.clear();
        ensureConnection().start();
      } else {
        connection?.stop();
      }
      notifyChange();
    },
    isEnabled: () => enabled,
    status: () => (enabled ? currentStatus : "polling"),
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    onChange(listener) {
      changeListeners.add(listener);
      return () => void changeListeners.delete(listener);
    },
    watchTopic(topic) {
      if (!isWatchableTopic(topic)) return () => undefined;
      const count = topicCounts.get(topic) ?? 0;
      topicCounts.set(topic, count + 1);
      if (count === 0) {
        syncTopics();
        notifyChange();
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const remaining = (topicCounts.get(topic) ?? 1) - 1;
        if (remaining > 0) return void topicCounts.set(topic, remaining);
        topicCounts.delete(topic);
        rejectedTopics.delete(topic);
        syncTopics();
        notifyChange();
      };
    },
    isTopicLive: (topic) => enabled && currentStatus === "live" && topicCounts.has(topic) && !rejectedTopics.has(topic),
    sendTyping(conversationId, isTyping) {
      if (enabled) connection?.sendTyping(conversationId, isTyping);
    },
  };
}
