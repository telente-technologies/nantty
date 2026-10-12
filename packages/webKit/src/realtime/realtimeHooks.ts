"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import type { RealtimeStatus } from "./realtimeConnection";
import type { RealtimeEvent, RealtimeHub } from "./realtimeHub";

export function useRealtimeStatus(hub: RealtimeHub): RealtimeStatus {
  const subscribe = useCallback((onChange: () => void) => hub.onChange(onChange), [hub]);
  return useSyncExternalStore(subscribe, hub.status, () => "polling");
}

export function useRealtimeEvents(hub: RealtimeHub, listener: (event: RealtimeEvent) => void, enabled = true): void {
  const listenerRef = useRef(listener);
  useEffect(() => {
    listenerRef.current = listener;
  });
  useEffect(() => {
    if (!enabled) return;
    return hub.subscribe((event) => listenerRef.current(event));
  }, [hub, enabled]);
}

export function useRealtimeTopic(hub: RealtimeHub, topic: string | null): boolean {
  useEffect(() => (topic ? hub.watchTopic(topic) : undefined), [hub, topic]);
  const subscribe = useCallback((onChange: () => void) => hub.onChange(onChange), [hub]);
  const readIsLive = useCallback(() => (topic ? hub.isTopicLive(topic) : false), [hub, topic]);
  return useSyncExternalStore(subscribe, readIsLive, () => false);
}
