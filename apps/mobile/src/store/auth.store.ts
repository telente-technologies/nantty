import { create } from "zustand";

import { storageKeys } from "@/constants/storageKeys.constant";
import type { User } from "@/types";
import { showToast } from "@/store/toast.store";
import { secureStorage } from "@/utils/secureStorage.util";

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

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  user: null,
  accessToken: null,
  refreshToken: null,
  restoreSavedSession: async () => {
    const [accessToken, refreshToken] = await Promise.all([
      secureStorage.get(storageKeys.accessToken),
      secureStorage.get(storageKeys.refreshToken),
    ]);
    set({ accessToken, refreshToken, status: accessToken ? "signedIn" : "signedOut" });
  },
  saveSignedInSession: async ({ accessToken, refreshToken, user, notice }) => {
    await Promise.all([
      secureStorage.set(storageKeys.accessToken, accessToken),
      secureStorage.set(storageKeys.refreshToken, refreshToken),
    ]);
    set({ accessToken, refreshToken, user, status: "signedIn" });
    if (notice) showToast(notice);
  },
  replaceSessionTokens: async ({ accessToken, refreshToken }) => {
    await Promise.all([
      secureStorage.set(storageKeys.accessToken, accessToken),
      secureStorage.set(storageKeys.refreshToken, refreshToken),
    ]);
    set({ accessToken, refreshToken });
  },
  updateSignedInUser: (user) => set({ user }),
  clearSessionAndSignOut: async () => {
    await Promise.all([secureStorage.remove(storageKeys.accessToken), secureStorage.remove(storageKeys.refreshToken)]);
    set({ accessToken: null, refreshToken: null, user: null, status: "signedOut" });
  },
}));
