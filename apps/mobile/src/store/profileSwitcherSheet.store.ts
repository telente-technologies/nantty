import { create } from "zustand";

interface ProfileSwitcherSheetState {
  readonly isProfileSwitcherSheetVisible: boolean;
  readonly openProfileSwitcherSheet: () => void;
  readonly closeProfileSwitcherSheet: () => void;
}

export const useProfileSwitcherSheetStore = create<ProfileSwitcherSheetState>((set) => ({
  isProfileSwitcherSheetVisible: false,
  openProfileSwitcherSheet: () => set({ isProfileSwitcherSheetVisible: true }),
  closeProfileSwitcherSheet: () => set({ isProfileSwitcherSheetVisible: false }),
}));
