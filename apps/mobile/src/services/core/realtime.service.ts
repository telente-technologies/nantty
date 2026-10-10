import { apiConfig, shouldUseMockForPath } from "@/config/api.config";
import { useAuthStore } from "@/store/auth.store";
import type { RealtimeServerEvent } from "@/types";

import { startMockRealtimeEventEmitter } from "./realtimeMockEmitter.service";

type RealtimeEventListener = (event: RealtimeServerEvent) => void;

const HEARTBEAT_INTERVAL_MS = 25_000;
const MISSED_HEARTBEAT_TIMEOUT_MS = 60_000;
const BASE_RECONNECT_DELAY_MS = 1_000;
const MAXIMUM_RECONNECT_DELAY_MS = 30_000;

const realtimeEventListeners = new Set<RealtimeEventListener>();
const topicSubscriberCounts = new Map<string, number>();
let openSocket: WebSocket | null = null;
let isSocketAuthenticated = false;
let reconnectAttemptCount = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lastServerFrameAt = 0;
let stopMockEmitter: (() => void) | null = null;

export const buildRealtimeWebSocketUrl = (httpBaseUrl: string) => `${httpBaseUrl.replace(/^http(s?):\/\//i, (_, secure: string) => (secure ? "wss://" : "ws://")).replace(/\/$/, "")}/ws`;

const deliverEventToListeners = (event: RealtimeServerEvent) => realtimeEventListeners.forEach((listener) => listener(event));

const sendTopicFrame = (type: "subscribe" | "unsubscribe", topic: string) => {
  if (isSocketAuthenticated && openSocket?.readyState === WebSocket.OPEN) openSocket.send(JSON.stringify({ type, topic }));
};

function clearConnectionTimers() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  heartbeatTimer = null;
  reconnectTimer = null;
}

function scheduleReconnectWithBackoffAndJitter() {
  if (realtimeEventListeners.size === 0 || reconnectTimer) return;
  const exponentialDelay = Math.min(MAXIMUM_RECONNECT_DELAY_MS, BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttemptCount);
  const delayWithJitter = exponentialDelay / 2 + Math.random() * (exponentialDelay / 2);
  reconnectAttemptCount += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openAuthenticatedWebSocket();
  }, delayWithJitter);
}

function startHeartbeat(socket: WebSocket) {
  lastServerFrameAt = Date.now();
  heartbeatTimer = setInterval(() => {
    if (Date.now() - lastServerFrameAt > MISSED_HEARTBEAT_TIMEOUT_MS) {
      socket.close();
      return;
    }
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" }));
  }, HEARTBEAT_INTERVAL_MS);
}

function openAuthenticatedWebSocket() {
  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken || realtimeEventListeners.size === 0) return;
  const socket = new WebSocket(buildRealtimeWebSocketUrl(apiConfig.baseUrl));
  openSocket = socket;
  socket.onopen = () => {
    socket.send(JSON.stringify({ type: "auth", accessToken: useAuthStore.getState().accessToken }));
    reconnectAttemptCount = 0;
    startHeartbeat(socket);
  };
  socket.onmessage = (frame) => {
    lastServerFrameAt = Date.now();
    try {
      const event = JSON.parse(String(frame.data)) as RealtimeServerEvent | { readonly type: "auth.ok" };
      if (event.type === "auth.ok") {
        isSocketAuthenticated = true;
        topicSubscriberCounts.forEach((_, topic) => sendTopicFrame("subscribe", topic));
        return;
      }
      if (event.type !== "pong") deliverEventToListeners(event);
    } catch {
      return;
    }
  };
  socket.onclose = () => {
    if (openSocket === socket) {
      openSocket = null;
      isSocketAuthenticated = false;
    }
    clearConnectionTimers();
    scheduleReconnectWithBackoffAndJitter();
  };
  socket.onerror = () => socket.close();
}

function startRealtimeTransport() {
  if (shouldUseMockForPath("/ws")) {
    stopMockEmitter ??= startMockRealtimeEventEmitter(deliverEventToListeners);
    return;
  }
  if (!openSocket) openAuthenticatedWebSocket();
}

function stopRealtimeTransport() {
  stopMockEmitter?.();
  stopMockEmitter = null;
  clearConnectionTimers();
  const socket = openSocket;
  openSocket = null;
  isSocketAuthenticated = false;
  socket?.close();
}

export const realtimeService = {
  subscribeToRealtimeEvents: (listener: RealtimeEventListener) => {
    realtimeEventListeners.add(listener);
    if (realtimeEventListeners.size === 1) startRealtimeTransport();
    return () => {
      realtimeEventListeners.delete(listener);
      if (realtimeEventListeners.size === 0) stopRealtimeTransport();
    };
  },
  subscribeToTopic: (topic: string) => {
    const count = topicSubscriberCounts.get(topic) ?? 0;
    topicSubscriberCounts.set(topic, count + 1);
    if (count === 0) sendTopicFrame("subscribe", topic);
    return () => {
      const remaining = (topicSubscriberCounts.get(topic) ?? 1) - 1;
      if (remaining > 0) {
        topicSubscriberCounts.set(topic, remaining);
        return;
      }
      topicSubscriberCounts.delete(topic);
      sendTopicFrame("unsubscribe", topic);
    };
  },
  sendTypingSignal: (conversationId: string, isTyping: boolean) => {
    if (openSocket?.readyState === WebSocket.OPEN) openSocket.send(JSON.stringify({ type: "typing", conversationId, isTyping }));
  },
  reconnectAfterSessionChange: () => {
    stopRealtimeTransport();
    if (realtimeEventListeners.size > 0) startRealtimeTransport();
  },
};
