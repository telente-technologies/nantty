import { AppState } from "react-native";

import { useLiveLocationSharesStore, type ActiveLiveLocationShare } from "@/store/liveLocationShares.store";
import type { Message } from "@/types";

import { readCurrentSharedLocation } from "../chat/locationSharing.service";
import { messagesService } from "../chat/messages.service";

const LIVE_LOCATION_UPDATE_INTERVAL_MS = 15_000;

const timersByMessageId = new Map<string, ReturnType<typeof setInterval>>();

export function stopLiveLocationUpdates(messageId: string) {
  const timer = timersByMessageId.get(messageId);
  if (timer) clearInterval(timer);
  timersByMessageId.delete(messageId);
  useLiveLocationSharesStore.getState().removeShare(messageId);
}

export async function stopSharingLiveLocation(messageId: string, onMessageChanged: (message: Message) => void) {
  stopLiveLocationUpdates(messageId);
  onMessageChanged(await messagesService.stopLiveLocation(messageId));
}

export function startLiveLocationUpdates(share: ActiveLiveLocationShare, onMessageChanged: (message: Message) => void) {
  stopLiveLocationUpdates(share.messageId);
  useLiveLocationSharesStore.getState().addShare(share);
  const sendLatestPosition = async () => {
    if (new Date(share.liveUntil).getTime() <= Date.now()) {
      stopLiveLocationUpdates(share.messageId);
      return;
    }
    if (AppState.currentState !== "active") return;
    try {
      const { latitude, longitude, address } = await readCurrentSharedLocation();
      onMessageChanged(await messagesService.updateLiveLocation(share.messageId, { latitude, longitude, address }));
    } catch {
      return;
    }
  };
  timersByMessageId.set(share.messageId, setInterval(() => void sendLatestPosition(), LIVE_LOCATION_UPDATE_INTERVAL_MS));
}
