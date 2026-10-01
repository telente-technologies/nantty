import { create } from "zustand";

import type { User } from "@/types";

interface AuthState {
  readonly status: "loading" | "signedOut" | "signedIn";
  readonly user: User | null;
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
  readonly saveSignedInSession: (session: { accessToken: string; refreshToken: string; user: User }) => void;
  readonly replaceSessionTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  readonly updateSignedInUser: (user: User) => void;
  readonly setViewerFromSession: (viewer: User | null) => void;
  readonly clearSessionAndSignOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "signedOut",
  user: null,
  accessToken: null,
  refreshToken: null,
  saveSignedInSession: ({ accessToken, refreshToken, user }) => set({ accessToken, refreshToken, user, status: "signedIn" }),
  replaceSessionTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
  updateSignedInUser: (user) => set({ user }),
  setViewerFromSession: (viewer) => set(viewer ? { user: viewer, status: "signedIn" } : { user: null, status: "signedOut", accessToken: null, refreshToken: null }),
  clearSessionAndSignOut: () => set({ accessToken: null, refreshToken: null, user: null, status: "signedOut" }),
}));
