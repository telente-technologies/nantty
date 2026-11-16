import { AppState, type AppStateStatus } from "react-native";

import { apiBaseUrl } from "./apiClient";
import type { MessengerRequest } from "./messengerChat.service";

export interface MessengerRealtimeEvent {
  readonly type: string;
  readonly conversationId?: string;
  readonly [key: string]: unknown;
}

type EventListener = (event: MessengerRealtimeEvent) => void;

const listeners = new Set<EventListener>();
const conversationListeners = new Map<string, Set<EventListener>>();
const topics = new Set<string>();
const heartbeatIntervalMs = 25_000;
const maximumReconnectDelayMs = 30_000;
let socket: WebSocket | null = null;
let connecting: Promise<void> | null = null;
let authenticated = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lastFrameAt = 0;
let reconnectAttempt = 0;
let requestClient: MessengerRequest | null = null;
let appState: AppStateStatus = (AppState.currentState as AppStateStatus | null) ?? "active";

function websocketUrl(): string {
  return `${apiBaseUrl.replace(/^http(s?):\/\//i, (_match: string, secure: string) => secure ? "wss://" : "ws://")}/ws`;
}

function clearTimers(): void {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  heartbeatTimer = null;
  reconnectTimer = null;
}

function publish(event: MessengerRealtimeEvent): void {
  listeners.forEach((listener) => listener(event));
  const conversationId = event.conversationId;
  if (conversationId) conversationListeners.get(conversationId)?.forEach((listener) => listener(event));
}

function sendFrame(frame: Readonly<Record<string, unknown>>): void {
  if (authenticated && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame));
}

function reconnect(): void {
  if (listeners.size === 0 && conversationListeners.size === 0 || reconnectTimer || appState !== "active") return;
  const delay = Math.min(maximumReconnectDelayMs, 1_000 * 2 ** reconnectAttempt++);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, delay / 2 + Math.random() * delay / 2);
}

async function connect(): Promise<void> {
  if (!requestClient || socket || connecting || appState !== "active") return connecting ?? Promise.resolve();
  connecting = (async () => {
    const response = await requestClient!<{ readonly realtimeToken?: unknown; readonly scope?: unknown }>("/api/v1/auth/realtime-token", { method: "POST" });
    if (typeof response.realtimeToken !== "string" || response.scope !== "realtime") throw new Error("Realtime authorization unavailable");
    if (appState !== "active" || listeners.size === 0 && conversationListeners.size === 0) return;
    const nextSocket = new WebSocket(websocketUrl());
    socket = nextSocket;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Realtime connection timed out")), 10_000);
      nextSocket.onopen = () => {
        clearTimeout(timeout);
        nextSocket.send(JSON.stringify({ type: "auth", accessToken: response.realtimeToken }));
        resolve();
      };
      nextSocket.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Realtime connection failed"));
      };
    });
    lastFrameAt = Date.now();
    nextSocket.onmessage = ({ data }) => {
      lastFrameAt = Date.now();
      try {
        const event = JSON.parse(String(data)) as MessengerRealtimeEvent;
        if (event.type === "auth.ok") {
          authenticated = true;
          reconnectAttempt = 0;
          topics.forEach((topic) => sendFrame({ type: "subscribe", topic }));
          return;
        }
        if (event.type === "auth.failed" || event.type === "session.ended") {
          nextSocket.close();
          return;
        }
        if (event.type !== "pong") publish(event);
      } catch { /* Ignore malformed or unknown frames; the server remains authoritative. */ }
    };
    nextSocket.onclose = () => {
      if (socket === nextSocket) socket = null;
      authenticated = false;
      clearTimers();
      reconnect();
    };
    nextSocket.onerror = () => nextSocket.close();
    heartbeatTimer = setInterval(() => {
      if (Date.now() - lastFrameAt > heartbeatIntervalMs * 2) nextSocket.close();
      else sendFrame({ type: "ping" });
    }, heartbeatIntervalMs);
  })().catch(() => {
    socket?.close();
    socket = null;
    authenticated = false;
    reconnect();
  }).finally(() => { connecting = null; });
  return connecting;
}

function stopIfUnused(): void {
  if (listeners.size || conversationListeners.size) return;
  clearTimers();
  authenticated = false;
  socket?.close();
  socket = null;
  requestClient = null;
}

export function subscribeToMessengerEvents(request: MessengerRequest, listener: EventListener): () => void {
  requestClient = request;
  listeners.add(listener);
  void connect();
  return () => { listeners.delete(listener); stopIfUnused(); };
}

export function subscribeToMessengerConversation(request: MessengerRequest, conversationId: string, listener: EventListener): () => void {
  requestClient = request;
  const topic = `conversation:${conversationId}`;
  const subscribed = conversationListeners.get(conversationId) ?? new Set<EventListener>();
  const isFirst = subscribed.size === 0;
  subscribed.add(listener);
  conversationListeners.set(conversationId, subscribed);
  if (isFirst) {
    topics.add(topic);
    sendFrame({ type: "subscribe", topic });
  }
  void connect();
  return () => {
    const current = conversationListeners.get(conversationId);
    current?.delete(listener);
    if (current?.size === 0) {
      conversationListeners.delete(conversationId);
      topics.delete(topic);
      sendFrame({ type: "unsubscribe", topic });
    }
    stopIfUnused();
  };
}

export function sendMessengerTypingSignal(conversationId: string, isTyping: boolean): void {
  sendFrame({ type: "typing", conversationId, isTyping });
}

export function pauseMessengerRealtime(): void {
  clearTimers();
  authenticated = false;
  const current = socket;
  socket = null;
  current?.close();
}

export function resumeMessengerRealtime(): void {
  if (listeners.size || conversationListeners.size) void connect();
}

export function clearMessengerRealtime(): void {
  listeners.clear();
  conversationListeners.clear();
  topics.clear();
  stopIfUnused();
}

AppState.addEventListener("change", (state) => {
  appState = state;
  if (state === "active") resumeMessengerRealtime();
  else pauseMessengerRealtime();
});
