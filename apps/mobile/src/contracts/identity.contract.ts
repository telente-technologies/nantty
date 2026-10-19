import { c } from "./contractSchema.util";
import type { EndpointContract } from "./endpointContract.type";

const userSummary = c.object({ id: c.string(), name: c.string(), username: c.string(), avatarUrl: c.nullable(c.string()), verified: c.boolean() }, ["verified"]);
const user = c.object({ id: c.string(), name: c.string(), username: c.string(), avatarUrl: c.nullable(c.string()), bannerUrl: c.nullable(c.string()), bio: c.string(), followers: c.number(), following: c.number(), posts: c.number(), profileKind: c.string(), showsMart: c.boolean() }, ["profileKind", "showsMart"]);
const address = c.object({
  id: c.string(), fullName: c.string(), phone: c.string(), line1: c.string(), postalCode: c.string(), details: c.string(), isDefault: c.boolean(),
  countryId: c.string(), countryCode: c.string(), country: c.string(), stateId: c.nullable(c.string()), state: c.string(), lgaId: c.nullable(c.string()),
  lga: c.nullable(c.string()), cityId: c.nullable(c.string()), city: c.string(),
});
const geoCountry = c.object({ id: c.string(), code: c.string(), name: c.string(), currency: c.string(), levels: c.array(c.string()), stateLabel: c.string(), lgaLabel: c.string() });
const geoArea = c.object({ id: c.string(), name: c.string(), parentId: c.string() });
const countryOption = c.object({ countryCode: c.string(), countryName: c.string(), currency: c.string(), currencyName: c.string() });
const actingProfile = c.object({ kind: c.string(["person", "business", "brand", "store", "government"]), id: c.string(), name: c.string(), handle: c.string(), avatarUrl: c.nullable(c.string()) }, ["verification"]);
const linkedProfileItem = c.object({
  kind: c.string(["store", "business", "brand"]), profileId: c.string(), storeId: c.nullable(c.string()), status: c.string(["active", "held", "retired"]),
  holdReason: c.nullable(c.string()), name: c.string(), handle: c.string(), showsMart: c.boolean(), ownsStore: c.boolean(), premiumNeeded: c.boolean(),
});
const businessProfileAllowance = c.object({ count: c.number(), limit: c.number(), premiumLimit: c.number(), premium: c.boolean(), premiumNeeded: c.boolean(), storeUsed: c.boolean() });
const linkedProfiles = c.object({
  accountId: c.string(), items: c.array(linkedProfileItem), canCreate: c.object({ store: c.boolean(), business: c.boolean(), brand: c.boolean() }), choiceRequired: c.boolean(),
  businessProfiles: businessProfileAllowance,
});
const usernameReason = c.string(["taken", "reserved", "invalid", "recently_used", "withheld"]);
const usernamePolicy = c.object({
  username: c.string(), canChangeNow: c.boolean(), nextChangeAvailableAt: c.nullable(c.string()), changesRemainingThisYear: c.number(), cooldownDays: c.number(),
  maxChangesPerYear: c.number(), quarantineDays: c.number(), rules: c.array(c.string()), history: c.array(c.object({ from: c.string(), to: c.string(), changedAt: c.string(), reason: c.string() })),
});

export const identityContracts: readonly EndpointContract[] = [
  {
    domain: "verification",
    method: "GET",
    path: "/api/v1/verification/discounts",
    schema: c.object({
      offers: c.array(c.object({
        linkId: c.string(), token: c.string(), plans: c.array(c.object({ planCode: c.string(), planLabel: c.string() })),
        discount: c.object({ kind: c.string(["percentage", "fixed_amount"]), percentOff: c.number(), amountOff: c.object({ amountMinor: c.number(), currency: c.string() }) }, ["percentOff", "amountOff"]),
        durationCycles: c.number(), expiresAt: c.nullable(c.string()), sentAt: c.string(),
      })),
      yearlyPercentOff: c.number(),
      bundle: c.nullable(c.object({ percentOff: c.number() })),
    }),
  },
  { domain: "users", method: "GET", path: "/api/v1/users/me", schema: user },
  { domain: "users", method: "GET", path: "/api/v1/users/me/profiles", schema: c.page(actingProfile) },
  { domain: "users", method: "GET", path: "/api/v1/users/me/addresses", schema: c.page(address) },
  { domain: "users", method: "GET", path: "/api/v1/users/me/linked-profiles", schema: linkedProfiles },
  { domain: "users", method: "GET", path: "/api/v1/users/me/username-policy", schema: usernamePolicy },
  { domain: "users", method: "POST", path: "/api/v1/users/me/media/upload-intents", body: { purpose: "avatar", contentType: "image/png", sizeBytes: 1, previewUri: "file:///a.png" }, schema: c.object({ mediaId: c.string(), uploadUrl: c.string(), method: c.string(), headers: c.any(), publicUrl: c.string(), expiresAt: c.string(), maximumSize: c.number() }, ["maximumSize"]) },
  { domain: "users", method: "GET", path: "/api/v1/locale/countries", schema: c.page(countryOption) },
  { domain: "auth", method: "GET", path: "/api/v1/auth/username-available?username=zudo.new", schema: c.object({ available: c.boolean(), reason: usernameReason, message: c.string() }, ["reason", "message"]) },
  { domain: "auth", method: "GET", path: "/api/v1/auth/username-available?username=admin", schema: c.object({ available: c.boolean(), reason: usernameReason, message: c.string() }, ["message"]) },
  { domain: "auth", method: "GET", path: "/api/v1/auth/username-available?username=taken", schema: c.object({ available: c.boolean(), reason: usernameReason, message: c.string(), suggestions: c.array(c.string()) }, ["message"]) },
  { domain: "users", method: "GET", path: "/api/v1/geo/countries", schema: c.page(geoCountry) },
  { domain: "users", method: "GET", path: "/api/v1/geo/countries/ng/regions", schema: c.page(geoArea) },
  { domain: "live", method: "GET", path: "/api/v1/lives/suggested", schema: c.page(c.object({ id: c.string(), host: userSummary, title: c.string(), coverUrl: c.nullable(c.string()) })) },
  { domain: "live", method: "GET", path: "/api/v1/lives/live_s0/viewers", schema: c.page(userSummary) },
];

export const errorBodyContract = c.object({ message: c.string(), code: c.string() }, ["code"]);
