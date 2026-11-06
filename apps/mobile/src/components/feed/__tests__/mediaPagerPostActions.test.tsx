import { fireEvent, render, screen } from "@testing-library/react-native";
import type React from "react";

import type { Post } from "@/types";

import { MediaPager } from "../mediaPager";

const mockToggleMute = jest.fn();
const mockToggleSaved = jest.fn();

beforeEach(() => {
  mockToggleSaved.mockClear();
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
  const { MediaLightboxPostActions } = jest.requireActual<typeof import("../mediaLightboxPostActions")>("../mediaLightboxPostActions");
  return {
    MediaLightbox: ({ images, postActions }: { images: readonly unknown[]; postActions?: React.ComponentProps<typeof MediaLightboxPostActions> }) => (
      <View testID={`image-lightbox-${images.length}`}>
        {postActions ? <MediaLightboxPostActions {...postActions} /> : null}
      </View>
    ),
  };
});
jest.mock("@/components/media/landscapeVideoFullScreenModal", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const { MediaLightboxPostActions } = jest.requireActual<typeof import("../mediaLightboxPostActions")>("../mediaLightboxPostActions");
  return {
    LandscapeVideoFullScreenModal: ({ media, postActions }: { media: unknown; postActions?: React.ComponentProps<typeof MediaLightboxPostActions> }) =>
      media && postActions ? <View testID="fullscreen-video-modal"><MediaLightboxPostActions {...postActions} /></View> : null,
  };
});
jest.mock("@/components/media/videoOrientation.util", () => ({ calculateFeedVideoAspectRatio: () => 0.5625 }));
jest.mock("@/components/media/videoWatermark", () => ({ VideoWatermark: () => null }));
jest.mock("@/components/icons", () => ({
  BookmarkActionIcon: () => null,
  LikeActionIcon: () => null,
  ReplyActionIcon: () => null,
  RepostActionIcon: () => null,
  ShareActionIcon: () => null,
  SpeakerHigh24Icon: () => null,
  ViewProducts24Icon: () => null,
}));
jest.mock("@/hooks/useReducedMotionPreference.hook", () => ({ useReducedMotionPreference: () => true }));
jest.mock("@/hooks/useSaveToggle.hook", () => ({
  useSaveToggle: () => ({ isSaved: false, toggleSaved: mockToggleSaved }),
}));

describe("MediaPager fullscreen video actions", () => {
  it("forwards the post's existing like, reply, repost, and share actions to fullscreen video", async () => {
    const onToggleLike = jest.fn();
    const onPressComments = jest.fn();
    const onRepost = jest.fn();
    const onShare = jest.fn();

    await render(
      <MediaPager
        media={[{ id: "video-1", type: "video", url: "https://example.test/video.mp4", width: 1080, height: 1920, status: "ready" }]}
        postActions={{ post: postFixture, onToggleLike, onPressComments, onRepost, onShare }}
      />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Play video full screen" }));

    expect(screen.getByTestId("fullscreen-video-modal")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Like, 4" }));
    await fireEvent.press(screen.getByRole("button", { name: "Reply, 5" }));
    await fireEvent.press(screen.getByRole("button", { name: "Repost, 2" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save post" }));
    await fireEvent.press(screen.getByRole("button", { name: "Share" }));

    expect(onToggleLike).toHaveBeenCalledTimes(1);
    expect(onPressComments).toHaveBeenCalledTimes(1);
    expect(onRepost).toHaveBeenCalledTimes(1);
    expect(mockToggleSaved).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("keeps image and video preview taps from also triggering the parent post tap", async () => {
    const stopImagePropagation = jest.fn();
    const stopVideoPropagation = jest.fn();
    const onToggleLike = jest.fn();
    const onPressComments = jest.fn();
    const onRepost = jest.fn();
    const onShare = jest.fn();

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
    await fireEvent.press(screen.getByRole("button", { name: "Like, 4" }));
    await fireEvent.press(screen.getByRole("button", { name: "Reply, 5" }));
    await fireEvent.press(screen.getByRole("button", { name: "Repost, 2" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save post" }));
    await fireEvent.press(screen.getByRole("button", { name: "Share" }));
    expect(onToggleLike).toHaveBeenCalledTimes(1);
    expect(onPressComments).toHaveBeenCalledTimes(1);
    expect(onRepost).toHaveBeenCalledTimes(1);
    expect(mockToggleSaved).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole("button", { name: "Play video full screen" }), { stopPropagation: stopVideoPropagation });
    expect(stopVideoPropagation).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("fullscreen-video-modal")).toBeTruthy();
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
