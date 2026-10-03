import { useCallback, useEffect, useRef, useState } from "react";

import type { LiveGift, LiveGiftSender, LiveGiftSentEvent } from "@/types";

import { comboEscalationStageForCount, didComboCrossThreshold } from "./liveGiftCatalog.hook";
import { useLiveGiftSentEvents } from "./liveGiftEventStream.hook";

const BANNER_VISIBLE_MS = 3_000;
const MAXIMUM_VISIBLE_BANNERS = 2;
const MAXIMUM_WAITING_BANNERS = 8;
const MAXIMUM_QUEUED_SPOTLIGHTS = 6;
const MAXIMUM_MICRO_FLOATS = 10;
const MAXIMUM_MEDIUM_FLYERS = 3;
const TOP_GIFTER_COUNT = 3;
const MAXIMUM_RECENT_GIFTS = 15;
const DEFAULT_DURATION_MS_BY_LEVEL = { micro: 1_200, medium: 2_400, large: 4_500, global: 6_500 } as const;

export interface LiveGiftAnimationEntry {
  readonly key: string;
  readonly event: LiveGiftSentEvent;
  readonly giftName: string;
  readonly durationMs: number;
  readonly escalationStage: number;
  readonly mode: "micro" | "medium" | "large" | "global";
}

export interface LiveGiftBannerEntry {
  readonly comboKey: string;
  readonly event: LiveGiftSentEvent;
  readonly giftName: string;
  readonly comboCount: number;
  readonly bumpKey: number;
}

export interface LiveTopGifter {
  readonly sender: LiveGiftSender;
  readonly totalCoins: number;
}

const comboKeyForGiftEvent = (event: LiveGiftSentEvent) => `${event.sender.id}:${event.comboId}`;

const mergeGiftEventIntoBanner = (banner: LiveGiftBannerEntry, event: LiveGiftSentEvent): LiveGiftBannerEntry => ({
  ...banner,
  event,
  comboCount: Math.max(banner.comboCount, event.comboCount),
  bumpKey: banner.bumpKey + 1,
});

const buildAnimationEntry = (event: LiveGiftSentEvent, gift: LiveGift | undefined, mode: LiveGiftAnimationEntry["mode"]): LiveGiftAnimationEntry => ({
  key: `${event.giftTransactionId}:${mode}`,
  event,
  giftName: gift?.name ?? "a gift",
  durationMs: mode === event.displayLevel ? (gift?.durationMs ?? DEFAULT_DURATION_MS_BY_LEVEL[mode]) : DEFAULT_DURATION_MS_BY_LEVEL[mode],
  escalationStage: comboEscalationStageForCount(event.comboCount),
  mode,
});

export function useLiveGiftOverlayQueues(liveId: string, streamerUserId: string, giftsById: ReadonlyMap<string, LiveGift>) {
  const [visibleBanners, setVisibleBanners] = useState<readonly LiveGiftBannerEntry[]>([]);
  const [spotlightQueue, setSpotlightQueue] = useState<readonly LiveGiftAnimationEntry[]>([]);
  const [microFloats, setMicroFloats] = useState<readonly LiveGiftAnimationEntry[]>([]);
  const [mediumFlyers, setMediumFlyers] = useState<readonly LiveGiftAnimationEntry[]>([]);
  const [topGifters, setTopGifters] = useState<readonly LiveTopGifter[]>([]);
  const [recentGifts, setRecentGifts] = useState<readonly LiveGiftSentEvent[]>([]);
  const [sessionTotalCoins, setSessionTotalCoins] = useState(0);
  const visibleRef = useRef<LiveGiftBannerEntry[]>([]);
  const waitingRef = useRef<LiveGiftBannerEntry[]>([]);
  const expiryTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const coinsBySenderRef = useRef(new Map<string, LiveTopGifter>());

  const publishVisibleBanners = useCallback(() => setVisibleBanners([...visibleRef.current]), []);

  const scheduleBannerExpiry = useCallback(
    (comboKey: string) => {
      const timers = expiryTimersRef.current;
      const existingTimer = timers.get(comboKey);
      if (existingTimer) clearTimeout(existingTimer);
      timers.set(
        comboKey,
        setTimeout(() => {
          timers.delete(comboKey);
          visibleRef.current = visibleRef.current.filter((banner) => banner.comboKey !== comboKey);
          const promoted = waitingRef.current.shift();
          if (promoted) {
            visibleRef.current.push(promoted);
            scheduleBannerExpiry(promoted.comboKey);
          }
          publishVisibleBanners();
        }, BANNER_VISIBLE_MS),
      );
    },
    [publishVisibleBanners],
  );

  const showGiftEventInBanners = useCallback(
    (event: LiveGiftSentEvent, giftName: string) => {
      const comboKey = comboKeyForGiftEvent(event);
      const visibleIndex = visibleRef.current.findIndex((banner) => banner.comboKey === comboKey);
      if (visibleIndex >= 0) {
        visibleRef.current[visibleIndex] = mergeGiftEventIntoBanner(visibleRef.current[visibleIndex]!, event);
        scheduleBannerExpiry(comboKey);
      } else {
        const waitingIndex = waitingRef.current.findIndex((banner) => banner.comboKey === comboKey);
        const freshBanner: LiveGiftBannerEntry = { comboKey, event, giftName, comboCount: event.comboCount, bumpKey: 0 };
        if (waitingIndex >= 0) waitingRef.current[waitingIndex] = mergeGiftEventIntoBanner(waitingRef.current[waitingIndex]!, event);
        else if (visibleRef.current.length < MAXIMUM_VISIBLE_BANNERS) {
          visibleRef.current.push(freshBanner);
          scheduleBannerExpiry(comboKey);
        } else if (waitingRef.current.length < MAXIMUM_WAITING_BANNERS) waitingRef.current.push(freshBanner);
      }
      publishVisibleBanners();
    },
    [publishVisibleBanners, scheduleBannerExpiry],
  );

  const addGiftEventToTopGifters = useCallback((event: LiveGiftSentEvent) => {
    const previous = coinsBySenderRef.current.get(event.sender.id);
    coinsBySenderRef.current.set(event.sender.id, { sender: event.sender, totalCoins: (previous?.totalCoins ?? 0) + event.totalCoins });
    setTopGifters([...coinsBySenderRef.current.values()].sort((a, b) => b.totalCoins - a.totalCoins).slice(0, TOP_GIFTER_COUNT));
  }, []);

  const enqueueExclusiveSpotlight = useCallback(
    (entry: LiveGiftAnimationEntry) => setSpotlightQueue((queue) => (queue.length >= MAXIMUM_QUEUED_SPOTLIGHTS ? queue : [...queue, entry])),
    [],
  );

  const playGiftEventAnimation = useCallback(
    (event: LiveGiftSentEvent) => {
      const gift = giftsById.get(event.giftId);
      const previousCount = event.comboCount - event.quantity;
      if (event.displayLevel === "micro") setMicroFloats((floats) => [...floats, buildAnimationEntry(event, gift, "micro")].slice(-MAXIMUM_MICRO_FLOATS));
      if (event.displayLevel === "medium") setMediumFlyers((flyers) => [...flyers, buildAnimationEntry(event, gift, "medium")].slice(-MAXIMUM_MEDIUM_FLYERS));
      if (event.displayLevel === "large" || event.displayLevel === "global") enqueueExclusiveSpotlight(buildAnimationEntry(event, gift, event.displayLevel));
      else if (didComboCrossThreshold(previousCount, event.comboCount, 100)) enqueueExclusiveSpotlight(buildAnimationEntry(event, gift, "global"));
      else if (didComboCrossThreshold(previousCount, event.comboCount, 50)) enqueueExclusiveSpotlight(buildAnimationEntry(event, gift, "large"));
    },
    [enqueueExclusiveSpotlight, giftsById],
  );

  useLiveGiftSentEvents(
    liveId,
    (event) => {
      showGiftEventInBanners(event, giftsById.get(event.giftId)?.name ?? "a gift");
      addGiftEventToTopGifters(event);
      playGiftEventAnimation(event);
      setSessionTotalCoins((total) => total + event.totalCoins);
      setRecentGifts((gifts) => [event, ...gifts.filter((gift) => gift.comboId !== event.comboId || gift.sender.id !== event.sender.id)].slice(0, MAXIMUM_RECENT_GIFTS));
    },
    streamerUserId,
  );

  const removeMicroFloat = useCallback((key: string) => setMicroFloats((floats) => floats.filter((entry) => entry.key !== key)), []);
  const removeMediumFlyer = useCallback((key: string) => setMediumFlyers((flyers) => flyers.filter((entry) => entry.key !== key)), []);

  useEffect(() => {
    const timers = expiryTimersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const finishCurrentSpotlight = useCallback(() => setSpotlightQueue((queue) => queue.slice(1)), []);

  return {
    visibleBanners,
    microFloats,
    removeMicroFloat,
    mediumFlyers,
    removeMediumFlyer,
    currentSpotlight: spotlightQueue[0] ?? null,
    finishCurrentSpotlight,
    topGifters,
    recentGifts,
    sessionTotalCoins,
  };
}
