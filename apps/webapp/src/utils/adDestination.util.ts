import type { AdAppInstall, AdDestination, AdPlatform, AdTapAction, AdTapTarget, SponsoredPlacement } from "@/types";

const HTTPS_URL = /^https:\/\/[^\s/$.?#][^\s]*$/i;

export const isHttpsUrl = (candidate: string | null | undefined): candidate is string => Boolean(candidate && HTTPS_URL.test(candidate));

export function detectAdPlatform(userAgent: string): AdPlatform {
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  if (/android/i.test(userAgent)) return "android";
  return "web";
}

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

const internalHref = (destination: AdDestination): string | null => {
  const targetId = destination.targetId ? encodeURIComponent(destination.targetId) : "";
  if (!targetId) return null;
  switch (destination.type) {
    case "post":
      return `/post/${targetId}`;
    case "product":
      return `/product/${targetId}`;
    case "profile":
      return `/user/${targetId}`;
    case "store":
      return `/mart?store=${targetId}`;
    default:
      return null;
  }
};

function clickLinkFor(sponsored: SponsoredPlacement, target: AdTapTarget): string | undefined {
  if (target.kind === "card") return sponsored.clickLinks?.cards?.[target.index];
  return target.kind === "media" ? (sponsored.clickLinks?.media ?? sponsored.clickLinks?.cta) : sponsored.clickLinks?.cta;
}

function destinationFor(sponsored: SponsoredPlacement, target: AdTapTarget): AdDestination | null {
  if (target.kind === "card") return sponsored.cards?.[target.index]?.destination ?? null;
  if (sponsored.destination) return sponsored.destination;
  return sponsored.ctaUrl ? { type: "url", url: sponsored.ctaUrl } : null;
}

/** Decides what a click on an ad does. External and store opens go through the signed redirect so the click is logged server-side. */
export function resolveAdTapAction(sponsored: SponsoredPlacement, target: AdTapTarget, platform: AdPlatform): AdTapAction {
  const destination = destinationFor(sponsored, target);
  if (!destination) return { kind: "none" };
  const redirect = clickLinkFor(sponsored, target);
  if (destination.type === "app_store") {
    const url = isHttpsUrl(redirect) ? redirect : selectAppStoreLink(sponsored.app, platform);
    return url ? { kind: "install", url, deepLink: selectAppDeepLink(sponsored.app, platform) } : { kind: "none" };
  }
  if (destination.type === "url") {
    const url = isHttpsUrl(redirect) ? redirect : destination.url;
    return isHttpsUrl(url) ? { kind: "external", url } : { kind: "none" };
  }
  const href = internalHref(destination);
  return href ? { kind: "internal", href } : { kind: "none" };
}

export function isSignedRedirect(sponsored: SponsoredPlacement, url: string): boolean {
  const links = sponsored.clickLinks;
  return Boolean(links && (links.cta === url || links.media === url || links.cards?.includes(url)));
}
