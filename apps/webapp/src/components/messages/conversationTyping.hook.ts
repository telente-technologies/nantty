"use client";

import { useRealtimeEvents } from "@zudomart/web-kit/src/realtime/realtimeHooks";
import { useCallback, useEffect, useRef, useState } from "react";

import { webappRealtime } from "@/services/realtime/webappRealtime.service";
import { readTypingSignal } from "@/utils/realtimeCache.util";

const typingVisibleMs = 6_000;
const typingResendMs = 3_000;
const typingIdleMs = 4_000;

export function useConversationTyping(conversationId: string, viewerId: string, isRealtime: boolean) {
  const [typists, setTypists] = useState<ReadonlyMap<string, { readonly name: string | null; readonly until: number }>>(new Map());
  const lastSentAt = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useRealtimeEvents(webappRealtime, (event) => {
    const signal = readTypingSignal(event);
    if (!signal || signal.conversationId !== conversationId || signal.userId === viewerId) return;
    setTypists((current) => {
      const next = new Map(current);
      if (signal.isTyping) next.set(signal.userId, { name: signal.name, until: Date.now() + typingVisibleMs });
      else next.delete(signal.userId);
      return next;
    });
  });

  useEffect(() => {
    if (typists.size === 0) return;
    const nextExpiry = Math.min(...[...typists.values()].map((typist) => typist.until));
    const timer = setTimeout(() => setTypists((current) => new Map([...current].filter(([, typist]) => typist.until > Date.now()))), Math.max(0, nextExpiry - Date.now()) + 50);
    return () => clearTimeout(timer);
  }, [typists]);

  const stopTyping = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    if (lastSentAt.current === 0) return;
    lastSentAt.current = 0;
    webappRealtime.sendTyping(conversationId, false);
  }, [conversationId]);

  const noteDraftChanged = useCallback(
    (text: string) => {
      if (!isRealtime) return;
      if (text.trim() === "") return stopTyping();
      if (Date.now() - lastSentAt.current > typingResendMs) {
        lastSentAt.current = Date.now();
        webappRealtime.sendTyping(conversationId, true);
      }
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(stopTyping, typingIdleMs);
    },
    [conversationId, isRealtime, stopTyping],
  );

  useEffect(() => stopTyping, [stopTyping]);

  const names = [...typists.values()].map((typist) => typist.name).filter((name): name is string => Boolean(name));
  const typingLabel = typists.size === 0 ? null : typists.size > 1 ? "Several people are typing…" : names[0] ? `${names[0]} is typing…` : "Typing…";
  return { typingLabel, noteDraftChanged, stopTyping };
}
