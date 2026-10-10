import type { ConsentChoices, ProductInteractionEvent, ProductInteractionRecord } from "@/types";

import { useAuthStore } from "@/store/auth.store";
import { useGuestSessionStore } from "@/store/guestSession.store";

import { consentsService } from "../account/consents.service";

const FLUSH_DELAY_MS = 5000;
const MAX_BATCH_SIZE = 20;
const PERSONALIZATION_EVENTS: readonly ProductInteractionEvent[] = [
  "product.viewed",
  "product.clicked",
  "search.performed",
  "seller.viewed",
  "category.viewed",
];

const NO_CONSENT: ConsentChoices = { personalization: false, advertising: false, analytics: false, marketing: false };

let pendingEvents: ProductInteractionRecord[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let consentsRequest: Promise<ConsentChoices> | null = null;

const loadGuestConsents = (): ConsentChoices => ({ ...NO_CONSENT, analytics: useGuestSessionStore.getState().hasAcceptedGuestAnalytics });

const loadConsents = (): Promise<ConsentChoices> =>
  useAuthStore.getState().status === "signedIn"
    ? consentsService.fetchMyConsents().then((record) => record.consents, () => NO_CONSENT)
    : Promise.resolve(loadGuestConsents());

export const refreshTrackingConsents = () => {
  consentsRequest = loadConsents();
};

export const flushProductInteractions = async () => {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  const batch = pendingEvents;
  pendingEvents = [];
  if (batch.length === 0) return;
  await consentsService.sendProductInteractions(batch).catch(() => undefined);
};

export const trackProductInteraction = async (event: ProductInteractionEvent, payload: ProductInteractionRecord["payload"] = {}) => {
  consentsRequest ??= loadConsents();
  const consents = await consentsRequest;
  if (!consents.analytics) return;
  if (PERSONALIZATION_EVENTS.includes(event) && !consents.personalization) return;
  pendingEvents.push({ event, payload, occurredAt: new Date().toISOString() });
  if (pendingEvents.length >= MAX_BATCH_SIZE) void flushProductInteractions();
  else flushTimer ??= setTimeout(() => void flushProductInteractions(), FLUSH_DELAY_MS);
};
