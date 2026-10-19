import { create } from "zustand";

import { readDevicePreference, writeDevicePreference } from "@/utils/devicePreferenceStorage.util";
import { retryWhenAppComesToForeground } from "@/utils/secureStorage.util";

export const sensitiveConsentStorageKey = "zm.sensitiveConsentPostIds";
const maximumRememberedPosts = 300;

const readRememberedPostIds = (): readonly string[] | null => {
  const stored = readDevicePreference(sensitiveConsentStorageKey);
  if (!stored.available) return null;
  try {
    const parsed: unknown = stored.value ? JSON.parse(stored.value) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
};

const writeRememberedPostIds = (postIds: readonly string[]) => writeDevicePreference(sensitiveConsentStorageKey, JSON.stringify(postIds));

interface SensitiveConsentState {
  readonly consentedPostIds: readonly string[];
  readonly rememberConsentForPost: (postId: string) => void;
}

const postIdsReadAtLaunch = readRememberedPostIds();

export const useSensitiveConsentStore = create<SensitiveConsentState>()((set) => ({
  consentedPostIds: postIdsReadAtLaunch ?? [],
  rememberConsentForPost: (postId) =>
    set((state) => {
      if (state.consentedPostIds.includes(postId)) return state;
      const consentedPostIds = [postId, ...state.consentedPostIds].slice(0, maximumRememberedPosts);
      writeRememberedPostIds(consentedPostIds);
      return { consentedPostIds };
    }),
}));

if (postIdsReadAtLaunch === null) {
  retryWhenAppComesToForeground(() => {
    const stored = readRememberedPostIds();
    if (stored === null) return false;
    const current = useSensitiveConsentStore.getState().consentedPostIds;
    const consentedPostIds = [...new Set([...current, ...stored])].slice(0, maximumRememberedPosts);
    if (current.length > 0) writeRememberedPostIds(consentedPostIds);
    useSensitiveConsentStore.setState({ consentedPostIds });
    return true;
  });
}
