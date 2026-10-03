import { useEffect, useRef } from "react";

import { shouldUseMockForPath } from "@/config/api.config";
import { startMockLiveGiftEmitter } from "@/services/liveGiftMockEmitter.service";
import { realtimeService } from "@/services/realtime.service";
import type { LiveGiftSentEvent } from "@/types";

export type LiveGiftSentListener = (event: LiveGiftSentEvent) => void;

interface LiveGiftChannel {
  readonly listeners: Set<LiveGiftSentListener>;
  readonly deliveredEventIds: Set<string>;
  stopTransport: () => void;
}

const MAXIMUM_REMEMBERED_EVENT_IDS = 500;
const channelsByLiveId = new Map<string, LiveGiftChannel>();

const deliverGiftEventToChannelOnce = (channel: LiveGiftChannel, event: LiveGiftSentEvent) => {
  if (channel.deliveredEventIds.has(event.giftTransactionId)) return;
  if (channel.deliveredEventIds.size > MAXIMUM_REMEMBERED_EVENT_IDS) channel.deliveredEventIds.clear();
  channel.deliveredEventIds.add(event.giftTransactionId);
  channel.listeners.forEach((listener) => listener(event));
};

const startGiftTransportForLive = (liveId: string, streamerUserId: string, channel: LiveGiftChannel) => {
  if (shouldUseMockForPath("/ws")) return startMockLiveGiftEmitter(liveId, streamerUserId, (event) => deliverGiftEventToChannelOnce(channel, event));
  return realtimeService.subscribeToRealtimeEvents((event) => {
    if (event.type === "gift.sent" && event.liveId === liveId) deliverGiftEventToChannelOnce(channel, event);
  });
};

export function publishLocallySentLiveGiftEvent(event: LiveGiftSentEvent) {
  const channel = channelsByLiveId.get(event.liveId);
  if (channel) deliverGiftEventToChannelOnce(channel, event);
}

export function subscribeToLiveGiftSentEvents(liveId: string, listener: LiveGiftSentListener, streamerUserId = "live_host") {
  let channel = channelsByLiveId.get(liveId);
  if (!channel) {
    const createdChannel: LiveGiftChannel = { listeners: new Set(), deliveredEventIds: new Set(), stopTransport: () => undefined };
    createdChannel.stopTransport = startGiftTransportForLive(liveId, streamerUserId, createdChannel);
    channelsByLiveId.set(liveId, createdChannel);
    channel = createdChannel;
  }
  channel.listeners.add(listener);
  return () => {
    channel.listeners.delete(listener);
    if (channel.listeners.size > 0) return;
    channel.stopTransport();
    channelsByLiveId.delete(liveId);
  };
}

export function useLiveGiftSentEvents(liveId: string, listener: LiveGiftSentListener, streamerUserId?: string) {
  const latestListener = useRef(listener);
  useEffect(() => {
    latestListener.current = listener;
  });
  useEffect(() => subscribeToLiveGiftSentEvents(liveId, (event) => latestListener.current(event), streamerUserId), [liveId, streamerUserId]);
}
