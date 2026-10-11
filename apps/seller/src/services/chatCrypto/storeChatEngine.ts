"use client";

import { sendRequestToDashboardServer, SellerApiRequestError } from "@/services/clientApi.service";
import { createInboxRealtimeConnection, type RealtimeTicket, type TicketResult } from "@/services/realtime/inboxRealtimeConnection";
import type { ConversationMessage, DecryptedConversationMessage, DecryptedPreview, InboxRealtimeEvent, InboxRealtimeStatus } from "@/types/conversation.type";

import { type EncryptedSendRequest, storeChatCrypto } from "./storeChatCrypto.service";
import { broadcastFrame, createTabLeader, type LeaderChannel, type LeaderLocks, type TabLeader } from "./tabLeader";

const channelName = "zudomart-seller-chat-engine";
type TopicClaim = { readonly tabId: string; readonly topic: string; readonly on: boolean };

let leader: TabLeader | null = null;
let currentStatus: InboxRealtimeStatus = "polling";
const localTopics = new Map<string, number>();
let wantsRealtime = false;

async function fetchTicket(): Promise<TicketResult> {
  try {
    return { kind: "ticket", ticket: await sendRequestToDashboardServer<RealtimeTicket>("/bff/realtime", { method: "POST" }) };
  } catch (error) {
    if (error instanceof SellerApiRequestError && (error.status === 404 || error.status === 403)) return { kind: "unavailable" };
    return { kind: "retry" };
  }
}

function startLeaderDuties(engine: TabLeader) {
  const claims = new Map<string, Set<string>>();
  const connection = createInboxRealtimeConnection({
    fetchTicket,
    onEvent: (event) => engine.broadcast("event", event),
    onStatus: (status) => engine.broadcast("status", status),
  });
  const syncTopics = () => connection.setTopics(new Set([...claims].filter(([, tabs]) => tabs.size > 0).map(([topic]) => topic)));
  engine.onNotify("connect", () => connection.start());
  engine.onNotify("follower-joined", () => engine.broadcast("status", connection.status()));
  engine.onNotify("typing", (payload) => {
    const { conversationId, isTyping } = payload as { conversationId: string; isTyping: boolean };
    connection.sendTyping(conversationId, isTyping);
  });
  engine.onNotify("topic", (payload) => {
    const claim = payload as TopicClaim;
    const tabs = claims.get(claim.topic) ?? new Set<string>();
    if (claim.on) tabs.add(claim.tabId);
    else tabs.delete(claim.tabId);
    claims.set(claim.topic, tabs);
    syncTopics();
  });
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => connection.reconnectNow());
  }
}

function announceToLeader(engine: TabLeader) {
  if (wantsRealtime) engine.notifyLeader("connect", null);
  localTopics.forEach((count, topic) => count > 0 && engine.notifyLeader("topic", { tabId: engine.tabId, topic, on: true } satisfies TopicClaim));
}

function getLeader(): TabLeader {
  if (leader) return leader;
  const hasChannel = typeof BroadcastChannel !== "undefined";
  const locks = typeof navigator !== "undefined" && "locks" in navigator ? (navigator.locks as unknown as LeaderLocks) : null;
  const engine = createTabLeader({
    name: channelName,
    channel: hasChannel ? (new BroadcastChannel(channelName) as unknown as LeaderChannel) : null,
    locks,
    handlers: {
      ensureReady: (viewerId: string) => storeChatCrypto.ensureReady(viewerId),
      hasDeviceIdentity: (viewerId: string) => storeChatCrypto.hasDeviceIdentity(viewerId),
      decryptThread: (messages: readonly ConversationMessage[], viewerId: string) => storeChatCrypto.decryptThread(messages, viewerId),
      sendEncrypted: (request: EncryptedSendRequest) => storeChatCrypto.sendEncrypted(request),
      readPreviews: (ids: readonly string[]) => storeChatCrypto.readPreviews(ids),
      savePreview: (conversationId: string, preview: DecryptedPreview) => storeChatCrypto.savePreview(conversationId, preview),
    },
  });
  leader = engine;
  engine.onBroadcast("status", (status) => (currentStatus = status as InboxRealtimeStatus));
  engine.onBroadcast("signed-out", () => void storeChatCrypto.discardLocalState());
  engine.onLeadershipChange((isLeader) => {
    if (isLeader) startLeaderDuties(engine);
    announceToLeader(engine);
  });
  if (engine.isLeader()) {
    startLeaderDuties(engine);
    announceToLeader(engine);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => localTopics.forEach((_, topic) => engine.notifyLeader("topic", { tabId: engine.tabId, topic, on: false } satisfies TopicClaim)));
  }
  return engine;
}

export const storeChatEngine = {
  isLeader: () => getLeader().isLeader(),
  onLeadershipChange: (listener: (isLeader: boolean) => void) => getLeader().onLeadershipChange((isLeader) => listener(isLeader)),
  ensureReady: (viewerId: string) => getLeader().call<void>("ensureReady", viewerId),
  hasDeviceIdentity: (viewerId: string) => getLeader().call<boolean>("hasDeviceIdentity", viewerId),
  decryptThread: (messages: readonly ConversationMessage[], viewerId: string) => getLeader().call<DecryptedConversationMessage[]>("decryptThread", messages, viewerId),
  sendEncrypted: (request: EncryptedSendRequest) => getLeader().call<ConversationMessage>("sendEncrypted", request),
  readPreviews: (ids: readonly string[]) => getLeader().call<Map<string, DecryptedPreview>>("readPreviews", ids),
  savePreview: (conversationId: string, preview: DecryptedPreview) => getLeader().call<void>("savePreview", conversationId, preview).catch(() => undefined),
  connectRealtime() {
    wantsRealtime = true;
    getLeader().notifyLeader("connect", null);
  },
  realtimeStatus: () => currentStatus,
  onEvent: (listener: (event: InboxRealtimeEvent) => void) => getLeader().onBroadcast("event", (event) => listener(event as InboxRealtimeEvent)),
  onStatus: (listener: (status: InboxRealtimeStatus) => void) => getLeader().onBroadcast("status", (status) => listener(status as InboxRealtimeStatus)),
  watchConversation(conversationId: string) {
    const engine = getLeader();
    const topic = `conversation:${conversationId}`;
    const count = localTopics.get(topic) ?? 0;
    localTopics.set(topic, count + 1);
    if (count === 0) engine.notifyLeader("topic", { tabId: engine.tabId, topic, on: true } satisfies TopicClaim);
    return () => {
      const remaining = (localTopics.get(topic) ?? 1) - 1;
      localTopics.set(topic, remaining);
      if (remaining <= 0) {
        localTopics.delete(topic);
        engine.notifyLeader("topic", { tabId: engine.tabId, topic, on: false } satisfies TopicClaim);
      }
    };
  },
  sendTyping: (conversationId: string, isTyping: boolean) => getLeader().notifyLeader("typing", { conversationId, isTyping }),
  shutdown() {
    if (leader !== null) leader.broadcast("signed-out", null);
    else if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(channelName);
      channel.postMessage(broadcastFrame("signed-out", null));
      channel.close();
    }
    leader?.close();
    leader = null;
  },
};
