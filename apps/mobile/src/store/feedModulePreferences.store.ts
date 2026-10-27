import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { millisecondsPerDay } from "@/constants/feedModules.constant";
import {
  emptyGetVerifiedCardHistory,
  recordGetVerifiedCardDismissal,
  recordGetVerifiedCardImpression,
  recordGetVerifiedCardNeverAgain,
  recordOffersSurfaced,
  type GetVerifiedCardHistory,
} from "@/utils/getVerifiedCardFrequency.util";

const maximumDismissedPeople = 200;
const guestKey = "guest";

interface FeedModulePreferencesState {
  readonly suggestedClipsHiddenUntilByViewer: Readonly<Record<string, number>>;
  readonly getVerifiedHistoryByViewer: Readonly<Record<string, GetVerifiedCardHistory>>;
  readonly dismissedSuggestedPeopleByViewer: Readonly<Record<string, readonly string[]>>;
  readonly hideSuggestedClipsForDays: (viewerId: string | null, days: number, now?: number) => void;
  readonly recordGetVerifiedImpression: (viewerId: string, now?: number) => void;
  readonly dismissGetVerifiedCard: (viewerId: string, now?: number) => void;
  readonly neverShowGetVerifiedCard: (viewerId: string) => void;
  readonly markDiscountOffersSurfaced: (viewerId: string, offerIds: readonly string[]) => void;
  readonly dismissSuggestedPerson: (viewerId: string, personId: string) => void;
}

const keyFor = (viewerId: string | null) => viewerId ?? guestKey;

export const useFeedModulePreferencesStore = create<FeedModulePreferencesState>()(
  persist(
    (set) => {
      const updateHistory = (viewerId: string, update: (history: GetVerifiedCardHistory) => GetVerifiedCardHistory) =>
        set((state) => ({ getVerifiedHistoryByViewer: { ...state.getVerifiedHistoryByViewer, [viewerId]: update(state.getVerifiedHistoryByViewer[viewerId] ?? emptyGetVerifiedCardHistory) } }));
      return {
        suggestedClipsHiddenUntilByViewer: {},
        getVerifiedHistoryByViewer: {},
        dismissedSuggestedPeopleByViewer: {},
        hideSuggestedClipsForDays: (viewerId, days, now = Date.now()) =>
          set((state) => ({ suggestedClipsHiddenUntilByViewer: { ...state.suggestedClipsHiddenUntilByViewer, [keyFor(viewerId)]: now + days * millisecondsPerDay } })),
        recordGetVerifiedImpression: (viewerId, now = Date.now()) => updateHistory(viewerId, (history) => recordGetVerifiedCardImpression(history, now)),
        dismissGetVerifiedCard: (viewerId, now = Date.now()) => updateHistory(viewerId, (history) => recordGetVerifiedCardDismissal(history, now)),
        neverShowGetVerifiedCard: (viewerId) => updateHistory(viewerId, recordGetVerifiedCardNeverAgain),
        markDiscountOffersSurfaced: (viewerId, offerIds) => updateHistory(viewerId, (history) => recordOffersSurfaced(history, offerIds)),
        dismissSuggestedPerson: (viewerId, personId) =>
          set((state) => {
            const current = state.dismissedSuggestedPeopleByViewer[viewerId] ?? [];
            if (current.includes(personId)) return state;
            return { dismissedSuggestedPeopleByViewer: { ...state.dismissedSuggestedPeopleByViewer, [viewerId]: [...current, personId].slice(-maximumDismissedPeople) } };
          }),
      };
    },
    {
      name: "nantty.feedModulePreferences",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        suggestedClipsHiddenUntilByViewer: state.suggestedClipsHiddenUntilByViewer,
        getVerifiedHistoryByViewer: state.getVerifiedHistoryByViewer,
        dismissedSuggestedPeopleByViewer: state.dismissedSuggestedPeopleByViewer,
      }),
    },
  ),
);

export const isSuggestedClipsHiddenFor = (hiddenUntilByViewer: Readonly<Record<string, number>>, viewerId: string | null, now = Date.now()) =>
  (hiddenUntilByViewer[keyFor(viewerId)] ?? 0) > now;
