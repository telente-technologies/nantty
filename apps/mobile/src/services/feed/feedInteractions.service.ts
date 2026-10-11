import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { AppState } from "react-native";

import { ApiError } from "@/errors/api.error";
import { useActingProfileStore } from "@/store/actingProfile.store";
import { useAuthStore } from "@/store/auth.store";
import type { ID } from "@/types";
import { isContentOwnedBy } from "@/utils/postOwnership.util";

import { api } from "../core/apiClient.service";

export type FeedInteractionSurface = "feed" | "clips" | "profile" | "post_detail" | "explore" | "hashtag" | "search";
export type FeedInteractionKind = "view" | "dwell" | "watch" | "link_click" | "profile_click" | "follow";

export interface FeedInteractionTarget {
  readonly postId: ID;
  readonly authorId: ID;
  readonly postedAsId?: ID | null;
}

export interface FeedInteraction {
  readonly postId: ID;
  readonly kind: FeedInteractionKind;
  readonly surface: FeedInteractionSurface;
  readonly dwellMs?: number;
  readonly watchFraction?: number;
  readonly watchMs?: number;
  readonly loopCount?: number;
  readonly durationMs?: number;
  readonly position?: number;
}

export interface ClipWatchSummary {
  readonly watchMs: number;
  readonly durationMs: number;
  readonly watchFraction: number;
  readonly loopCount: number;
}

interface PendingFeedInteraction extends FeedInteraction {
  readonly accountId: ID;
}

export const FEED_INTERACTIONS_BATCH_PATH = "/api/v1/feeds/interactions/batch";
export const MAXIMUM_INTERACTIONS_PER_BATCH = 50;
const PENDING_STORAGE_KEY = "zm.pendingFeedInteractions";
const MAXIMUM_PENDING_KEPT = 500;
const BATCH_FLUSH_DELAY_MS = 4_000;
const MAXIMUM_RETRY_DELAY_MS = 5 * 60_000;
const MAXIMUM_MILLISECONDS = 3_600_000;
const MAXIMUM_LOOPS = 100;
const MAXIMUM_POSITION = 10_000;

let pending: PendingFeedInteraction[] = [];
let hydration: Promise<void> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;
let consecutiveFailures = 0;
const viewKeysRecordedThisSession = new Set<string>();

const clampInteger = (value: number, maximum: number) => Math.min(maximum, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));

export function sanitizeFeedInteraction(interaction: FeedInteraction): FeedInteraction {
  const { postId, kind, surface } = interaction;
  const optional = (key: "dwellMs" | "watchMs" | "durationMs" | "loopCount" | "position", maximum: number) =>
    interaction[key] === undefined ? {} : { [key]: clampInteger(interaction[key]!, maximum) };
  return {
    postId,
    kind,
    surface,
    ...optional("dwellMs", MAXIMUM_MILLISECONDS),
    ...optional("watchMs", MAXIMUM_MILLISECONDS),
    ...optional("durationMs", MAXIMUM_MILLISECONDS),
    ...optional("loopCount", MAXIMUM_LOOPS),
    ...optional("position", MAXIMUM_POSITION),
    ...(interaction.watchFraction === undefined ? {} : { watchFraction: Math.min(1, Math.max(0, Number.isFinite(interaction.watchFraction) ? interaction.watchFraction : 0)) }),
  };
}

export function isOwnedByViewer(target: FeedInteractionTarget): boolean {
  const content = { author: { id: target.authorId }, postedAs: target.postedAsId ? { id: target.postedAsId } : null };
  return isContentOwnedBy(content, useAuthStore.getState().user?.id, useActingProfileStore.getState().actingProfile?.id);
}

function currentAccountId(): ID | null {
  const { status, user } = useAuthStore.getState();
  return status === "signedIn" && user ? user.id : null;
}

function loadPendingFromStorageOnce(): Promise<void> {
  hydration ??= (async () => {
    try {
      const saved = await AsyncStorage.getItem(PENDING_STORAGE_KEY);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) pending = [...(parsed as PendingFeedInteraction[]), ...pending].slice(-MAXIMUM_PENDING_KEPT);
    } catch {
      pending = [...pending];
    }
  })();
  return hydration;
}

async function savePendingToStorage() {
  await loadPendingFromStorageOnce();
  await AsyncStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(pending)).catch(() => undefined);
}

export function isPermanentlyRejected(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;
}

export function retryDelayAfterFailures(failures: number): number {
  return Math.min(MAXIMUM_RETRY_DELAY_MS, BATCH_FLUSH_DELAY_MS * 2 ** Math.max(0, failures - 1));
}

async function sendPendingInBatches() {
  if (isFlushing) return;
  isFlushing = true;
  try {
    await loadPendingFromStorageOnce();
    const accountId = currentAccountId();
    pending = accountId ? pending.filter((event) => event.accountId === accountId) : [];
    while (pending.length > 0) {
      const network = await NetInfo.fetch();
      if (network.isConnected === false) break;
      const batch = pending.slice(0, MAXIMUM_INTERACTIONS_PER_BATCH);
      try {
        await api.post<{ accepted: number; skipped: number }>(FEED_INTERACTIONS_BATCH_PATH, { events: batch.map(({ accountId: _owner, ...event }) => event) });
      } catch (error) {
        if (!isPermanentlyRejected(error)) throw error;
      }
      pending = pending.slice(batch.length);
      consecutiveFailures = 0;
      await savePendingToStorage();
    }
  } catch {
    consecutiveFailures += 1;
    await savePendingToStorage();
    scheduleFlush(retryDelayAfterFailures(consecutiveFailures));
  } finally {
    isFlushing = false;
  }
}

function scheduleFlush(delayMs = BATCH_FLUSH_DELAY_MS) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    sendPendingInBatches().catch(() => undefined);
  }, delayMs);
}

function flushNow() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  return sendPendingInBatches();
}

function enqueue(target: FeedInteractionTarget, interaction: FeedInteraction) {
  const accountId = currentAccountId();
  if (!accountId || isOwnedByViewer(target)) return;
  pending = [...pending, { ...sanitizeFeedInteraction(interaction), accountId }].slice(-MAXIMUM_PENDING_KEPT);
  savePendingToStorage().catch(() => undefined);
  if (pending.length >= MAXIMUM_INTERACTIONS_PER_BATCH) flushNow().catch(() => undefined);
  else scheduleFlush(consecutiveFailures > 0 ? retryDelayAfterFailures(consecutiveFailures) : BATCH_FLUSH_DELAY_MS);
}

NetInfo.addEventListener((network) => {
  if (network.isConnected && pending.length > 0) scheduleFlush();
});

AppState.addEventListener("change", (state) => {
  if (state === "background" || state === "inactive") flushNow().catch(() => undefined);
});

useAuthStore.subscribe((state, previous) => {
  if (previous.status === "signedIn" && state.status !== "signedIn") {
    pending = [];
    viewKeysRecordedThisSession.clear();
    savePendingToStorage().catch(() => undefined);
  }
});

export const feedInteractionsService = {
  recordViewOncePerSession: (target: FeedInteractionTarget, surface: FeedInteractionSurface, position?: number): boolean => {
    const key = `${surface}:${target.postId}`;
    if (viewKeysRecordedThisSession.has(key) || !currentAccountId() || isOwnedByViewer(target)) return false;
    viewKeysRecordedThisSession.add(key);
    enqueue(target, { postId: target.postId, kind: "view", surface, position });
    return true;
  },
  recordDwell: (target: FeedInteractionTarget, surface: FeedInteractionSurface, dwellMs: number, position?: number) => {
    if (dwellMs > 0) enqueue(target, { postId: target.postId, kind: "dwell", surface, dwellMs, position });
  },
  recordClipWatch: (target: FeedInteractionTarget, surface: FeedInteractionSurface, watch: ClipWatchSummary) => {
    if (watch.watchMs > 0) enqueue(target, { postId: target.postId, kind: "watch", surface, ...watch });
  },
  recordLinkClick: (target: FeedInteractionTarget, surface: FeedInteractionSurface) => enqueue(target, { postId: target.postId, kind: "link_click", surface }),
  recordProfileClick: (target: FeedInteractionTarget, surface: FeedInteractionSurface) => enqueue(target, { postId: target.postId, kind: "profile_click", surface }),
  recordFollow: (target: FeedInteractionTarget, surface: FeedInteractionSurface) => enqueue(target, { postId: target.postId, kind: "follow", surface }),
  flushPendingInteractionsNow: () => flushNow(),
  pendingInteractionCountForTesting: () => pending.length,
  simulateAppRestartForTesting: () => {
    pending = [];
    hydration = null;
    isFlushing = false;
    consecutiveFailures = 0;
    viewKeysRecordedThisSession.clear();
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
  },
  resetForTesting: async () => {
    feedInteractionsService.simulateAppRestartForTesting();
    await AsyncStorage.removeItem(PENDING_STORAGE_KEY);
  },
};

export const interactionTargetOf = (post: { readonly id: ID; readonly author: { readonly id: ID }; readonly postedAs?: { readonly id: ID } | null }): FeedInteractionTarget => ({
  postId: post.id,
  authorId: post.author.id,
  postedAsId: post.postedAs?.id ?? null,
});
