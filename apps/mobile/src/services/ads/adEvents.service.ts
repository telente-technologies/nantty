import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Crypto from "expo-crypto";
import type { AdEvent, AdPlacement, ID, SponsoredPlacement } from "@/types";

import { useAuthStore } from "@/store/auth.store";

import { api, generateIdempotencyKey } from "../core/apiClient.service";

const LEGACY_UNSCOPED_AD_EVENTS_STORAGE_KEY = "zm.pendingAdEvents";
const PENDING_AD_EVENTS_STORAGE_KEY_PREFIX = "zm.pendingAdEvents.account.";
const MAXIMUM_PENDING_EVENTS_KEPT = 500;
const BATCH_FLUSH_DELAY_MS = 4_000;
export const SPONSORED_IMPRESSION_MINIMUM_VISIBLE_PERCENT = 50;
export const SPONSORED_IMPRESSION_MINIMUM_VISIBLE_MS = 1_000;

interface PendingAdEvent extends AdEvent {
  readonly occurredAt: string;
  readonly eventId: string;
}

const pendingAdEventsByAccount = new Map<string, PendingAdEvent[]>();
const loadedAccountQueues = new Set<string>();
const pendingAccountLoads = new Map<string, Promise<void>>();
const pendingAccountWrites = new Map<string, Promise<void>>();
let scheduledFlushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushInProgress = false;
let discardedLegacyUnscopedQueue = false;
const impressionKeysRecordedThisSession = new Set<string>();

function currentAccountId(): string | null {
  const auth = useAuthStore.getState();
  if (auth.status !== "signedIn") return null;
  if (auth.user?.id) return auth.user.id;
  const payload = auth.accessToken?.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const binary = atob(base64);
    const decoded = decodeURIComponent(Array.from(binary, (character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
    const subject = (JSON.parse(decoded) as { sub?: unknown }).sub;
    return typeof subject === "string" && subject.length > 0 ? subject : null;
  } catch {
    return null;
  }
}

async function storageKeyForAccount(accountId: string) {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, accountId);
  return `${PENDING_AD_EVENTS_STORAGE_KEY_PREFIX}${digest}`;
}

function loadPendingAdEventsForAccount(accountId: string): Promise<void> {
  if (loadedAccountQueues.has(accountId)) return Promise.resolve();
  const currentLoad = pendingAccountLoads.get(accountId);
  if (currentLoad) return currentLoad;
  const load = (async () => {
    try {
      const storageKey = await storageKeyForAccount(accountId);
      const saved = await AsyncStorage.getItem(storageKey);
      const parsed = saved ? (JSON.parse(saved) as Array<Partial<PendingAdEvent>>) : [];
      if (Array.isArray(parsed)) {
        const restored = parsed.flatMap((event) => {
          if (!event || typeof event !== "object" || typeof event.campaignId !== "string" || typeof event.token !== "string" || typeof event.itemId !== "string") return [];
          if (!( ["feed", "clips", "stories", "mart", "search", "live_discovery", "live", "feedCommentThread"] as readonly string[]).includes(event.placement ?? "")) return [];
          if (!( ["impression", "click", "card_view"] as readonly string[]).includes(event.type ?? "")) return [];
          return [{ ...event, eventId: typeof event.eventId === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(event.eventId) ? event.eventId : generateIdempotencyKey(), occurredAt: typeof event.occurredAt === "string" ? event.occurredAt : new Date().toISOString() } as PendingAdEvent];
        });
        pendingAdEventsByAccount.set(accountId, [...restored, ...(pendingAdEventsByAccount.get(accountId) ?? [])].slice(-MAXIMUM_PENDING_EVENTS_KEPT));
        await savePendingAdEventsToStorage(accountId);
      }
      // The prior global queue has no reliable owner; never risk sending it under another account.
      if (!discardedLegacyUnscopedQueue) {
        await AsyncStorage.removeItem(LEGACY_UNSCOPED_AD_EVENTS_STORAGE_KEY).catch(() => undefined);
        discardedLegacyUnscopedQueue = true;
      }
    } catch {
      pendingAdEventsByAccount.set(accountId, pendingAdEventsByAccount.get(accountId) ?? []);
    } finally {
      loadedAccountQueues.add(accountId);
      pendingAccountLoads.delete(accountId);
    }
  })();
  pendingAccountLoads.set(accountId, load);
  return load;
}

function savePendingAdEventsToStorage(accountId: string): Promise<void> {
  const previousWrite = pendingAccountWrites.get(accountId);
  const write = (async () => {
    await previousWrite?.catch(() => undefined);
    const storageKey = await storageKeyForAccount(accountId);
    await AsyncStorage.setItem(storageKey, JSON.stringify(pendingAdEventsByAccount.get(accountId) ?? [])).catch(() => undefined);
  })();
  pendingAccountWrites.set(accountId, write);
  return write.finally(() => {
    if (pendingAccountWrites.get(accountId) === write) pendingAccountWrites.delete(accountId);
  });
}

async function sendPendingAdEventsInBatchesWhileOnline() {
  if (isFlushInProgress) return;
  const accountId = currentAccountId();
  if (!accountId) return;
  isFlushInProgress = true;
  try {
    await loadPendingAdEventsForAccount(accountId);
    while ((pendingAdEventsByAccount.get(accountId)?.length ?? 0) > 0) {
      await pendingAccountWrites.get(accountId)?.catch(() => undefined);
      const network = await NetInfo.fetch();
      if (network.isConnected === false) break;
      const event = pendingAdEventsByAccount.get(accountId)?.[0];
      if (!event) break;
      // Single-event requests make replay semantics unambiguous even if a later event fails.
      await api.post<void>("/api/v1/ads/events", { events: [event] }, { idempotencyKey: event.eventId });
      pendingAdEventsByAccount.set(accountId, pendingAdEventsByAccount.get(accountId)?.slice(1) ?? []);
      await savePendingAdEventsToStorage(accountId);
    }
  } catch {
    await savePendingAdEventsToStorage(accountId);
  } finally {
    isFlushInProgress = false;
  }
}

function scheduleAdEventsFlush() {
  if (scheduledFlushTimer) return;
  scheduledFlushTimer = setTimeout(() => {
    scheduledFlushTimer = null;
    sendPendingAdEventsInBatchesWhileOnline().catch(() => undefined);
  }, BATCH_FLUSH_DELAY_MS);
}

function queueAdEventForBatchedDelivery(event: AdEvent) {
  // The current /ads/events route requires authentication; do not later send guest data as an account.
  const accountId = currentAccountId();
  if (!accountId) return;
  void (async () => {
    await loadPendingAdEventsForAccount(accountId);
    pendingAdEventsByAccount.set(accountId, [
      ...(pendingAdEventsByAccount.get(accountId) ?? []),
      { ...event, eventId: generateIdempotencyKey(), occurredAt: new Date().toISOString() },
    ].slice(-MAXIMUM_PENDING_EVENTS_KEPT));
    await savePendingAdEventsToStorage(accountId);
    scheduleAdEventsFlush();
  })().catch(() => undefined);
}

NetInfo.addEventListener((network) => {
  if (network.isConnected) scheduleAdEventsFlush();
});

export const adEventsService = {
  recordSponsoredImpressionOncePerSession: (sponsored: SponsoredPlacement, placement: AdPlacement, itemId: ID) => {
    const accountId = currentAccountId();
    if (!accountId) return;
    const impressionKey = `${accountId}:${sponsored.campaignId}:${placement}:${itemId}`;
    if (impressionKeysRecordedThisSession.has(impressionKey)) return;
    impressionKeysRecordedThisSession.add(impressionKey);
    queueAdEventForBatchedDelivery({ campaignId: sponsored.campaignId, placement, type: "impression", itemId, token: sponsored.impressionToken });
  },
  recordSponsoredClick: (sponsored: SponsoredPlacement, placement: AdPlacement, itemId: ID, cardIndex?: number) =>
    queueAdEventForBatchedDelivery({ campaignId: sponsored.campaignId, placement, type: "click", itemId, token: sponsored.impressionToken, cardIndex }),
  recordSponsoredCardViewOncePerSession: (sponsored: SponsoredPlacement, placement: AdPlacement, itemId: ID, cardIndex: number) => {
    const accountId = currentAccountId();
    if (!accountId) return;
    const viewKey = `${accountId}:${sponsored.campaignId}:${placement}:${itemId}:card:${cardIndex}`;
    if (impressionKeysRecordedThisSession.has(viewKey)) return;
    impressionKeysRecordedThisSession.add(viewKey);
    queueAdEventForBatchedDelivery({ campaignId: sponsored.campaignId, placement, type: "card_view", itemId, token: sponsored.impressionToken, cardIndex });
  },
  flushPendingAdEventsNow: () => sendPendingAdEventsInBatchesWhileOnline(),
};

export const sponsoredImpressionViewabilityConfig = {
  itemVisiblePercentThreshold: SPONSORED_IMPRESSION_MINIMUM_VISIBLE_PERCENT,
  minimumViewTime: SPONSORED_IMPRESSION_MINIMUM_VISIBLE_MS,
} as const;

interface SponsoredViewToken {
  readonly isViewable: boolean;
  readonly item: unknown;
}

export function recordImpressionsForViewableSponsoredItems(
  viewableItems: readonly SponsoredViewToken[],
  placement: AdPlacement,
) {
  for (const token of viewableItems) {
    const item = token.item as { id?: ID; sponsored?: SponsoredPlacement | null; post?: { id?: ID; sponsored?: SponsoredPlacement | null } } | undefined;
    const id = item?.id ?? item?.post?.id;
    const sponsored = item?.sponsored ?? item?.post?.sponsored;
    if (token.isViewable && id && sponsored) adEventsService.recordSponsoredImpressionOncePerSession(sponsored, placement, id);
  }
}
