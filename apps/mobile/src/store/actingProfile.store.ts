import { create } from "zustand";

import type { ActingProfile } from "@/types/brand.type";

interface ActingProfileState {
  readonly actingProfile: ActingProfile | null;
  readonly setActingProfile: (profile: ActingProfile | null) => void;
}

export const useActingProfileStore = create<ActingProfileState>((set) => ({
  actingProfile: null,
  setActingProfile: (actingProfile) => set({ actingProfile }),
}));
