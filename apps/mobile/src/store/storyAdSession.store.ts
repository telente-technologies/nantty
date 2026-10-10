import { create } from "zustand";

import type { ID } from "@/types";
import type { StoryDecidedAd } from "@/types/social.type";

const FIRST_AD_AFTER_VIEWED = 3;
const VIEWS_BETWEEN_ADS = 5;

export const isStoryAdSlot = (viewedCount: number) =>
  viewedCount >= FIRST_AD_AFTER_VIEWED && (viewedCount - FIRST_AD_AFTER_VIEWED) % VIEWS_BETWEEN_ADS === 0;

interface StoryAdSessionState {
  readonly viewedCount: number;
  readonly lastAdViewedAt: number;
  readonly adsBySlot: Readonly<Record<number, StoryDecidedAd>>;
  readonly requestedSlots: readonly number[];
  readonly recordStoryViewed: () => number;
  readonly cacheAdForSlot: (slot: number, ad: StoryDecidedAd) => void;
  readonly markSlotRequested: (slot: number) => void;
  readonly markAdViewed: (slot: number) => void;
  readonly reset: () => void;
}

export const useStoryAdSessionStore = create<StoryAdSessionState>()((set) => ({
  viewedCount: 0,
  lastAdViewedAt: 0,
  adsBySlot: {},
  requestedSlots: [],
  recordStoryViewed: () => {
    let next = 0;
    set((state) => {
      next = state.viewedCount + 1;
      return { viewedCount: next };
    });
    return next;
  },
  cacheAdForSlot: (slot, ad) => set((state) => ({ adsBySlot: { ...state.adsBySlot, [slot]: ad } })),
  markSlotRequested: (slot) => set((state) => (state.requestedSlots.includes(slot) ? state : { requestedSlots: [...state.requestedSlots, slot] })),
  markAdViewed: (slot) => set((state) => ({ lastAdViewedAt: slot })),
  reset: () => set({ viewedCount: 0, lastAdViewedAt: 0, adsBySlot: {}, requestedSlots: [] }),
}));
