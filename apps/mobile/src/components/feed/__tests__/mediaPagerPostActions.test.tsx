import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Platform, StyleSheet, View } from "react-native";
import type React from "react";
import { useState } from "react";

import type { Post } from "@/types";
import { ReshareSheet } from "../reshareSheet";

import { MediaPager } from "../mediaPager";

const mockToggleMute = jest.fn();
const mockToggleSaved = jest.fn();
const mockResharePost = jest.fn(async (_post: Pick<Post, "id">) => undefined);
const mockUndoRepost = jest.fn(async (_post: Pick<Post, "id">) => undefined);
let mockSimulateNativeModalDismiss = true;

beforeEach(() => {
  mockToggleSaved.mockClear();
  mockSimulateNativeModalDismiss = true;
});

jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("@/services/clips/videoAudio.service", () => ({ claimAudioFocusForVideoPlayback: jest.fn() }));
jest.mock("@/store/videoAudio.store", () => ({
  useVideoAudioStore: (selector: (state: { isMuted: boolean; toggleMute: () => void }) => unknown) =>
    selector({ isMuted: true, toggleMute: mockToggleMute }),
}));
jest.mock("@/components/create/clip/clipLook.constant", () => ({ ClipLookOverlay: () => null, isClipLookId: () => false }));
jest.mock("@/components/media/clipVideoPlayer", () => ({ VideoPosterOnly: () => null }));
jest.mock("@/components/feed/feedVideoPage", () => ({
  FeedVideoPage: ({ children }: React.PropsWithChildren) => {
    const { View } = jest.requireActual<typeof import("react-native")>("react-native");
    return <View>{children}</View>;
  },
}));
jest.mock("@/components/feed/mediaLightbox", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const { useEffect, useRef } = jest.requireActual<typeof import("react")>("react");
  const { MediaLightboxPostActions } = jest.requireActual<typeof import("../mediaLightboxPostActions")>("../mediaLightboxPostActions");
  return {
    MediaLightbox: ({ images, postActions, onDismiss, visible }: { images: readonly unknown[]; postActions?: React.ComponentProps<typeof MediaLightboxPostActions>; onDismiss?: () => void; visible: boolean }) => {
      const wasVisible = useRef(visible);
      useEffect(() => {
        if (wasVisible.current && !visible && mockSimulateNativeModalDismiss) onDismiss?.();
        wasVisible.current = visible;
      }, [visible, onDismiss]);
      return visible ? (
        <View testID={`image-lightbox-${images.length}`}>
          {postActions ? <MediaLightboxPostActions {...postActions} /> : null}
        </View>
      ) : null;
    },
  };
});
jest.mock("@/components/media/landscapeVideoFullScreenModal", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const { useEffect, useRef } = jest.requireActual<typeof import("react")>("react");
  const { MediaLightboxPostActions } = jest.requireActual<typeof import("../mediaLightboxPostActions")>("../mediaLightboxPostActions");
  return { LandscapeVideoFullScreenModal: ({ media, postActions, onDismiss }: { media: unknown; postActions?: React.ComponentProps<typeof MediaLightboxPostActions>; onDismiss?: () => void }) => {
    const wasVisible = useRef(!!media);
    useEffect(() => {
      if (wasVisible.current && !media && mockSimulateNativeModalDismiss) onDismiss?.();
      wasVisible.current = !!media;
    }, [media, onDismiss]);
    return media && postActions ? <View testID="fullscreen-video-modal"><MediaLightboxPostActions {...postActions} /></View> : null;
  } };
});
jest.mock("@/components/media/videoOrientation.util", () => ({ calculateFeedVideoAspectRatio: () => 0.5625 }));
jest.mock("@/components/media/videoWatermark", () => ({ VideoWatermark: () => null }));
jest.mock("@/components/icons", () => ({
  BookmarkActionIcon: () => null,
  LikeActionIcon: () => null,
  ReplyActionIcon: () => null,
  RepostActionIcon: () => null,
  Quotes24Icon: () => null,
  Repeat24Icon: () => null,
  ShareActionIcon: () => null,
  SpeakerHigh24Icon: () => null,
  ViewProducts24Icon: () => null,
}));
jest.mock("@/hooks/useReducedMotionPreference.hook", () => ({ useReducedMotionPreference: () => true }));
jest.mock("@/hooks/useSaveToggle.hook", () => ({
  useSaveToggle: () => ({ isSaved: false, toggleSaved: mockToggleSaved }),
}));
jest.mock("@/hooks/usePostInteractions.hook", () => ({
  usePostInteractions: () => ({ resharePost: mockResharePost, undoRepost: mockUndoRepost }),
}));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock("@/utils/requireAuth.util", () => ({ isViewerSignedIn: () => true, requireAuthThen: jest.fn() }));
jest.mock("@/components/ui/bottomSheet", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { BottomSheet: ({ visible, children }: React.PropsWithChildren<{ visible: boolean }>) => visible ? <View testID="reshare-sheet">{children}</View> : null };
});

describe("MediaPager fullscreen video actions", () => {
  it("forwards the post's existing like, reply, repost, and share actions to fullscreen video", async () => {
    const onToggleLike = jest.fn();
    const onPressComments = jest.fn();
    const onRepost = jest.fn();
    const onShare = jest.fn();
    jest.useFakeTimers();

    await render(
      <MediaPager
        media={[{ id: "video-1", type: "video", url: "https://example.test/video.mp4", width: 1080, height: 1920, status: "ready" }]}
        postActions={{ post: postFixture, onToggleLike, onPressComments, onRepost, onShare }}
      />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Play video full screen" }));

    expect(screen.getByTestId("fullscreen-video-modal")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Like, 4" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save post" }));
    await fireEvent.press(screen.getByRole("button", { name: "Share" }));
    await fireEvent.press(screen.getByRole("button", { name: "Repost, 2" }));
    await act(async () => { jest.advanceTimersByTime(500); });

    expect(onToggleLike).toHaveBeenCalledTimes(1);
    expect(onPressComments).not.toHaveBeenCalled();
    expect(onRepost).toHaveBeenCalledTimes(1);
    expect(mockToggleSaved).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("keeps image and video preview taps from also triggering the parent post tap", async () => {
    const stopImagePropagation = jest.fn();
    const stopVideoPropagation = jest.fn();
    const onToggleLike = jest.fn();
    const onPressComments = jest.fn();
    const onRepost = jest.fn();
    const onShare = jest.fn();
    jest.useFakeTimers();

    await render(
      <MediaPager
        media={[
          { id: "image-1", type: "image", url: "https://example.test/image.jpg" },
          { id: "video-1", type: "video", url: "https://example.test/video.mp4", width: 1080, height: 1920, status: "ready" },
        ]}
        postActions={{ post: postFixture, onToggleLike, onPressComments, onRepost, onShare }}
      />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Open image 1 full screen" }), { stopPropagation: stopImagePropagation });
    expect(stopImagePropagation).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("image-lightbox-1")).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByRole("button", { name: "Repost, 2" }).props.style)).toMatchObject({ flex: 1, minWidth: 0 });
    await fireEvent.press(screen.getByRole("button", { name: "Like, 4" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save post" }));
    await fireEvent.press(screen.getByRole("button", { name: "Share" }));
    await fireEvent.press(screen.getByRole("button", { name: "Repost, 2" }));
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(onToggleLike).toHaveBeenCalledTimes(1);
    expect(onPressComments).not.toHaveBeenCalled();
    expect(onRepost).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
    expect(mockToggleSaved).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole("button", { name: "Play video full screen" }), { stopPropagation: stopVideoPropagation });
    expect(stopVideoPropagation).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("fullscreen-video-modal")).toBeTruthy();
  });

  it("dismisses the image or video viewer before navigating to its comments", async () => {
    const onPressComments = jest.fn();
    await render(
      <MediaPager
        media={[
          { id: "image-1", type: "image", url: "https://example.test/image.jpg" },
          { id: "video-1", type: "video", url: "https://example.test/video.mp4", width: 1080, height: 1920, status: "ready" },
        ]}
        postActions={{ post: postFixture, onToggleLike: jest.fn(), onPressComments, onRepost: jest.fn(), onShare: jest.fn() }}
      />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Open image 1 full screen" }));
    expect(screen.getByTestId("image-lightbox-1")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Reply, 5" }));
    expect(screen.queryByTestId("image-lightbox-1")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Play video full screen" }));
    expect(screen.getByTestId("fullscreen-video-modal")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Reply, 5" }));
    expect(screen.queryByTestId("fullscreen-video-modal")).toBeNull();
    expect(onPressComments).toHaveBeenCalledTimes(2);
  });

  it("waits for the image or video viewer to dismiss before opening the reshare flow", async () => {
    const onRepost = jest.fn();
    jest.useFakeTimers();
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, "OS");
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    mockSimulateNativeModalDismiss = false;
    await render(
      <MediaPager
        media={[
          { id: "image-1", type: "image", url: "https://example.test/image.jpg" },
          { id: "video-1", type: "video", url: "https://example.test/video.mp4", width: 1080, height: 1920, status: "ready" },
        ]}
        postActions={{ post: postFixture, onToggleLike: jest.fn(), onPressComments: jest.fn(), onRepost, onShare: jest.fn() }}
      />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Open image 1 full screen" }));
    expect(screen.getByTestId("image-lightbox-1")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Repost, 2" }));
    expect(screen.queryByTestId("image-lightbox-1")).toBeNull();
    expect(onRepost).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(749); });
    expect(onRepost).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(onRepost).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole("button", { name: "Play video full screen" }));
    expect(screen.getByTestId("fullscreen-video-modal")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Repost, 2" }));
    expect(screen.queryByTestId("fullscreen-video-modal")).toBeNull();
    expect(onRepost).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(750); });
    expect(onRepost).toHaveBeenCalledTimes(2);
    if (originalPlatformDescriptor) Object.defineProperty(Platform, "OS", originalPlatformDescriptor);
    jest.useRealTimers();
  });

  it("opens the feed reshare sheet after repost is tapped in an image viewer", async () => {
    jest.useFakeTimers();
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, "OS");
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    mockSimulateNativeModalDismiss = false;

    function FeedMediaWithReshareSheet() {
      const [reshareTarget, setReshareTarget] = useState<Post | null>(null);
      return (
        <>
          <MediaPager
            media={[{ id: "image-1", type: "image", url: "https://example.test/image.jpg" }]}
            postActions={{
              post: postFixture,
              onToggleLike: jest.fn(),
              onPressComments: jest.fn(),
              onRepost: () => setReshareTarget(postFixture),
              onShare: jest.fn(),
            }}
          />
          {reshareTarget ? <View testID="feed-reshare-sheet" /> : null}
        </>
      );
    }

    await render(<FeedMediaWithReshareSheet />);
    await fireEvent.press(screen.getByRole("button", { name: "Open image 1 full screen" }));
    await fireEvent.press(screen.getByRole("button", { name: "Repost, 2" }));
    expect(screen.queryByTestId("feed-reshare-sheet")).toBeNull();

    await act(async () => { jest.advanceTimersByTime(750); });
    expect(screen.getByTestId("feed-reshare-sheet")).toBeTruthy();

    if (originalPlatformDescriptor) Object.defineProperty(Platform, "OS", originalPlatformDescriptor);
    jest.useRealTimers();
  });

  it("submits the repost from the real feed reshare sheet after closing the image viewer", async () => {
    jest.useFakeTimers();
    mockResharePost.mockClear();
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, "OS");
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    mockSimulateNativeModalDismiss = false;

    function FeedMediaWithReshareSheet() {
      const [reshareTarget, setReshareTarget] = useState<Post | null>(null);
      return (
        <>
          <MediaPager
            media={[{ id: "image-1", type: "image", url: "https://example.test/image.jpg" }]}
            postActions={{
              post: postFixture,
              onToggleLike: jest.fn(),
              onPressComments: jest.fn(),
              onRepost: () => setReshareTarget(postFixture),
              onShare: jest.fn(),
            }}
          />
          <ReshareSheet post={reshareTarget} onClose={() => setReshareTarget(null)} />
        </>
      );
    }

    try {
      await render(<FeedMediaWithReshareSheet />);
      await fireEvent.press(screen.getByRole("button", { name: "Open image 1 full screen" }));
      await fireEvent.press(screen.getByRole("button", { name: "Repost, 2" }));
      await act(async () => { jest.advanceTimersByTime(750); });
      await fireEvent.press(screen.getByRole("button", { name: "Repost" }));
      await act(async () => {});

      expect(mockResharePost).toHaveBeenCalledWith(postFixture);
    } finally {
      if (originalPlatformDescriptor) Object.defineProperty(Platform, "OS", originalPlatformDescriptor);
      jest.useRealTimers();
    }
  });

  it("still hands off image repost on iOS if the native modal omits its dismiss callback", async () => {
    jest.useFakeTimers();
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, "OS");
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
    mockSimulateNativeModalDismiss = false;

    function FeedMediaWithReshareSheet() {
      const [reshareTarget, setReshareTarget] = useState<Post | null>(null);
      return (
        <>
          <MediaPager
            media={[{ id: "image-1", type: "image", url: "https://example.test/image.jpg" }]}
            postActions={{
              post: postFixture,
              onToggleLike: jest.fn(),
              onPressComments: jest.fn(),
              onRepost: () => setReshareTarget(postFixture),
              onShare: jest.fn(),
            }}
          />
          {reshareTarget ? <View testID="feed-reshare-sheet" /> : null}
        </>
      );
    }

    try {
      await render(<FeedMediaWithReshareSheet />);
      await fireEvent.press(screen.getByRole("button", { name: "Open image 1 full screen" }));
      await fireEvent.press(screen.getByRole("button", { name: "Repost, 2" }));
      expect(screen.queryByTestId("feed-reshare-sheet")).toBeNull();

      await act(async () => { jest.advanceTimersByTime(750); });
      expect(screen.getByTestId("feed-reshare-sheet")).toBeTruthy();
    } finally {
      if (originalPlatformDescriptor) Object.defineProperty(Platform, "OS", originalPlatformDescriptor);
      jest.useRealTimers();
      mockSimulateNativeModalDismiss = true;
    }
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
