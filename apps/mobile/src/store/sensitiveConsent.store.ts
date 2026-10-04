import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const storageKey = "zm.sensitiveConsentPostIds";
const maximumRememberedPosts = 300;

const readRememberedPostIds = (): readonly string[] => {
  try {
    const stored = Platform.OS === "web" ? globalThis.localStorage?.getItem(storageKey) : SecureStore.getItem(storageKey);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
};

const writeRememberedPostIds = (postIds: readonly string[]) => {
  try {
    const serialised = JSON.stringify(postIds);
    if (Platform.OS === "web") globalThis.localStorage?.setItem(storageKey, serialised);
    else SecureStore.setItem(storageKey, serialised);
  } catch {
    return;
  }
};

interface SensitiveConsentState {
  readonly consentedPostIds: readonly string[];
  readonly rememberConsentForPost: (postId: string) => void;
}

export const useSensitiveConsentStore = create<SensitiveConsentState>()((set) => ({
  consentedPostIds: readRememberedPostIds(),
  rememberConsentForPost: (postId) =>
    set((state) => {
      if (state.consentedPostIds.includes(postId)) return state;
      const consentedPostIds = [postId, ...state.consentedPostIds].slice(0, maximumRememberedPosts);
      writeRememberedPostIds(consentedPostIds);
      return { consentedPostIds };
    }),
}));
