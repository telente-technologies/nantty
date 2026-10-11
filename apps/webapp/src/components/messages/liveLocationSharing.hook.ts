"use client";

import { useEffect, useRef } from "react";

import { messagesService } from "@/services/messages.service";
import type { Conversation, Message } from "@/types";

const minimumUpdateMilliseconds = 30_000;
const minimumMoveDegrees = 0.0002;

export function activeOwnLiveLocations(messages: readonly Message[], viewerId: string): Message[] {
  return messages.filter((message) => message.kind === "liveLocation" && !message.deliveryState && message.senderId === viewerId && message.liveLocation && !message.liveLocation.stopped);
}

export function useLiveLocationSharing(conversation: Conversation | undefined, viewerId: string, messages: readonly Message[]) {
  const active = activeOwnLiveLocations(messages, viewerId);
  const activeIds = active.map((message) => message.id).join(",");
  const lastSent = useRef(new Map<string, { at: number; latitude: number; longitude: number }>());

  useEffect(() => {
    if (!conversation || !activeIds || typeof navigator === "undefined" || !navigator.geolocation) return;
    const targets = activeIds.split(",");
    const watchId = navigator.geolocation.watchPosition((position) => {
      const now = Date.now();
      for (const targetMessageId of targets) {
        const previous = lastSent.current.get(targetMessageId);
        const moved = !previous || Math.abs(previous.latitude - position.coords.latitude) + Math.abs(previous.longitude - position.coords.longitude) > minimumMoveDegrees;
        if (previous && (now - previous.at < minimumUpdateMilliseconds || !moved)) continue;
        lastSent.current.set(targetMessageId, { at: now, latitude: position.coords.latitude, longitude: position.coords.longitude });
        void messagesService.sendControl(conversation, viewerId, { type: "locationUpdate", targetMessageId, latitude: position.coords.latitude, longitude: position.coords.longitude, label: null }).catch(() => undefined);
      }
    }, () => undefined, { enableHighAccuracy: true, maximumAge: 15_000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [conversation, viewerId, activeIds]);
}
