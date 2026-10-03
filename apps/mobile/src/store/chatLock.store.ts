import { create } from "zustand";

import {
  DEFAULT_CHAT_LOCK_PREFERENCES,
  hasChatPasscode,
  readChatLockPreferences,
  removeChatPasscodeAndPreferences,
  saveChatLockPreferences,
  type ChatLockPreferences,
} from "@/utils/chatPasscode.util";

interface ChatLockState extends ChatLockPreferences {
  readonly isLoaded: boolean;
  readonly isPasscodeSet: boolean;
  readonly isLocked: boolean;
  readonly loadFromDevice: () => Promise<void>;
  readonly refreshPasscodeFlag: () => Promise<void>;
  readonly unlock: () => void;
  readonly lockNow: () => void;
  readonly lockIfBackgroundedTooLong: (backgroundedAtMs: number) => void;
  readonly updatePreferences: (update: Partial<ChatLockPreferences>) => Promise<void>;
  readonly removePasscode: () => Promise<void>;
}

export const useChatLockStore = create<ChatLockState>((set, get) => ({
  ...DEFAULT_CHAT_LOCK_PREFERENCES,
  isLoaded: false,
  isPasscodeSet: false,
  isLocked: false,
  loadFromDevice: async () => {
    const [isPasscodeSet, preferences] = await Promise.all([hasChatPasscode(), readChatLockPreferences()]);
    set({ ...preferences, isPasscodeSet, isLocked: isPasscodeSet, isLoaded: true });
  },
  refreshPasscodeFlag: async () => set({ isPasscodeSet: await hasChatPasscode() }),
  unlock: () => set({ isLocked: false }),
  lockNow: () => set((state) => ({ isLocked: state.isPasscodeSet })),
  lockIfBackgroundedTooLong: (backgroundedAtMs) => {
    const { isPasscodeSet, autoLockSeconds } = get();
    if (isPasscodeSet && Date.now() - backgroundedAtMs >= autoLockSeconds * 1000) set({ isLocked: true });
  },
  updatePreferences: async (update) => {
    const { biometricsEnabled, autoLockSeconds } = { ...get(), ...update };
    set({ biometricsEnabled, autoLockSeconds });
    await saveChatLockPreferences({ biometricsEnabled, autoLockSeconds });
  },
  removePasscode: async () => {
    await removeChatPasscodeAndPreferences();
    set({ ...DEFAULT_CHAT_LOCK_PREFERENCES, isPasscodeSet: false, isLocked: false });
  },
}));
