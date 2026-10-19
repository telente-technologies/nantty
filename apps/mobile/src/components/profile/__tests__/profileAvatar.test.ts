import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { ProfileAvatar } from "@/components/profile/profileAvatar";
import type { User } from "@/types";

jest.setTimeout(30_000);

jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  const chain: Record<string, unknown> = {};
  chain.duration = () => chain;
  chain.easing = () => chain;
  return {
    __esModule: true,
    default: { View },
    Easing: { out: () => undefined, cubic: undefined },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: (value: number) => value,
    withSpring: (value: number) => value,
    SlideInDown: chain,
    FadeInDown: chain,
    FadeOut: chain,
    useReducedMotion: () => true,
  };
});
jest.mock("react-native-worklets", () => ({ scheduleOnRN: (callback: () => void) => callback() }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@/components/ui/frameAwareModal", () => ({
  FrameAwareModal: ({ visible, children }: { visible: boolean; children: unknown }) => (visible ? children : null),
}));
jest.mock("@/components/ui/accessibilityFocus.hook", () => ({ useAccessibilityFocusOnOpen: () => ({ current: null }) }));
jest.mock("@/components/feed/mediaLightbox", () => ({ MediaLightbox: () => null }));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));

const mockFetchStoryRingStatus = jest.fn();
const mockFetchHostLiveStatus = jest.fn();
jest.mock("@/services/social/profileAvatarPresence.service", () => ({
  profileAvatarPresenceService: {
    fetchStoryRingStatus: (userId: string) => mockFetchStoryRingStatus(userId),
    fetchHostLiveStatus: (userId: string) => mockFetchHostLiveStatus(userId),
  },
}));
const mockFetchStoriesForUser = jest.fn();
jest.mock("@/services/clips/stories.service", () => ({ storiesService: { fetchStoriesForUser: (userId: string) => mockFetchStoriesForUser(userId) } }));
const mockShowToast = jest.fn();
jest.mock("@/store/toast.store", () => ({ showToast: (message: string) => mockShowToast(message) }));

const profile = { id: "u_7", name: "Ada Obi", username: "ada", avatarUrl: "https://cdn.test/ada.jpg", verified: false, bio: "", bannerUrl: null, followers: 0, following: 0, posts: 0, joinedAt: "2024-01-01T00:00:00Z" } as User;

async function renderAvatar(options: { story?: object; live?: object; hidden?: boolean } = {}) {
  mockFetchStoryRingStatus.mockResolvedValue(options.story ?? { hasActiveStory: false, hasUnseenStory: false });
  mockFetchHostLiveStatus.mockResolvedValue(options.live ?? { liveStreamId: null, startedAt: null });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await render(createElement(QueryClientProvider, { client: queryClient }, createElement(ProfileAvatar, { profile, borderRadius: 8, isProfileHiddenFromViewer: options.hidden ?? false })));
}

beforeEach(() => jest.clearAllMocks());

test("an unseen story draws the brand ring and the sheet opens that user's stories", async () => {
  mockFetchStoriesForUser.mockResolvedValue([{ id: "st_u_7_0" }]);
  await renderAvatar({ story: { hasActiveStory: true, hasUnseenStory: true } });
  expect(await screen.findByTestId("profileAvatarRing-storyUnseen")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Ada Obi, View story or profile picture"));
  expect(screen.queryByText("Watch live")).toBeNull();
  expect(screen.getByText("View profile picture")).toBeTruthy();
  await fireEvent.press(screen.getByText("View story"));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("Story", { userId: "u_7" }));
  expect(mockFetchStoriesForUser).toHaveBeenCalledWith("u_7");
});

test("a fully seen story draws the neutral ring", async () => {
  await renderAvatar({ story: { hasActiveStory: true, hasUnseenStory: false } });
  expect(await screen.findByTestId("profileAvatarRing-storySeen")).toBeTruthy();
});

test("a story that expired after render shows a message instead of an empty viewer", async () => {
  mockFetchStoriesForUser.mockResolvedValue([]);
  await renderAvatar({ story: { hasActiveStory: true, hasUnseenStory: true } });
  await fireEvent.press(await screen.findByLabelText("Ada Obi, View story or profile picture"));
  await fireEvent.press(screen.getByText("View story"));
  await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith("This story is no longer available."));
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("live wins over the story ring and Watch live opens the right stream", async () => {
  mockFetchHostLiveStatus.mockResolvedValue({ liveStreamId: "live_77", startedAt: null });
  await renderAvatar({ story: { hasActiveStory: true, hasUnseenStory: true }, live: { liveStreamId: "live_77", startedAt: null } });
  expect(await screen.findByText("LIVE")).toBeTruthy();
  expect(screen.queryByTestId("profileAvatarRing-storyUnseen")).toBeNull();
  await fireEvent.press(screen.getByLabelText(/Live now/));
  expect(screen.getByText("View story")).toBeTruthy();
  await fireEvent.press(screen.getByText("Watch live"));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("Live", { liveId: "live_77" }));
});

test("a live that ended after render shows a message", async () => {
  await renderAvatar({ live: { liveStreamId: "live_77", startedAt: null } });
  await fireEvent.press(await screen.findByLabelText(/Live now/));
  mockFetchHostLiveStatus.mockResolvedValue({ liveStreamId: null, startedAt: null });
  await fireEvent.press(screen.getByText("Watch live"));
  await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith("This live has ended."));
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("a private profile the viewer doesn't follow shows no ring and never asks the server", async () => {
  await renderAvatar({ story: { hasActiveStory: true, hasUnseenStory: true }, live: { liveStreamId: "live_77", startedAt: null }, hidden: true });
  await act(async () => undefined);
  expect(screen.queryByTestId("profileAvatarRing-storyUnseen")).toBeNull();
  expect(screen.queryByText("LIVE")).toBeNull();
  expect(mockFetchStoryRingStatus).not.toHaveBeenCalled();
  expect(mockFetchHostLiveStatus).not.toHaveBeenCalled();
  expect(screen.getByLabelText("View Ada Obi's profile picture")).toBeTruthy();
});

test("with no story or live the avatar keeps opening the picture directly", async () => {
  await renderAvatar();
  await act(async () => undefined);
  await fireEvent.press(screen.getByLabelText("View Ada Obi's profile picture"));
  expect(screen.queryByText("View story")).toBeNull();
  expect(screen.queryByText("View profile picture")).toBeNull();
});
