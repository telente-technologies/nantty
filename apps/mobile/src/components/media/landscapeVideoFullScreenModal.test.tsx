import { fireEvent, render } from "@testing-library/react-native";
import type React from "react";

import type { Post } from "@/types";

const mockToggleSaved = jest.fn();

jest.mock("expo-screen-orientation", () => ({
  OrientationLock: { LANDSCAPE: "landscape", PORTRAIT_UP: "portrait-up" },
  lockAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 34, left: 0 }) }));
jest.mock("@/components/ui/frameAwareModal", () => ({
  FrameAwareModal: ({ children, visible }: { children: React.ReactNode; visible: boolean }) => {
    const { View } = jest.requireActual<typeof import("react-native")>("react-native");
    return visible ? <View>{children}</View> : null;
  },
}));
jest.mock("@/components/media/clipVideoPlayer", () => ({
  ClipVideoPlayer: () => {
    const { View } = jest.requireActual<typeof import("react-native")>("react-native");
    return <View testID="fullscreen-video-player" />;
  },
}));
jest.mock("@/components/media/fullScreenVideoControls", () => ({
  FullScreenVideoControls: () => {
    const { View } = jest.requireActual<typeof import("react-native")>("react-native");
    return <View testID="fullscreen-video-controls" />;
  },
}));
jest.mock("@/components/create/clip/clipLook.constant", () => ({ ClipLookOverlay: () => null, isClipLookId: () => false }));
jest.mock("@/components/saves/saveToggleButton", () => ({ SaveToggleButton: () => null }));
jest.mock("@/components/icons", () => ({
  ArrowsOutSimple24Icon: () => null,
  BookmarkActionIcon: () => null,
  LikeActionIcon: () => null,
  ReplyActionIcon: () => null,
  RepostActionIcon: () => null,
  ShareActionIcon: () => null,
}));
jest.mock("@/hooks/useSaveToggle.hook", () => ({
  useSaveToggle: () => ({ isSaved: false, toggleSaved: mockToggleSaved }),
}));
jest.mock("@/theme", () => ({
  useTheme: () => ({ colors: { black: "#000000", white: "#ffffff" }, isDark: true }),
  makeThemedStyles: (createStyles: (colors: { black: string; white: string }) => unknown) => () => createStyles({ black: "#000000", white: "#ffffff" }),
}));
jest.mock("@/hooks/useReducedMotionPreference.hook", () => ({ useReducedMotionPreference: () => true }));
jest.mock("@/components/ui/text", () => ({
  Text: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    const { Text: NativeText } = jest.requireActual<typeof import("react-native")>("react-native");
    return <NativeText {...props}>{children}</NativeText>;
  },
}));

import { LandscapeVideoFullScreenModal } from "./landscapeVideoFullScreenModal";

describe("LandscapeVideoFullScreenModal post actions", () => {
  beforeEach(() => mockToggleSaved.mockClear());

  it("keeps post actions usable when playback controls are hidden", async () => {
    const onToggleLike = jest.fn();
    const onPressComments = jest.fn();
    const onRepost = jest.fn();
    const onShare = jest.fn();

    const view = await render(
      <LandscapeVideoFullScreenModal
        media={{ type: "video", id: "video-1", url: "https://example.test/video.mp4", width: 1080, height: 1920 }}
        isMuted
        onClose={jest.fn()}
        postActions={{ post: postFixture, onToggleLike, onPressComments, onRepost, onShare }}
      />,
    );

    expect(view.getByTestId("fullscreen-video-post-actions")).toBeTruthy();
    await fireEvent.press(view.getByRole("button", { name: "Hide video controls" }));
    expect(view.queryByTestId("fullscreen-video-controls")).toBeNull();
    expect(view.getByTestId("fullscreen-video-post-actions")).toBeTruthy();

    await fireEvent.press(view.getByRole("button", { name: "Like, 4" }));
    await fireEvent.press(view.getByRole("button", { name: "Reply, 5" }));
    await fireEvent.press(view.getByRole("button", { name: "Repost, 2" }));
    await fireEvent.press(view.getByRole("button", { name: "Save post" }));
    await fireEvent.press(view.getByRole("button", { name: "Share" }));

    expect(onToggleLike).toHaveBeenCalledTimes(1);
    expect(onPressComments).toHaveBeenCalledTimes(1);
    expect(onRepost).toHaveBeenCalledTimes(1);
    expect(mockToggleSaved).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
  });
});

const postFixture = {
  id: "post-1",
  kind: "post",
  author: { id: "author-1", name: "Author", username: "author", avatarUrl: null, verified: false },
  createdAt: "2026-01-01T00:00:00.000Z",
  text: "Video post",
  media: [],
  likes: 4,
  comments: 5,
  reposts: 2,
  views: 10,
  liked: false,
  bookmarked: false,
  isFollowingAuthor: false,
  friendsLiked: null,
  products: [],
} satisfies Post;
