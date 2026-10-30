import { hasSubscriberOnlyPosts, subscriberPostsRequireAccessGate } from "@/components/profile/subscriberPosts.util";

describe("hasSubscriberOnlyPosts", () => {
  it("only enables the profile tab when subscriber-only content exists", () => {
    expect(hasSubscriberOnlyPosts(undefined)).toBe(false);
    expect(hasSubscriberOnlyPosts([])).toBe(false);
    expect(hasSubscriberOnlyPosts([{ subscriberOnly: false }])).toBe(false);
    expect(hasSubscriberOnlyPosts([{ subscriberOnly: true }])).toBe(true);
  });
});

describe("subscriberPostsRequireAccessGate", () => {
  it("fails closed for non-subscribers or missing access metadata", () => {
    expect(subscriberPostsRequireAccessGate([])).toBe(false);
    expect(subscriberPostsRequireAccessGate([{ subscriberOnly: true, viewerHasAccess: false }])).toBe(true);
    expect(subscriberPostsRequireAccessGate([{ subscriberOnly: true }])).toBe(true);
    expect(subscriberPostsRequireAccessGate([{ subscriberOnly: true, viewerHasAccess: true }])).toBe(false);
  });
});
