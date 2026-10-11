import { ApiError } from "@/errors/api.error";
import { resolveErrorKind } from "@/errors/errorExperience/errorMapper";
import { resolveMockApiRequest } from "@/mocks";
import type { BrandDetail, LinkedProfiles } from "@/types/brand.type";
import { blockedCreateCode, profileShowsMart } from "@/utils/linkedProfiles.util";

const businessInput = { displayName: "Lagos Food Bank", handle: "lagos.food.bank", description: "", categories: [{ categoryId: "bc_ngo" }], purpose: "business" };
const brandInput = { name: "Temi Clay", handle: "temi.clay", logoUrl: null, coverUrl: null, categoryId: "cat_home", description: "Hand-thrown clay pots made in Ibadan for everyday cooking.", website: null };

async function failureOf(request: Promise<unknown>) {
  return request.then(() => null, (error: unknown) => error);
}

describe("profile entity rule in mock mode", () => {
  it("lists one Store and offers only a Brand to an account that already sells", async () => {
    const linked = await resolveMockApiRequest<LinkedProfiles>("GET", "/api/v1/users/me/linked-profiles");
    expect(linked.items.filter((item) => item.kind === "store")).toHaveLength(1);
    expect(linked.canCreate).toEqual({ store: false, business: false, brand: true });
    expect(blockedCreateCode(linked, "business")).toBe("PROFILE_LIMIT_STORE_OR_BUSINESS");
    expect(blockedCreateCode(linked, "brand")).toBeNull();
  });

  it("refuses a Business page or a second store with PROFILE_LIMIT_STORE_OR_BUSINESS", async () => {
    const business = await failureOf(resolveMockApiRequest("POST", "/api/v1/users/me/business-profiles", businessInput));
    expect(business).toBeInstanceOf(ApiError);
    expect(business).toMatchObject({ status: 409, code: "PROFILE_LIMIT_STORE_OR_BUSINESS" });
    expect(resolveErrorKind({ code: (business as ApiError).code, status: 409 }).kind).toBe("profileLimit");
  });

  it("allows one Brand and refuses the second with PROFILE_LIMIT_ONE_BRAND", async () => {
    const brand = await resolveMockApiRequest<BrandDetail>("POST", "/api/v1/brands", brandInput);
    expect(brand.sellingEnabled).toBe(false);
    const second = await failureOf(resolveMockApiRequest("POST", "/api/v1/brands", { ...brandInput, handle: "temi.clay.two" }));
    expect(second).toMatchObject({ status: 409, code: "PROFILE_LIMIT_ONE_BRAND" });
    const linked = await resolveMockApiRequest<LinkedProfiles>("GET", "/api/v1/users/me/linked-profiles");
    expect(linked.canCreate.brand).toBe(false);
  });

  it("toggles brand selling for the owner only", async () => {
    const linked = await resolveMockApiRequest<LinkedProfiles>("GET", "/api/v1/users/me/linked-profiles");
    const brandId = linked.items.find((item) => item.kind === "brand")!.profileId;
    const on = await resolveMockApiRequest<BrandDetail>("PATCH", `/api/v1/brands/${brandId}`, { sellingEnabled: true });
    expect(on.sellingEnabled).toBe(true);
    const off = await resolveMockApiRequest<BrandDetail>("PATCH", `/api/v1/brands/${brandId}`, { sellingEnabled: false });
    expect(off.showsMart).toBe(false);
    expect(await failureOf(resolveMockApiRequest("PATCH", "/api/v1/brands/br_adire", { sellingEnabled: true }))).toMatchObject({ status: 403, code: "OWNER_ONLY" });
  });

  it("refuses a choice when nothing is on hold", async () => {
    expect(await failureOf(resolveMockApiRequest("POST", "/api/v1/users/me/linked-profiles/choose", { keep: [] }))).toMatchObject({ status: 409, code: "NO_CHOICE_REQUIRED" });
  });

  it("never shows the Mart icon on a Business page", () => {
    expect(profileShowsMart({ kind: "business", showsMart: true }, true)).toBe(false);
    expect(profileShowsMart({ kind: "brand", showsMart: false }, true)).toBe(false);
    expect(profileShowsMart({ kind: "brand", showsMart: true }, false)).toBe(true);
    expect(profileShowsMart({ kind: "store" }, true)).toBe(true);
    expect(profileShowsMart(null, false)).toBe(false);
  });
});
