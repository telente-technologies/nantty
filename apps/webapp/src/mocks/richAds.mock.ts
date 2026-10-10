import type { AdCard, Post, SponsoredPlacement } from "@/types";

const MOCK_REDIRECT_BASE = "https://api.zudomart.com/api/v1/ads/r";

const placementFor = (post: Post, overrides: Partial<SponsoredPlacement>): SponsoredPlacement => ({
  campaignId: post.sponsored?.campaignId ?? `cmp_${post.id}`,
  label: "Promoted",
  advertiserName: post.author.name,
  ...overrides,
});

function buildCarouselAd(source: Post): Post {
  const cards: AdCard[] = source.media.filter((media) => Boolean(media.url)).slice(0, 4).map((media, index) => ({
    media: { kind: "image", url: media.url ?? "", width: 1, height: 1 },
    headline: `${source.products[0]?.name ?? "New arrival"} ${index + 1}`,
    description: "Pay into escrow, release when it fits.",
    ctaLabel: index === 0 ? "Shop now" : "Learn more",
    destination: source.products[0] ? { type: "product", targetId: source.products[0].id } : { type: "url", url: "https://zudomart.com" },
  }));
  return {
    ...source,
    id: `${source.id}_carousel`,
    text: "Four looks, one tap each. Swipe to see the new collection.",
    sponsored: placementFor(source, {
      adType: "carousel",
      impressionToken: "mock.impression.token",
      cards,
      clickLinks: { cards: cards.map((_, index) => `${MOCK_REDIRECT_BASE}/mock-card-${index}`) },
    }),
  };
}

function buildAppInstallAd(source: Post): Post {
  return {
    ...source,
    id: `${source.id}_install`,
    text: "Track your orders and pay into escrow from your phone. Free on iPhone and Android.",
    sponsored: placementFor(source, {
      adType: "app_install",
      ctaLabel: "Install",
      impressionToken: "mock.impression.token",
      destination: { type: "app_store" },
      clickLinks: { cta: `${MOCK_REDIRECT_BASE}/mock-install` },
      app: {
        appName: "Zudo Companion",
        iconUrl: source.media[0]?.url ?? null,
        rating: 4.6,
        iosStoreUrl: "https://apps.apple.com/ng/app/zudo-companion/id1000000000",
        androidStoreUrl: "https://play.google.com/store/apps/details?id=com.zudomart.companion",
        webFallbackUrl: "https://zudomart.com/app",
        iosDeepLink: "zudocompanion://home",
        androidDeepLink: "zudocompanion://home",
      },
    }),
  };
}

function buildPromotedPostAd(source: Post): Post {
  return {
    ...source,
    id: `${source.id}_promoted`,
    sponsored: placementFor(source, {
      adType: "promoted_post",
      ctaLabel: "Watch more",
      impressionToken: "mock.impression.token",
      mediaClickable: true,
      destination: { type: "post", targetId: source.id },
    }),
  };
}

function buildBoostedPost(source: Post): Post {
  return {
    ...source,
    id: `${source.id}_boosted`,
    sponsored: placementFor(source, { campaignId: `bst_${source.id}`, label: "Boosted", adType: "promoted_post", impressionToken: "mock.impression.token", destination: { type: "post", targetId: source.id } }),
  };
}

export function buildRichSponsoredPosts(sponsoredPosts: readonly Post[]): Post[] {
  const [first, second, third] = sponsoredPosts;
  return [second && buildCarouselAd(second), first && buildAppInstallAd(first), third && buildPromotedPostAd(third), first && buildBoostedPost(first)].filter((post): post is Post => Boolean(post));
}
