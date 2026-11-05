import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import type { AdEvent, AdPlacement, ID, SponsoredPlacement } from "@/types";

import { useAuthStore } from "@/store/auth.store";
import { useGuestSessionStore } from "@/store/guestSession.store";

import { api } from "../core/apiClient.service";

const PENDING_AD_EVENTS_STORAGE_KEY = "zm.pendingAdEvents";
const MAXIMUM_EVENTS_PER_BATCH = 25;
const MAXIMUM_PENDING_EVENTS_KEPT = 500;
const BATCH_FLUSH_DELAY_MS = 4_000;
export const SPONSORED_IMPRESSION_MINIMUM_VISIBLE_PERCENT = 50;
export const SPONSORED_IMPRESSION_MINIMUM_VISIBLE_MS = 1_000;

interface PendingAdEvent extends AdEvent {
  readonly occurredAt: string;
}

let pendingAdEvents: PendingAdEvent[] = [];
let hasLoadedPendingEventsFromStorage = false;
let scheduledFlushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushInProgress = false;
const impressionKeysRecordedThisSession = new Set<string>();

async function loadPendingAdEventsFromStorageOnce() {
  if (hasLoadedPendingEventsFromStorage) return;
  hasLoadedPendingEventsFromStorage = true;
  try {
    const saved = await AsyncStorage.getItem(PENDING_AD_EVENTS_STORAGE_KEY);
    const parsed = saved ? (JSON.parse(saved) as PendingAdEvent[]) : [];
    if (Array.isArray(parsed)) pendingAdEvents = [...parsed, ...pendingAdEvents].slice(-MAXIMUM_PENDING_EVENTS_KEPT);
  } catch {
    pendingAdEvents = [...pendingAdEvents];
  }
}

async function savePendingAdEventsToStorage() {
  await AsyncStorage.setItem(PENDING_AD_EVENTS_STORAGE_KEY, JSON.stringify(pendingAdEvents)).catch(() => undefined);
}

async function sendPendingAdEventsInBatchesWhileOnline() {
  if (isFlushInProgress) return;
  isFlushInProgress = true;
  try {
    await loadPendingAdEventsFromStorageOnce();
    while (pendingAdEvents.length > 0) {
      const network = await NetInfo.fetch();
      if (network.isConnected === false) break;
      const batch = pendingAdEvents.slice(0, MAXIMUM_EVENTS_PER_BATCH);
      await api.post<void>("/api/v1/ads/events", { events: batch });
      pendingAdEvents = pendingAdEvents.slice(batch.length);
      await savePendingAdEventsToStorage();
    }
  } catch {
    await savePendingAdEventsToStorage();
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
  const isSignedIn = useAuthStore.getState().status === "signedIn";
  if (!isSignedIn && !useGuestSessionStore.getState().hasAcceptedGuestAnalytics) return;
  pendingAdEvents = [...pendingAdEvents, { ...event, occurredAt: new Date().toISOString() }].slice(-MAXIMUM_PENDING_EVENTS_KEPT);
  savePendingAdEventsToStorage().catch(() => undefined);
  scheduleAdEventsFlush();
}

NetInfo.addEventListener((network) => {
  if (network.isConnected) scheduleAdEventsFlush();
});

export const adEventsService = {
  recordSponsoredImpressionOncePerSession: (sponsored: SponsoredPlacement, placement: AdPlacement, itemId: ID) => {
    const impressionKey = `${sponsored.campaignId}:${placement}:${itemId}`;
    if (impressionKeysRecordedThisSession.has(impressionKey)) return;
    impressionKeysRecordedThisSession.add(impressionKey);
    queueAdEventForBatchedDelivery({ campaignId: sponsored.campaignId, placement, type: "impression", itemId, token: sponsored.impressionToken });
  },
  recordSponsoredClick: (sponsored: SponsoredPlacement, placement: AdPlacement, itemId: ID, cardIndex?: number) =>
    queueAdEventForBatchedDelivery({ campaignId: sponsored.campaignId, placement, type: "click", itemId, token: sponsored.impressionToken, cardIndex }),
  recordSponsoredCardViewOncePerSession: (sponsored: SponsoredPlacement, placement: AdPlacement, itemId: ID, cardIndex: number) => {
    const viewKey = `${sponsored.campaignId}:${placement}:${itemId}:card:${cardIndex}`;
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
    const item = token.item as { id?: ID; sponsored?: SponsoredPlacement | null } | undefined;
    if (token.isViewable && item?.id && item.sponsored) {
      adEventsService.recordSponsoredImpressionOncePerSession(item.sponsored, placement, item.id);
    }
  }
}
