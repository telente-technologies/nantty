import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock";
import NetInfo from "@react-native-community/netinfo";

import { ApiError } from "@/errors/api.error";
import { useActingProfileStore } from "@/store/actingProfile.store";
import { useAuthStore } from "@/store/auth.store";

import { api } from "../core/apiClient.service";
import { feedInteractionsService, FEED_INTERACTIONS_BATCH_PATH, isPermanentlyRejected, retryDelayAfterFailures, sanitizeFeedInteraction } from "../feed/feedInteractions.service";

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);
jest.mock("@react-native-community/netinfo", () => ({ addEventListener: jest.fn(), fetch: jest.fn(async () => ({ isConnected: true })) }));
jest.mock("../core/apiClient.service", () => ({ api: { post: jest.fn() } }));

const post = api.post as jest.Mock;
const viewer = { id: "viewer-1" };
const otherPost = { postId: "post-1", authorId: "author-1" };

function signIn() {
  useAuthStore.setState({ status: "signedIn", user: viewer as never, accessToken: "token" });
}

describe("feed interactions service", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    post.mockReset();
    post.mockResolvedValue({ accepted: 1, skipped: 0 });
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
    await feedInteractionsService.resetForTesting();
    useActingProfileStore.setState({ actingProfile: null });
    signIn();
  });

  afterEach(() => jest.useRealTimers());

  it("records a view once per session per surface", () => {
    expect(feedInteractionsService.recordViewOncePerSession(otherPost, "feed")).toBe(true);
    expect(feedInteractionsService.recordViewOncePerSession(otherPost, "feed")).toBe(false);
    expect(feedInteractionsService.recordViewOncePerSession(otherPost, "clips")).toBe(true);
    expect(feedInteractionsService.pendingInteractionCountForTesting()).toBe(2);
  });

  it("never records the viewer's own posts, including posts made as their acting brand", () => {
    feedInteractionsService.recordViewOncePerSession({ postId: "own", authorId: viewer.id }, "feed");
    useActingProfileStore.setState({ actingProfile: { id: "brand-1" } as never });
    feedInteractionsService.recordLinkClick({ postId: "brand-post", authorId: "teammate", postedAsId: "brand-1" }, "profile");
    expect(feedInteractionsService.pendingInteractionCountForTesting()).toBe(0);
  });

  it("does not record anything for guests", () => {
    useAuthStore.setState({ status: "signedOut", user: null, accessToken: null });
    expect(feedInteractionsService.recordViewOncePerSession(otherPost, "feed")).toBe(false);
    feedInteractionsService.recordFollow(otherPost, "clips");
    expect(feedInteractionsService.pendingInteractionCountForTesting()).toBe(0);
  });

  it("clamps absurd values so one bad event cannot get the whole batch rejected", () => {
    expect(sanitizeFeedInteraction({ postId: "p", kind: "watch", surface: "clips", watchMs: 9e12, durationMs: -5, loopCount: 4000, watchFraction: 7 })).toEqual({
      postId: "p", kind: "watch", surface: "clips", watchMs: 3_600_000, durationMs: 0, loopCount: 100, watchFraction: 1,
    });
    expect(sanitizeFeedInteraction({ postId: "p", kind: "dwell", surface: "feed", dwellMs: Number.NaN })).toEqual({ postId: "p", kind: "dwell", surface: "feed", dwellMs: 0 });
  });

  it("sends queued events in one batch without the account id", async () => {
    feedInteractionsService.recordViewOncePerSession(otherPost, "feed", 3);
    feedInteractionsService.recordClipWatch(otherPost, "clips", { watchMs: 9000, durationMs: 15000, watchFraction: 0.6, loopCount: 0 });
    await feedInteractionsService.flushPendingInteractionsNow();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(FEED_INTERACTIONS_BATCH_PATH, {
      events: [
        { postId: "post-1", kind: "view", surface: "feed", position: 3 },
        { postId: "post-1", kind: "watch", surface: "clips", watchMs: 9000, durationMs: 15000, loopCount: 0, watchFraction: 0.6 },
      ],
    });
    expect(feedInteractionsService.pendingInteractionCountForTesting()).toBe(0);
  });

  it("drops a batch the server rejects with a 4xx but keeps it for a 429 or network failure", async () => {
    feedInteractionsService.recordFollow(otherPost, "feed");
    post.mockRejectedValueOnce(new ApiError(429, "Slow down"));
    await feedInteractionsService.flushPendingInteractionsNow();
    expect(feedInteractionsService.pendingInteractionCountForTesting()).toBe(1);
    post.mockRejectedValueOnce(new TypeError("Network request failed"));
    await feedInteractionsService.flushPendingInteractionsNow();
    expect(feedInteractionsService.pendingInteractionCountForTesting()).toBe(1);
    post.mockRejectedValueOnce(new ApiError(400, "Invalid"));
    await feedInteractionsService.flushPendingInteractionsNow();
    expect(feedInteractionsService.pendingInteractionCountForTesting()).toBe(0);
  });

  it("waits while offline and keeps the queue", async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
    feedInteractionsService.recordProfileClick(otherPost, "search");
    await feedInteractionsService.flushPendingInteractionsNow();
    expect(post).not.toHaveBeenCalled();
    expect(feedInteractionsService.pendingInteractionCountForTesting()).toBe(1);
  });

  it("resends a batch that was in flight when the app was killed", async () => {
    feedInteractionsService.recordViewOncePerSession(otherPost, "profile");
    post.mockImplementationOnce(() => new Promise(() => undefined));
    void feedInteractionsService.flushPendingInteractionsNow();
    for (let tick = 0; tick < 20; tick += 1) await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(1);
    feedInteractionsService.simulateAppRestartForTesting();
    post.mockResolvedValue({ accepted: 1, skipped: 0 });
    await feedInteractionsService.flushPendingInteractionsNow();
    expect(post).toHaveBeenLastCalledWith(FEED_INTERACTIONS_BATCH_PATH, { events: [{ postId: "post-1", kind: "view", surface: "profile" }] });
  });

  it("clears the queue when the viewer signs out", () => {
    feedInteractionsService.recordFollow(otherPost, "feed");
    useAuthStore.setState({ status: "signedOut", user: null, accessToken: null });
    expect(feedInteractionsService.pendingInteractionCountForTesting()).toBe(0);
  });

  it("classifies failures and backs off exponentially up to five minutes", () => {
    expect(isPermanentlyRejected(new ApiError(404, "Gone"))).toBe(true);
    expect(isPermanentlyRejected(new ApiError(429, "Slow"))).toBe(false);
    expect(isPermanentlyRejected(new ApiError(503, "Down"))).toBe(false);
    expect(isPermanentlyRejected(new TypeError("offline"))).toBe(false);
    expect([1, 2, 3].map(retryDelayAfterFailures)).toEqual([4000, 8000, 16000]);
    expect(retryDelayAfterFailures(20)).toBe(300_000);
  });
});
