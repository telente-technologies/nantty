import { create } from "zustand";

import { storageKeys } from "@/constants/storageKeys.constant";
import type { User } from "@/types";
import { showToast } from "@/store/toast.store";
import { moveSessionKeychainItemsToBackgroundReadableAccessOnce } from "@/utils/keychainAccessibilityMigration.util";
import { retryWhenAppComesToForeground, secureStorage, SecureStorageUnavailableError } from "@/utils/secureStorage.util";

interface Tokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

interface AuthState {
  readonly status: "loading" | "signedOut" | "signedIn";
  readonly user: User | null;
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
  readonly restoreSavedSession: () => Promise<void>;
  readonly saveSignedInSession: (session: Tokens & { user: User; notice?: string | null }) => Promise<void>;
  readonly replaceSessionTokens: (tokens: Tokens) => Promise<void>;
  readonly updateSignedInUser: (user: User) => void;
  readonly clearSessionAndSignOut: () => Promise<void>;
}

const signOutHooks = new Set<() => Promise<void>>();
const sessionTokenAccess = "backgroundReadableDeviceOnly";
let restoringSavedSession: Promise<void> | null = null;
let isWaitingForKeychainToUnlock = false;

const restoreSessionOnceTheKeychainUnlocks = () => {
  if (isWaitingForKeychainToUnlock) return;
  isWaitingForKeychainToUnlock = true;
  retryWhenAppComesToForeground(() => {
    if (useAuthStore.getState().status !== "loading") return true;
    useAuthStore.getState().restoreSavedSession().catch(() => useAuthStore.setState({ status: "signedOut" }));
    return true;
  });
};

async function readSavedSessionTokens(): Promise<readonly [string | null, string | null] | null> {
  try {
    return await Promise.all([secureStorage.get(storageKeys.accessToken), secureStorage.get(storageKeys.refreshToken)]);
  } catch (error) {
    if (error instanceof SecureStorageUnavailableError) return null;
    throw error;
  }
}

export const registerSignOutHook = (hook: () => Promise<void>) => {
  signOutHooks.add(hook);
  return () => signOutHooks.delete(hook);
};

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  user: null,
  accessToken: null,
  refreshToken: null,
  restoreSavedSession: () => {
    restoringSavedSession ??= (async () => {
      const tokens = await readSavedSessionTokens();
      if (tokens === null) {
        isWaitingForKeychainToUnlock = false;
        restoreSessionOnceTheKeychainUnlocks();
        return;
      }
      const [accessToken, refreshToken] = tokens;
      await moveSessionKeychainItemsToBackgroundReadableAccessOnce().catch(() => undefined);
      set({ accessToken, refreshToken, status: accessToken ? "signedIn" : "signedOut" });
    })().finally(() => {
      restoringSavedSession = null;
    });
    return restoringSavedSession;
  },
  saveSignedInSession: async ({ accessToken, refreshToken, user, notice }) => {
    await Promise.all([
      secureStorage.set(storageKeys.accessToken, accessToken, sessionTokenAccess),
      secureStorage.set(storageKeys.refreshToken, refreshToken, sessionTokenAccess),
    ]);
    set({ accessToken, refreshToken, user, status: "signedIn" });
    if (notice) showToast(notice);
  },
  replaceSessionTokens: async ({ accessToken, refreshToken }) => {
    await Promise.all([
      secureStorage.set(storageKeys.accessToken, accessToken, sessionTokenAccess),
      secureStorage.set(storageKeys.refreshToken, refreshToken, sessionTokenAccess),
    ]);
    set({ accessToken, refreshToken });
  },
  updateSignedInUser: (user) => set({ user }),
  clearSessionAndSignOut: async () => {
    await Promise.all([...signOutHooks].map((hook) => hook().catch(() => undefined)));
    await Promise.all([secureStorage.remove(storageKeys.accessToken), secureStorage.remove(storageKeys.refreshToken)]);
    set({ accessToken: null, refreshToken: null, user: null, status: "signedOut" });
  },
}));
