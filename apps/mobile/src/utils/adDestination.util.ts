import type { AdAppInstall, AdDestination, AdPlatform, AdTapAction, AdTapTarget, SponsoredPlacement } from "@/types";

const HTTPS_URL = /^https:\/\/[^\s/$.?#][^\s]*$/i;

export const isHttpsUrl = (candidate: string | null | undefined): candidate is string => Boolean(candidate && HTTPS_URL.test(candidate));

export function selectAppStoreLink(app: AdAppInstall | undefined, platform: AdPlatform): string | null {
  if (!app) return null;
  const platformLink = platform === "ios" ? app.iosStoreUrl : platform === "android" ? app.androidStoreUrl : "";
  const chosen = platformLink || app.webFallbackUrl;
  return isHttpsUrl(chosen) ? chosen : null;
}

export function selectAppDeepLink(app: AdAppInstall | undefined, platform: AdPlatform): string | null {
  const link = platform === "ios" ? app?.iosDeepLink : platform === "android" ? app?.androidDeepLink : "";
  return link && /^[a-z][a-z0-9+.-]{1,30}:\/\//i.test(link) && !/^(https?|javascript|data|file|intent):/i.test(link) ? link : null;
}

function clickLinkFor(sponsored: SponsoredPlacement, target: AdTapTarget): string | undefined {
  if (target.kind === "card") return sponsored.clickLinks?.cards?.[target.index];
  return target.kind === "media" ? (sponsored.clickLinks?.media ?? sponsored.clickLinks?.cta) : sponsored.clickLinks?.cta;
}

function destinationFor(sponsored: SponsoredPlacement, target: AdTapTarget): AdDestination | null {
  if (target.kind === "card") return sponsored.cards?.[target.index]?.destination ?? null;
  if (sponsored.destination) return sponsored.destination;
  if (!sponsored.ctaUrl) return null;
  const productMatch = sponsored.ctaUrl.match(/\/products\/([^/?#]+)/);
  if (productMatch) return { type: "product", targetId: decodeURIComponent(productMatch[1]!) };
  const storeMatch = sponsored.ctaUrl.match(/\/stores\/([^/?#]+)/);
  if (storeMatch) return { type: "store", targetId: decodeURIComponent(storeMatch[1]!) };
  return { type: "url", url: sponsored.ctaUrl };
}

export function resolveAdTapAction(sponsored: SponsoredPlacement, target: AdTapTarget, platform: AdPlatform): AdTapAction {
  const destination = destinationFor(sponsored, target);
  if (!destination) return { kind: "none" };
  const redirect = clickLinkFor(sponsored, target);
  const targetId = destination.targetId ?? "";
  switch (destination.type) {
    case "app_store": {
      const url = isHttpsUrl(redirect) ? redirect : selectAppStoreLink(sponsored.app, platform);
      return url ? { kind: "install", url, deepLink: selectAppDeepLink(sponsored.app, platform) } : { kind: "none" };
    }
    case "post":
      return targetId ? { kind: "internal", route: "PostDetail", params: { postId: targetId } } : { kind: "none" };
    case "product":
      return targetId ? { kind: "internal", route: "ProductDetail", params: { productId: targetId } } : { kind: "none" };
    case "store":
      return targetId ? { kind: "internal", route: "Store", params: { storeId: targetId } } : { kind: "none" };
    case "profile":
      return targetId ? { kind: "internal", route: "UserProfile", params: { userId: targetId } } : { kind: "none" };
    case "url": {
      const url = isHttpsUrl(redirect) ? redirect : destination.url;
      return isHttpsUrl(url) ? { kind: "external", url } : { kind: "none" };
    }
    default:
      return { kind: "none" };
  }
}
