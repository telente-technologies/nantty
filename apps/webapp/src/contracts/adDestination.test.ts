import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AdAppInstall, SponsoredPlacement } from "@/types";
import { detectAdPlatform, resolveAdTapAction, selectAppDeepLink, selectAppStoreLink } from "@/utils/adDestination.util";

const app: AdAppInstall = {
  appName: "Zudo",
  iosStoreUrl: "https://apps.apple.com/ng/app/zudo/id1",
  androidStoreUrl: "https://play.google.com/store/apps/details?id=com.zudo",
  webFallbackUrl: "https://zudo.example/get",
  iosDeepLink: "zudoapp://promo",
  androidDeepLink: "",
};
const base: SponsoredPlacement = { campaignId: "ad1", label: "Promoted", advertiserName: "Zudo" };

describe("ad destination resolution", () => {
  it("selects the store link by platform with a web fallback", () => {
    assert.equal(selectAppStoreLink(app, "ios"), app.iosStoreUrl);
    assert.equal(selectAppStoreLink(app, "android"), app.androidStoreUrl);
    assert.equal(selectAppStoreLink(app, "web"), app.webFallbackUrl);
    assert.equal(selectAppStoreLink({ ...app, iosStoreUrl: "" }, "ios"), app.webFallbackUrl);
    assert.equal(selectAppDeepLink({ ...app, iosDeepLink: "javascript://x" }, "ios"), null);
    assert.equal(detectAdPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"), "ios");
    assert.equal(detectAdPlatform("Mozilla/5.0 (Linux; Android 14)"), "android");
    assert.equal(detectAdPlatform("Mozilla/5.0 (X11; Linux x86_64)"), "web");
  });

  it("resolves installs, internal links and the signed redirect, and refuses unsafe targets", () => {
    const install = { ...base, adType: "app_install" as const, app, destination: { type: "app_store" as const } };
    assert.deepEqual(resolveAdTapAction(install, { kind: "cta" }, "android"), { kind: "install", url: app.androidStoreUrl, deepLink: null });
    assert.deepEqual(resolveAdTapAction({ ...base, destination: { type: "post", targetId: "p1" } }, { kind: "media" }, "web"), { kind: "internal", href: "/post/p1" });
    const redirect = "https://api.zudomart.com/api/v1/ads/r/abc";
    assert.deepEqual(resolveAdTapAction({ ...base, destination: { type: "url", url: "https://shop.example" }, clickLinks: { cta: redirect } }, { kind: "cta" }, "web"), { kind: "external", url: redirect });
    assert.deepEqual(resolveAdTapAction({ ...base, destination: { type: "url", url: "javascript:alert(1)" } }, { kind: "cta" }, "web"), { kind: "none" });
    assert.deepEqual(resolveAdTapAction({ ...base, destination: { type: "url", url: "http://insecure.example" } }, { kind: "cta" }, "web"), { kind: "none" });
  });

  it("carousel cards use their own destination and reject unknown cards", () => {
    const carousel: SponsoredPlacement = {
      ...base,
      adType: "carousel",
      clickLinks: { cards: ["https://api.zudomart.com/api/v1/ads/r/c0"] },
      cards: [
        { media: { kind: "image", url: "https://cdn.example/a.jpg" }, headline: "A", destination: { type: "url", url: "https://a.example" } },
        { media: { kind: "image", url: "https://cdn.example/b.jpg" }, headline: "B", destination: { type: "product", targetId: "prod" } },
      ],
    };
    assert.deepEqual(resolveAdTapAction(carousel, { kind: "card", index: 0 }, "web"), { kind: "external", url: "https://api.zudomart.com/api/v1/ads/r/c0" });
    assert.deepEqual(resolveAdTapAction(carousel, { kind: "card", index: 1 }, "web"), { kind: "internal", href: "/product/prod" });
    assert.deepEqual(resolveAdTapAction(carousel, { kind: "card", index: 9 }, "web"), { kind: "none" });
  });
});
