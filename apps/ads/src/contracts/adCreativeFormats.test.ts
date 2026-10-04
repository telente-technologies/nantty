import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createEmptyCardDraft } from "@/components/campaignWizard/campaignWizardState.store";
import type { CreativeApp, CreativeCardInput } from "@/types/creative.type";
import { buildUtmUrl, moveItem, isAndroidStoreUrl, isAppDeepLink, isIosStoreUrl, selectAppLink, validateAppInstallFields, validateCarouselFields } from "@/utils/adCreativeFormats.util";

const card = (overrides: Partial<CreativeCardInput> = {}): CreativeCardInput => ({ mediaId: "m", headline: "Card", description: "", callToAction: "learn_more", destination: { type: "url", targetId: null, url: "https://shop.example/a" }, ...overrides });
const app = (overrides: Partial<CreativeApp> = {}): CreativeApp => ({ appName: "Zudo", rating: null, iosStoreUrl: "https://apps.apple.com/ng/app/zudo/id1", androidStoreUrl: "https://play.google.com/store/apps/details?id=com.zudo", webFallbackUrl: "", iosDeepLink: "", androidDeepLink: "", ...overrides });

describe("carousel validation", () => {
  it("needs 2 to 10 cards", () => {
    assert.ok(validateCarouselFields([card()]).cards);
    assert.ok(validateCarouselFields(Array.from({ length: 11 }, () => card())).cards);
    assert.deepEqual(validateCarouselFields([card(), card()]), {});
    assert.deepEqual(validateCarouselFields(Array.from({ length: 10 }, () => card())), {});
  });
  it("checks each card", () => {
    const issues = validateCarouselFields([card(), card({ mediaId: "", headline: "x".repeat(41), destination: { type: "url", targetId: null, url: "http://insecure.example" } })]);
    assert.ok(issues["cards.1.mediaId"] && issues["cards.1.headline"] && issues["cards.1.destination.url"]);
  });
  it("reorders cards without losing any", () => {
    const cards = [createEmptyCardDraft(), createEmptyCardDraft(), createEmptyCardDraft()];
    const moved = moveItem(cards, 0, 1);
    assert.deepEqual(moved.map((c) => c.key), [cards[1]!.key, cards[0]!.key, cards[2]!.key]);
    assert.deepEqual(moveItem(cards, 0, -1).map((c) => c.key), cards.map((c) => c.key));
  });
});

describe("app install links", () => {
  it("validates store urls and deep links", () => {
    assert.ok(isIosStoreUrl("https://apps.apple.com/ng/app/zudo/id1"));
    assert.ok(!isIosStoreUrl("https://evil.example/app/x"));
    assert.ok(isAndroidStoreUrl("https://play.google.com/store/apps/details?id=com.zudo"));
    assert.ok(!isAndroidStoreUrl("https://play.google.com/store/apps/details"));
    assert.ok(isAppDeepLink("zudoapp://promo"));
    assert.ok(!isAppDeepLink("javascript://x") && !isAppDeepLink("https://zudo.example"));
    assert.deepEqual(validateAppInstallFields(app()), {});
    assert.ok(validateAppInstallFields(app({ androidStoreUrl: "" }))["app.webFallbackUrl"]);
  });
  it("selects the link by platform and falls back to the web link", () => {
    const full = app({ webFallbackUrl: "https://zudo.example/get" });
    assert.equal(selectAppLink(full, "ios"), full.iosStoreUrl);
    assert.equal(selectAppLink(full, "android"), full.androidStoreUrl);
    assert.equal(selectAppLink(full, "web"), full.webFallbackUrl);
    assert.equal(selectAppLink(app({ iosStoreUrl: "", webFallbackUrl: "https://zudo.example/get" }), "ios"), "https://zudo.example/get");
  });
  it("builds utm links without overriding existing parameters", () => {
    const tagged = new URL(buildUtmUrl("https://shop.example/p?utm_source=mine", { campaign: "spring" }));
    assert.equal(tagged.searchParams.get("utm_source"), "mine");
    assert.equal(tagged.searchParams.get("utm_medium"), "paid");
    assert.equal(tagged.searchParams.get("utm_campaign"), "spring");
  });
});
