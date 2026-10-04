import type { AdAppInstall, SponsoredPlacement } from "@/types";

import { resolveAdTapAction, selectAppDeepLink, selectAppStoreLink } from "../adDestination.util";

const app: AdAppInstall = {
  appName: "Zudo",
  iosStoreUrl: "https://apps.apple.com/ng/app/zudo/id1",
  androidStoreUrl: "https://play.google.com/store/apps/details?id=com.zudo",
  webFallbackUrl: "https://zudo.example/get",
  iosDeepLink: "zudoapp://promo",
  androidDeepLink: "",
};
const base: SponsoredPlacement = { campaignId: "ad1", label: "Promoted", advertiserName: "Zudo" };

describe("platform link selection", () => {
  it("shows the iOS link to iOS, Android to Android, the web fallback elsewhere", () => {
    expect(selectAppStoreLink(app, "ios")).toBe(app.iosStoreUrl);
    expect(selectAppStoreLink(app, "android")).toBe(app.androidStoreUrl);
    expect(selectAppStoreLink(app, "web")).toBe(app.webFallbackUrl);
    expect(selectAppStoreLink({ ...app, iosStoreUrl: "" }, "ios")).toBe(app.webFallbackUrl);
    expect(selectAppStoreLink({ ...app, androidStoreUrl: "", webFallbackUrl: "" }, "android")).toBeNull();
  });
  it("only offers a deep link for the matching platform and never a web or script scheme", () => {
    expect(selectAppDeepLink(app, "ios")).toBe("zudoapp://promo");
    expect(selectAppDeepLink(app, "android")).toBeNull();
    expect(selectAppDeepLink({ ...app, iosDeepLink: "javascript://x" }, "ios")).toBeNull();
    expect(selectAppDeepLink({ ...app, iosDeepLink: "https://evil.example" }, "ios")).toBeNull();
  });
});

describe("tap resolution", () => {
  it("installs go to the store for the platform with the deep link attached", () => {
    const sponsored = { ...base, adType: "app_install" as const, app, destination: { type: "app_store" as const } };
    expect(resolveAdTapAction(sponsored, { kind: "cta" }, "ios")).toEqual({ kind: "install", url: app.iosStoreUrl, deepLink: "zudoapp://promo" });
    expect(resolveAdTapAction(sponsored, { kind: "cta" }, "android")).toEqual({ kind: "install", url: app.androidStoreUrl, deepLink: null });
  });
  it("promoted posts and internal destinations navigate in app", () => {
    expect(resolveAdTapAction({ ...base, adType: "promoted_post", destination: { type: "post", targetId: "p1" } }, { kind: "media" }, "ios")).toEqual({ kind: "internal", route: "PostDetail", params: { postId: "p1" } });
    expect(resolveAdTapAction({ ...base, destination: { type: "product", targetId: "prod" } }, { kind: "cta" }, "ios")).toEqual({ kind: "internal", route: "ProductDetail", params: { productId: "prod" } });
  });
  it("external links use the signed redirect and never a non-https target", () => {
    const redirect = "https://api.zudomart.com/api/v1/ads/r/abc";
    expect(resolveAdTapAction({ ...base, destination: { type: "url", url: "https://shop.example" }, clickLinks: { cta: redirect } }, { kind: "cta" }, "ios")).toEqual({ kind: "external", url: redirect });
    expect(resolveAdTapAction({ ...base, destination: { type: "url", url: "javascript:alert(1)" } }, { kind: "cta" }, "ios")).toEqual({ kind: "none" });
    expect(resolveAdTapAction({ ...base, destination: { type: "url", url: "http://insecure.example" } }, { kind: "cta" }, "ios")).toEqual({ kind: "none" });
  });
  it("carousel cards resolve their own destination and signed link, and out-of-range cards do nothing", () => {
    const sponsored: SponsoredPlacement = {
      ...base,
      adType: "carousel",
      clickLinks: { cards: ["https://api.zudomart.com/api/v1/ads/r/c0", "https://api.zudomart.com/api/v1/ads/r/c1"] },
      cards: [
        { media: { kind: "image", url: "https://cdn.example/a.jpg" }, headline: "A", destination: { type: "url", url: "https://a.example" } },
        { media: { kind: "image", url: "https://cdn.example/b.jpg" }, headline: "B", destination: { type: "store", targetId: "s1" } },
      ],
    };
    expect(resolveAdTapAction(sponsored, { kind: "card", index: 0 }, "ios")).toEqual({ kind: "external", url: "https://api.zudomart.com/api/v1/ads/r/c0" });
    expect(resolveAdTapAction(sponsored, { kind: "card", index: 1 }, "ios")).toEqual({ kind: "internal", route: "Store", params: { storeId: "s1" } });
    expect(resolveAdTapAction(sponsored, { kind: "card", index: 5 }, "ios")).toEqual({ kind: "none" });
  });
  it("legacy campaign links still resolve", () => {
    expect(resolveAdTapAction({ ...base, ctaUrl: "https://zudomart.com/products/abc" }, { kind: "cta" }, "ios")).toEqual({ kind: "internal", route: "ProductDetail", params: { productId: "abc" } });
  });
});
