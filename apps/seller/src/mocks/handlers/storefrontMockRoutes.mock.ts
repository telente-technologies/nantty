import { describeMockActor } from "@/mocks/handlers/settingsEntitlements.mock";
import { appendMockAuditLogEntry, readMockDatabase, readStoreScopedMockSlice } from "@/mocks/mockDatabase.mock";
import { MockHttpError, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import { buildDemoStorefrontRecord, type MockStorefrontRecord } from "@/mocks/seed/demoStorefronts.mock";
import type { StorePolicies } from "@/types/store.type";
import { storefrontSocialNetworks, storefrontWeekdays, type StorefrontOpeningHours, type StorefrontProfile, type StorefrontSocialLinks } from "@/types/storefront.type";
import { fieldChecks, validateObjectAgainstChecks, type ValidationIssue } from "@/utils/formValidation.util";

const maximumFeaturedProducts = 8;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function readStorefrontRecord(): MockStorefrontRecord {
  return readStoreScopedMockSlice("storefront", buildDemoStorefrontRecord);
}

function listDefaultFeaturedProductIds(): string[] {
  return readMockDatabase().products.filter((product) => product.status === "active" && product.publishedOnline).slice(0, 4).map((product) => product.id);
}

export function buildStorefrontProfileForCurrentStore(): StorefrontProfile {
  const database = readMockDatabase();
  const record = readStorefrontRecord();
  const featuredProductIds = record.featuredProductIds ?? listDefaultFeaturedProductIds();
  const productById = new Map(database.products.map((product) => [product.id, product]));
  return {
    storeId: database.settings.storeId,
    name: database.settings.name,
    handle: database.settings.handle,
    publicUrl: `https://nantty.com/@${database.settings.handle}`,
    logoUrl: record.logoUrl ?? database.settings.logoUrl,
    coverUrl: record.coverUrl,
    tagline: record.tagline,
    description: database.settings.description,
    policies: database.settings.policies,
    openingHours: record.openingHours,
    socialLinks: record.socialLinks,
    featuredProducts: featuredProductIds.flatMap((productId) => {
      const product = productById.get(productId);
      const firstVariant = product?.variants[0];
      if (!product || !firstVariant) return [];
      return [{ productId, name: product.name, imageUrl: product.images[0]?.url ?? null, price: firstVariant.price, isAvailable: product.status === "active" && product.publishedOnline }];
    }),
    deliveryAreas: [...new Set(database.locations.filter((location) => location.active).map((location) => location.state))],
    followerCount: record.followerCount,
    averageRating: record.averageRating,
    updatedAt: record.updatedAt,
  };
}

function validateOpeningHours(value: unknown, issues: ValidationIssue[]): StorefrontOpeningHours[] | undefined {
  if (value === undefined) return undefined;
  const isValid = Array.isArray(value) && value.length === 7 && value.every((entry, index) => {
    const hours = entry as Partial<StorefrontOpeningHours>;
    return hours.weekday === storefrontWeekdays[index] && typeof hours.isOpen === "boolean" && timePattern.test(String(hours.opensAt)) && timePattern.test(String(hours.closesAt)) && (!hours.isOpen || String(hours.opensAt) < String(hours.closesAt));
  });
  if (!isValid) issues.push({ path: "openingHours", message: "Give each day an opening time before its closing time." });
  return isValid ? (value as StorefrontOpeningHours[]) : undefined;
}

function validateSocialLinks(value: unknown, issues: ValidationIssue[]): StorefrontSocialLinks | undefined {
  if (value === undefined) return undefined;
  const links = value as Record<string, unknown>;
  const cleaned = {} as Record<string, string | null>;
  for (const network of storefrontSocialNetworks) {
    const link = links?.[network];
    if (link === null || link === undefined || link === "") cleaned[network] = null;
    else if (typeof link === "string" && /^https:\/\/[^\s]{3,200}$/.test(link.trim())) cleaned[network] = link.trim();
    else issues.push({ path: `socialLinks.${network}`, message: "Links must start with https://." });
  }
  return cleaned as StorefrontSocialLinks;
}

function validatePolicies(value: unknown, issues: ValidationIssue[]): StorePolicies | undefined {
  if (value === undefined) return undefined;
  const policies = value as Partial<StorePolicies>;
  for (const key of ["returns", "shipping", "privacy"] as const) {
    if (typeof policies?.[key] !== "string" || (policies[key] as string).length > 2000) issues.push({ path: `policies.${key}`, message: "Keep each policy under 2,000 characters." });
  }
  return issues.some((issue) => issue.path.startsWith("policies")) ? undefined : (policies as StorePolicies);
}

function resolveMediaUrlOrThrow(mediaId: unknown): string | null | undefined {
  if (mediaId === undefined) return undefined;
  if (mediaId === null) return null;
  const media = readMockDatabase().media.get(String(mediaId));
  if (!media || media.status !== "ready") throw new MockHttpError(422, "MEDIA_NOT_READY", "That image has not finished uploading.");
  return media.url;
}

export function registerStorefrontMockRoutes(): void {
  registerMockRoute("GET", "/seller/storefront", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, buildStorefrontProfileForCurrentStore());
  });

  registerMockRoute("PATCH", "/seller/storefront", (request) => {
    const principal = requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const issues = validateObjectAgainstChecks(body, {
      name: fieldChecks.optional(fieldChecks.text({ label: "Store name", min: 2, max: 80 })),
      tagline: (value) => (value === undefined || (typeof value === "string" && value.length <= 80) ? null : "Keep the tagline under 80 characters."),
      description: (value) => (value === undefined || (typeof value === "string" && value.length <= 500) ? null : "Keep the description under 500 characters."),
    });
    const openingHours = validateOpeningHours(body.openingHours, issues);
    const socialLinks = validateSocialLinks(body.socialLinks, issues);
    const policies = validatePolicies(body.policies, issues);
    const database = readMockDatabase();
    let featuredProductIds: string[] | undefined;
    if (body.featuredProductIds !== undefined) {
      const knownIds = new Set(database.products.map((product) => product.id));
      const requested = Array.isArray(body.featuredProductIds) ? [...new Set(body.featuredProductIds.map(String))] : [];
      if (!Array.isArray(body.featuredProductIds) || requested.length > maximumFeaturedProducts || requested.some((productId) => !knownIds.has(productId))) issues.push({ path: "featuredProductIds", message: `Feature up to ${maximumFeaturedProducts} of your own products.` });
      else featuredProductIds = requested;
    }
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const logoUrl = resolveMediaUrlOrThrow(body.logoMediaId);
    const coverUrl = resolveMediaUrlOrThrow(body.coverMediaId);
    const record = readStorefrontRecord();
    if (typeof body.tagline === "string") record.tagline = body.tagline.trim();
    if (openingHours) record.openingHours = openingHours;
    if (socialLinks) record.socialLinks = socialLinks;
    if (featuredProductIds) record.featuredProductIds = featuredProductIds;
    if (logoUrl !== undefined) record.logoUrl = logoUrl;
    if (coverUrl !== undefined) record.coverUrl = coverUrl;
    record.updatedAt = new Date().toISOString();
    database.settings = {
      ...database.settings,
      name: typeof body.name === "string" ? body.name.trim() : database.settings.name,
      description: typeof body.description === "string" ? body.description.trim() : database.settings.description,
      logoUrl: logoUrl !== undefined ? logoUrl : database.settings.logoUrl,
      policies: policies ?? database.settings.policies,
    };
    appendMockAuditLogEntry({ actor: describeMockActor(principal), action: "storefront.updated", targetType: "store", targetId: principal.storeId, summary: `Updated the storefront: ${Object.keys(body).join(", ")}` });
    return respondWithJson(200, buildStorefrontProfileForCurrentStore());
  });
}
