import { findFirstSafeExternalFeedUrl, isSafeFeedPreviewUrl } from "./feedLinkPreviewSafety.util";

describe("feed link preview URL safety", () => {
  it("allows only bounded HTTPS URLs without embedded credentials", () => {
    expect(isSafeFeedPreviewUrl("https://example.com/story")).toBe(true);
    expect(isSafeFeedPreviewUrl("http://example.com/story")).toBe(false);
    expect(isSafeFeedPreviewUrl("https://user:pass@example.com/story")).toBe(false);
    expect(isSafeFeedPreviewUrl(`https://example.com/${"a".repeat(2_050)}`)).toBe(false);
  });

  it("skips unsafe and internal Nantty links while selecting the first safe external link", () => {
    expect(findFirstSafeExternalFeedUrl("http://example.com/no https://nantty.com/post/123 https://example.com/story")).toBe("https://example.com/story");
    expect(findFirstSafeExternalFeedUrl("https://user:pass@example.com/secret")).toBeNull();
    expect(findFirstSafeExternalFeedUrl("https://nantty.com/post/123")).toBeNull();
  });
});
