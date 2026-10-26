import type { AdStorePlatform, CreativeApp, CreativeCardInput, CreativeInput, CreativeUtm } from "@/types/creative.type";
import { isSafeHttpsUrl } from "@/utils/formValidation.util";

export const minimumCarouselCards = 2;
export const maximumCarouselCards = 10;
export const cardHeadlineMaximumLength = 40;
export const cardDescriptionMaximumLength = 90;

export type CreativeFormatIssues = Record<string, string>;

const forbiddenDeepLinkSchemes = new Set(["javascript", "data", "file", "http", "https", "vbscript", "blob", "intent"]);

export function isIosStoreUrl(candidate: string): boolean {
  if (!isSafeHttpsUrl(candidate)) return false;
  const url = new URL(candidate);
  return (url.hostname === "apps.apple.com" || url.hostname === "itunes.apple.com") && url.pathname.includes("/app/");
}

export function isAndroidStoreUrl(candidate: string): boolean {
  if (!isSafeHttpsUrl(candidate)) return false;
  const url = new URL(candidate);
  return url.hostname === "play.google.com" && url.pathname === "/store/apps/details" && Boolean(url.searchParams.get("id"));
}

export function isAppDeepLink(candidate: string): boolean {
  const match = /^([a-z][a-z0-9+.-]{1,30}):\/\/[^\s<>"']{0,500}$/.exec(candidate);
  return Boolean(match && !forbiddenDeepLinkSchemes.has(match[1] ?? ""));
}

export function isValidUtmValue(value: string): boolean {
  return value.length <= 60 && /^[A-Za-z0-9._-]*$/.test(value);
}

export function buildUtmUrl(rawUrl: string, utm: CreativeUtm | null | undefined): string {
  if (!utm || !isSafeHttpsUrl(rawUrl)) return rawUrl;
  const url = new URL(rawUrl);
  const entries: [string, string | undefined, string][] = [["utm_source", utm.source, "nantty"], ["utm_medium", utm.medium, "paid"], ["utm_campaign", utm.campaign, ""], ["utm_content", utm.content, ""], ["utm_term", utm.term, ""]];
  for (const [key, value, fallback] of entries) {
    const resolved = (value ?? "").trim() || fallback;
    if (resolved && !url.searchParams.get(key)) url.searchParams.set(key, resolved);
  }
  return url.toString();
}

export function selectAppLink(app: CreativeApp | null | undefined, platform: AdStorePlatform): string | null {
  if (!app) return null;
  if (platform === "ios" && app.iosStoreUrl) return app.iosStoreUrl;
  if (platform === "android" && app.androidStoreUrl) return app.androidStoreUrl;
  return app.webFallbackUrl || null;
}

export function validateAppInstallFields(app: CreativeApp | null): CreativeFormatIssues {
  const issues: CreativeFormatIssues = {};
  if (!app) return { app: "Add the app details." };
  if (!app.appName.trim() || app.appName.trim().length > 50) issues["app.appName"] = "Enter the app name (up to 50 characters).";
  if (app.rating !== null && (app.rating < 1 || app.rating > 5)) issues["app.rating"] = "A rating must be between 1 and 5.";
  if (app.iosStoreUrl && !isIosStoreUrl(app.iosStoreUrl)) issues["app.iosStoreUrl"] = "Use an https://apps.apple.com/.../app/... link.";
  if (app.androidStoreUrl && !isAndroidStoreUrl(app.androidStoreUrl)) issues["app.androidStoreUrl"] = "Use an https://play.google.com/store/apps/details?id=... link.";
  if (app.webFallbackUrl && !isSafeHttpsUrl(app.webFallbackUrl)) issues["app.webFallbackUrl"] = "Use a full https:// link.";
  if (!app.iosStoreUrl && !app.androidStoreUrl) issues.app = "Add an App Store or Google Play link.";
  else if ((!app.iosStoreUrl || !app.androidStoreUrl) && !app.webFallbackUrl) issues["app.webFallbackUrl"] = "Add a web link for viewers on other platforms.";
  if (app.iosDeepLink && !isAppDeepLink(app.iosDeepLink)) issues["app.iosDeepLink"] = "Use an app link like myapp://open, not a web link.";
  if (app.androidDeepLink && !isAppDeepLink(app.androidDeepLink)) issues["app.androidDeepLink"] = "Use an app link like myapp://open, not a web link.";
  return issues;
}

export function validateCarouselFields(cards: readonly CreativeCardInput[]): CreativeFormatIssues {
  const issues: CreativeFormatIssues = {};
  if (cards.length < minimumCarouselCards || cards.length > maximumCarouselCards) issues.cards = `Add ${minimumCarouselCards} to ${maximumCarouselCards} cards.`;
  cards.forEach((card, index) => {
    if (!card.mediaId) issues[`cards.${index}.mediaId`] = "Add an image or video to this card.";
    if (!card.headline.trim() || card.headline.trim().length > cardHeadlineMaximumLength) issues[`cards.${index}.headline`] = `Write a card headline up to ${cardHeadlineMaximumLength} characters.`;
    if (card.description.length > cardDescriptionMaximumLength) issues[`cards.${index}.description`] = `Keep the description under ${cardDescriptionMaximumLength} characters.`;
    if (card.destination.type === "url" && !isSafeHttpsUrl(card.destination.url ?? "")) issues[`cards.${index}.destination.url`] = "Enter a full https:// website address.";
    if (["post", "product", "store", "profile"].includes(card.destination.type) && !card.destination.targetId) issues[`cards.${index}.destination.targetId`] = "Choose the destination.";
  });
  return issues;
}

export function validateCreativeTypeFields(input: Pick<CreativeInput, "type" | "format" | "cards" | "app" | "source" | "destination">): CreativeFormatIssues {
  if (input.type === "carousel") return { ...validateCarouselFields(input.cards), ...(input.format !== "feed_post" ? { format: "Carousel ads run in the feed only." } : {}) };
  if (input.type === "app_install") return { ...validateAppInstallFields(input.app), ...(input.destination.type !== "app_store" ? { "destination.type": "App install ads lead to the app store." } : {}) };
  if (input.type === "promoted_post") {
    const issues: CreativeFormatIssues = {};
    if (input.source.type !== "post" && input.source.type !== "clip") issues.source = "Promote an existing post or clip.";
    if (input.destination.type !== "post" || input.destination.targetId !== input.source.id) issues.destination = "A promoted post opens the post it boosts.";
    return issues;
  }
  return {};
}

export function moveItem<Item>(items: readonly Item[], index: number, direction: -1 | 1): Item[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target] as Item, next[index] as Item];
  return next;
}
