import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { render, renderHook, screen, waitFor } from "@testing-library/react-native";

import { ThreadComposer } from "@/components/feed/thread/threadComposer";
import { useHydrateSignedInUser } from "@/components/profile/profileQueries.hook";
import { useAuthStore } from "@/store/auth.store";
import type { User } from "@/types";

jest.mock("@/utils/secureStorage.util", () => {
  class SecureStorageUnavailableError extends Error {}
  return {
    SecureStorageUnavailableError,
    readSecureItemSynchronously: jest.fn(() => ({ available: true, value: null })),
    writeSecureItemSynchronously: jest.fn(() => true),
    retryWhenAppComesToForeground: jest.fn(),
    moveSecureItemToAccess: jest.fn(async () => undefined),
    secureStoreOptionsFor: jest.fn(() => ({})),
    isKeychainLockedError: jest.fn(() => false),
    secureStorage: { get: jest.fn(async () => null), set: jest.fn(async () => undefined), remove: jest.fn(async () => undefined) },
  };
});
jest.mock("@/services/account/users.service", () => ({ usersService: { fetchMyProfile: jest.fn() } }));
jest.mock("@/components/mentions/mentionComposer.hook", () => ({
  useMentionComposer: () => ({ inputProps: { onFocus: () => undefined }, suggestions: null, mentionCount: 0 }),
}));
jest.mock("@/components/mentions/mentionSuggestionList", () => ({ MentionCountLabel: () => null, MentionSuggestionList: () => null }));
jest.mock("@/components/feed/quotedPostPreview.hook", () => ({
  useQuotedPostPreview: () => ({ preview: null, quotedPostId: undefined, reset: () => undefined, remove: () => undefined }),
}));
jest.mock("@/components/feed/quotedPostCard", () => ({ QuotedPostCard: () => null }));
jest.mock("@/components/ui/keyboardSpacer", () => ({ KeyboardSpacer: () => null }));
jest.mock("@/components/ui/composerSlot", () => ({ ComposerSlot: ({ children }: { children: ReactNode }) => children }));
jest.mock("@/components/ui/avatar", () => ({ Avatar: () => null }));
jest.mock("@/components/icons", () => ({ Cancel20Icon: () => null, LockSimple24Icon: () => null }));

const { usersService } = jest.requireMock("@/services/account/users.service") as { usersService: { fetchMyProfile: jest.Mock } };
const signedInUser = { id: "u_me", name: "Ada", username: "ada", avatarUrl: "https://cdn.example/ada.jpg" } as unknown as User;

const renderComposer = () =>
  render(createElement(ThreadComposer, { postAuthorUsername: "bola", replyTarget: null, onCancelReply: () => undefined, onSubmit: () => undefined }));

const withQueryClient = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function QueryClientWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
};

beforeEach(() => {
  usersService.fetchMyProfile.mockReset();
  useAuthStore.setState({ status: "signedOut", user: null, accessToken: null, refreshToken: null });
});

describe("thread composer auth gate", () => {
  test("a guest sees the sign-in prompt", async () => {
    await renderComposer();
    expect(screen.getByText("Sign in to reply")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Post your reply")).toBeNull();
  });

  test("a restored session whose profile has not loaded yet still gets the reply box, not the sign-in prompt", async () => {
    useAuthStore.setState({ status: "signedIn", user: null, accessToken: "at", refreshToken: "rt" });
    await renderComposer();
    expect(screen.queryByText("Sign in to reply")).toBeNull();
    expect(screen.getByPlaceholderText("Post your reply")).toBeTruthy();
  });

  test("a fully signed-in viewer gets the reply box", async () => {
    useAuthStore.setState({ status: "signedIn", user: signedInUser, accessToken: "at", refreshToken: "rt" });
    await renderComposer();
    expect(screen.queryByText("Sign in to reply")).toBeNull();
    expect(screen.getByPlaceholderText("Post your reply")).toBeTruthy();
  });

  test("a token refresh keeps the reply box", async () => {
    useAuthStore.setState({ status: "signedIn", user: signedInUser, accessToken: "at", refreshToken: "rt" });
    await renderComposer();
    await useAuthStore.getState().replaceSessionTokens({ accessToken: "at2", refreshToken: "rt2" });
    expect(screen.queryByText("Sign in to reply")).toBeNull();
  });
});

describe("signed-in user hydration", () => {
  test("loads the profile for a restored session that has tokens but no user", async () => {
    usersService.fetchMyProfile.mockResolvedValue(signedInUser);
    useAuthStore.setState({ status: "signedIn", user: null, accessToken: "at", refreshToken: "rt" });
    await renderHook(() => useHydrateSignedInUser(), { wrapper: withQueryClient() });
    await waitFor(() => expect(useAuthStore.getState().user?.id).toBe("u_me"));
  });

  test("never fetches a profile for a guest", async () => {
    await renderHook(() => useHydrateSignedInUser(), { wrapper: withQueryClient() });
    expect(usersService.fetchMyProfile).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
