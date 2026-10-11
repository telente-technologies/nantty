"use client";

import type { ChatPayloadInput } from "@zudomart/chat-crypto";
import { useCallback, useEffect, useRef, useState } from "react";

import { uploadEncryptedChatAttachment } from "@/services/chatCrypto/chatAttachmentUpload.service";
import { storeChatEngine } from "@/services/chatCrypto/storeChatEngine";
import { createIdempotencyKey, readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Conversation, ConversationMessage, ConversationMessageKind, ConversationThread, DecryptedConversationMessage, InboxRealtimeStatus } from "@/types/conversation.type";
import { describeStoreChatError, latestPreview, mergeThreadMessages, withoutDeliveredPending, withPayload } from "@/utils/storeChat.util";

export type SecureSetupState = "checking" | "needsSetup" | "settingUp" | "ready";

export interface OutgoingDraft {
  readonly kind: ConversationMessageKind;
  readonly input: ChatPayloadInput;
  readonly file?: File;
  readonly attachmentKind?: "image" | "video" | "document";
}

interface PendingSend {
  readonly draft: OutgoingDraft;
  mediaId?: string;
  pointer?: ChatPayloadInput["attachment"];
}

const pollIntervalMs = 8_000;
const typingTimeoutMs = 6_000;
const threadPath = (conversationId: string) => `/seller/conversations/${encodeURIComponent(conversationId)}`;
const describe = (error: unknown) => describeStoreChatError(error) ?? readErrorMessageForDisplay(error);

export function useStoreThread(conversationId: string | null, viewerId: string | null, viewerName: string, onConversationChanged: () => void) {
  const [setupState, setSetupState] = useState<SecureSetupState>("checking");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DecryptedConversationMessage[]>([]);
  const [outgoing, setOutgoing] = useState<DecryptedConversationMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCustomerTyping, setIsCustomerTyping] = useState(false);
  const [status, setStatus] = useState<InboxRealtimeStatus>(storeChatEngine.realtimeStatus());
  const messagesRef = useRef<DecryptedConversationMessage[]>([]);
  const sendsRef = useRef(new Map<string, PendingSend>());
  const fetchingRef = useRef<Promise<void> | null>(null);
  const changedRef = useRef(onConversationChanged);
  useEffect(() => {
    changedRef.current = onConversationChanged;
    messagesRef.current = messages;
  }, [onConversationChanged, messages]);

  const absorb = useCallback(async (thread: ConversationThread, replace: boolean) => {
    if (!viewerId || !conversationId) return;
    const decrypted = await storeChatEngine.decryptThread(thread.messages, viewerId);
    setConversation(thread.conversation);
    setOutgoing((current) => withoutDeliveredPending(current, thread.messages));
    setMessages((current) => {
      const merged = replace ? mergeThreadMessages([], decrypted) : mergeThreadMessages(current, decrypted);
      const preview = latestPreview(merged);
      if (preview) void storeChatEngine.savePreview(conversationId, preview);
      return merged;
    });
  }, [viewerId, conversationId]);

  const refresh = useCallback((mode: "full" | "newer") => {
    if (!conversationId || !viewerId) return Promise.resolve();
    if (fetchingRef.current) return fetchingRef.current;
    const lastServerId = [...messagesRef.current].reverse().find((message) => !message.pending)?.id;
    const query = mode === "newer" && lastServerId ? { after: lastServerId, limit: 100 } : { limit: 100 };
    const run = sendSellerApiRequest<ConversationThread>(threadPath(conversationId), { query })
      .then((thread) => absorb(thread, mode === "full" || !lastServerId))
      .then(() => setErrorMessage(null))
      .catch((error: unknown) => setErrorMessage(describe(error)))
      .finally(() => (fetchingRef.current = null));
    fetchingRef.current = run;
    return run;
  }, [conversationId, viewerId, absorb]);

  useEffect(() => {
    if (!viewerId || !conversationId) return;
    let isCurrent = true;
    storeChatEngine.hasDeviceIdentity(viewerId).then((has) => {
      if (!isCurrent) return;
      if (!has) return setSetupState("needsSetup");
      return storeChatEngine.ensureReady(viewerId).then(() => isCurrent && setSetupState("ready"));
    }).catch((error: unknown) => isCurrent && (setErrorMessage(describe(error)), setSetupState("needsSetup")));
    return () => {
      isCurrent = false;
    };
  }, [viewerId, conversationId]);

  const setUpThisBrowser = useCallback(async () => {
    if (!viewerId) return;
    setSetupState("settingUp");
    try {
      await storeChatEngine.ensureReady(viewerId);
      setErrorMessage(null);
      setSetupState("ready");
    } catch (error) {
      setErrorMessage(describe(error));
      setSetupState("needsSetup");
    }
  }, [viewerId]);

  useEffect(() => {
    if (setupState !== "ready" || !conversationId) return;
    setIsLoading(true);
    void refresh("full").finally(() => setIsLoading(false));
    storeChatEngine.connectRealtime();
    const stopWatching = storeChatEngine.watchConversation(conversationId);
    let typingTimer: ReturnType<typeof setTimeout> | null = null;
    const stopEvents = storeChatEngine.onEvent((event) => {
      if (event.type === "subscriptions.revoked") {
        if (event.topics.includes(`conversation:${conversationId}`)) setErrorMessage("You no longer have access to this conversation.");
        return;
      }
      if (event.conversationId !== conversationId) return;
      if (event.type === "message.created") void refresh("newer").then(() => changedRef.current());
      else if (event.type === "message.updated" || event.type === "message.removed") void refresh("full");
      else if (event.type === "read") setConversation((current) => (current && event.readerId === current.customer.id ? { ...current, customerLastReadAt: event.lastReadAt } : current));
      else if (event.type === "typing" && event.user?.id !== viewerId) {
        setIsCustomerTyping(event.isTyping);
        if (typingTimer) clearTimeout(typingTimer);
        if (event.isTyping) typingTimer = setTimeout(() => setIsCustomerTyping(false), typingTimeoutMs);
      }
    });
    const stopStatus = storeChatEngine.onStatus((next) => {
      setStatus(next);
      if (next === "live") void refresh("newer");
    });
    return () => {
      stopWatching();
      stopEvents();
      stopStatus();
      if (typingTimer) clearTimeout(typingTimer);
    };
  }, [setupState, conversationId, viewerId, refresh]);

  useEffect(() => {
    if (setupState !== "ready" || status === "live") return;
    const timer = setInterval(() => document.visibilityState === "visible" && void refresh("newer"), pollIntervalMs);
    const onOnline = () => void refresh("newer");
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [setupState, status, refresh]);

  const unreadCount = conversation?.unreadCount ?? 0;
  useEffect(() => {
    if (!conversationId || setupState !== "ready" || unreadCount === 0) return;
    sendSellerApiRequest<Conversation>(`${threadPath(conversationId)}/read`, { method: "POST" })
      .then((updated) => {
        setConversation((current) => (current ? { ...current, unreadCount: 0, customerLastReadAt: updated.customerLastReadAt ?? current.customerLastReadAt } : current));
        changedRef.current();
      })
      .catch(() => undefined);
  }, [conversationId, setupState, unreadCount]);

  const perform = useCallback(async (key: string) => {
    const pending = sendsRef.current.get(key);
    if (!pending || !conversationId || !viewerId) return;
    const update = (patch: Partial<DecryptedConversationMessage>) => setOutgoing((current) => current.map((message) => (message.clientMessageId === key ? { ...message, ...patch } : message)));
    update({ failed: false, pending: true, pendingLabel: pending.draft.file ? "Encrypting…" : null });
    try {
      if (pending.draft.file && pending.mediaId === undefined) {
        const uploaded = await uploadEncryptedChatAttachment(pending.draft.file, pending.draft.attachmentKind ?? "document", (fraction) => update({ pendingLabel: `Uploading ${Math.round(fraction * 100)}%…` }));
        pending.mediaId = uploaded.mediaId;
        pending.pointer = uploaded.pointer;
      }
      const input: ChatPayloadInput = { ...pending.draft.input, ...(pending.pointer ? { attachment: pending.pointer } : {}) };
      const delivered = await storeChatEngine.sendEncrypted({ conversationId, viewerId, kind: pending.draft.kind, input, idempotencyKey: key, ...(pending.mediaId ? { mediaId: pending.mediaId } : {}) });
      const shown = withPayload(delivered as ConversationMessage, { v: 1, sentAt: delivered.createdAt, ...input });
      sendsRef.current.delete(key);
      setMessages((current) => mergeThreadMessages(current, [shown]));
      setOutgoing((current) => current.filter((message) => message.clientMessageId !== key));
      const preview = latestPreview([shown]);
      if (preview) void storeChatEngine.savePreview(conversationId, preview);
      storeChatEngine.sendTyping(conversationId, false);
      changedRef.current();
    } catch (error) {
      update({ pending: false, failed: true, pendingLabel: describe(error) });
    }
  }, [conversationId, viewerId]);

  const send = useCallback((draft: OutgoingDraft) => {
    if (!conversationId || !viewerId) return;
    const key = createIdempotencyKey("msg");
    sendsRef.current.set(key, { draft });
    const optimistic: DecryptedConversationMessage = {
      id: `pending_${key}`, conversationId, senderId: viewerId, kind: draft.kind, from: "seller", senderName: viewerName, createdAt: new Date().toISOString(), expiresAt: null, encryption: null,
      media: null, document: null, linkPreview: null, moderationHidden: false, clientMessageId: key, text: draft.input.text, attachment: null, location: null, poll: null, control: null,
      sharedReference: draft.input.sharedContent ?? null, decryptionNotice: null, pending: true, pendingLabel: draft.file ? `${draft.file.name} · Encrypting…` : null,
    };
    setOutgoing((current) => [...current, optimistic]);
    void perform(key);
  }, [conversationId, viewerId, viewerName, perform]);

  const retry = useCallback((key: string) => void perform(key), [perform]);
  const discard = useCallback((key: string) => {
    sendsRef.current.delete(key);
    setOutgoing((current) => current.filter((message) => message.clientMessageId !== key));
  }, []);

  return { setupState, setUpThisBrowser, conversation, messages, outgoing, errorMessage, isLoading, isCustomerTyping, status, send, retry, discard, reload: () => void refresh("full") };
}
