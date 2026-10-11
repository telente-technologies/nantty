"use client";

import { type InfiniteData, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import { createIdempotencyKey } from "@/services/clientApi.service";
import type { Message, Page } from "@/types";
import { buildPendingMessage, insertConfirmedMessage, rollsBackOnFailure } from "@/utils/chatOptimistic.util";

export type OptimisticPerform = (idempotencyKey: string, reportProgress: (label: string) => void) => Promise<Message>;

export function useOptimisticSends(conversationId: string, viewerId: string, onRolledBack: (error: unknown) => void) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Message[]>([]);
  const performs = useRef(new Map<string, OptimisticPerform>());

  const update = useCallback((key: string, change: ((message: Message) => Message) | null) => {
    setPending((current) => (change === null ? current.filter((message) => message.clientMessageId !== key) : current.map((message) => (message.clientMessageId === key ? change(message) : message))));
  }, []);

  const run = useCallback((key: string, kind: Message["kind"]) => {
    const perform = performs.current.get(key);
    if (!perform) return;
    update(key, (message) => ({ ...message, deliveryState: "pending" }));
    perform(key, (label) => update(key, (message) => ({ ...message, pendingLabel: label }))).then(
      (confirmed) => {
        queryClient.setQueryData<InfiniteData<Page<Message>>>(["messages", conversationId], (data) => (data ? { ...data, pages: insertConfirmedMessage(data.pages, confirmed) as Page<Message>[] } : data));
        performs.current.delete(key);
        update(key, null);
      },
      (error: unknown) => {
        if (rollsBackOnFailure({ kind })) {
          performs.current.delete(key);
          update(key, null);
          onRolledBack(error);
          return;
        }
        update(key, (message) => ({ ...message, deliveryState: "failed", pendingLabel: null }));
      },
    );
  }, [conversationId, onRolledBack, queryClient, update]);

  const send = useCallback((draft: Partial<Message>, perform: OptimisticPerform) => {
    const key = createIdempotencyKey("msg");
    performs.current.set(key, perform);
    setPending((current) => [...current, buildPendingMessage(key, conversationId, viewerId, draft, new Date())]);
    run(key, draft.kind);
  }, [conversationId, viewerId, run]);

  const retry = useCallback((message: Message) => {
    if (message.clientMessageId) run(message.clientMessageId, message.kind);
  }, [run]);

  const discard = useCallback((message: Message) => {
    if (!message.clientMessageId) return;
    performs.current.delete(message.clientMessageId);
    update(message.clientMessageId, null);
  }, [update]);

  return { pending, send, retry, discard };
}
