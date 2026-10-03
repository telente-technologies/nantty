import { create } from "zustand";

interface GuestSessionState {
  readonly isBrowsingAsGuest: boolean;
  readonly hasAcceptedGuestAnalytics: boolean;
  readonly hasDismissedGuestFeedBanner: boolean;
  readonly startBrowsingAsGuest: () => void;
  readonly acceptGuestAnalytics: () => void;
  readonly dismissGuestFeedBanner: () => void;
}

export const useGuestSessionStore = create<GuestSessionState>((set) => ({
  isBrowsingAsGuest: false,
  hasAcceptedGuestAnalytics: false,
  hasDismissedGuestFeedBanner: false,
  startBrowsingAsGuest: () => set({ isBrowsingAsGuest: true }),
  acceptGuestAnalytics: () => set({ hasAcceptedGuestAnalytics: true }),
  dismissGuestFeedBanner: () => set({ hasDismissedGuestFeedBanner: true }),
}));
