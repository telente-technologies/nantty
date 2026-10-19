import type { BusinessProfileAllowance, LinkedProfileItem, LinkedProfiles } from "@/types/brand.type";

import {
  businessProfileCreationState, describeBusinessProfileAllowance, describePremiumNeeded, linkedProfileBadges, shouldOfferBluePremium, usesPremiumProfileLayout,
} from "../businessProfileAllowance.util";
import { blockedCreateCode } from "../linkedProfiles.util";

const allowance = (overrides: Partial<BusinessProfileAllowance> = {}): BusinessProfileAllowance => ({ count: 1, limit: 2, premiumLimit: 5, premium: false, premiumNeeded: false, storeUsed: true, ...overrides });
const item = (overrides: Partial<LinkedProfileItem> = {}): LinkedProfileItem => ({
  kind: "store", profileId: "s1", storeId: "s1", status: "active", holdReason: null, name: "Temi Homes", handle: "temi", showsMart: true, ownsStore: true, premiumNeeded: false, ...overrides,
});
const linked = (businessProfiles: BusinessProfileAllowance, canCreate: LinkedProfiles["canCreate"]): LinkedProfiles => ({ accountId: "me", items: [item()], canCreate, choiceRequired: false, businessProfiles });
const closed = { store: false, business: false, brand: false };

describe("business profile allowance text", () => {
  it("counts profiles against the Premium limit and marks it as Premium", () => {
    expect(describeBusinessProfileAllowance(allowance({ count: 3, limit: 5, premium: true }))).toBe("3 of 5 business profiles (Premium)");
  });

  it("shows the standard limit without Premium", () => {
    expect(describeBusinessProfileAllowance(allowance({ count: 1 }))).toBe("1 of 2 business profiles");
    expect(describeBusinessProfileAllowance(undefined)).toBeNull();
  });

  it("explains the lapse state only when Premium is needed", () => {
    expect(describePremiumNeeded(allowance({ count: 3, premiumNeeded: true }))).toBe("Premium needed for more than 2 business profiles");
    expect(describePremiumNeeded(allowance())).toBeNull();
  });
});

describe("store and lapse badges", () => {
  it("puts the Store badge only on the profile that owns the store", () => {
    expect(linkedProfileBadges(item())).toEqual(["Store"]);
    expect(linkedProfileBadges(item({ kind: "business", ownsStore: false }))).toEqual([]);
    expect(linkedProfileBadges(null)).toEqual([]);
  });

  it("adds Premium needed to a profile over the standard limit", () => {
    expect(linkedProfileBadges(item({ kind: "brand", ownsStore: false, premiumNeeded: true }))).toEqual(["Premium needed"]);
  });
});

describe("creation limits", () => {
  it("upsells Premium to a standard account at its limit", () => {
    const standard = linked(allowance({ count: 2 }), closed);
    expect(businessProfileCreationState(standard)).toBe("premiumUpsell");
    expect(shouldOfferBluePremium(standard)).toBe(true);
    expect(blockedCreateCode(standard, "business")).toBe("PROFILE_LIMIT_STORE_OR_BUSINESS");
    expect(blockedCreateCode(standard, "brand")).toBe("PROFILE_LIMIT_ONE_BRAND");
  });

  it("tells a Premium owner at 5 they've reached the limit and never upsells", () => {
    const full = linked(allowance({ count: 5, limit: 5, premium: true }), closed);
    expect(businessProfileCreationState(full)).toBe("premiumLimitReached");
    expect(shouldOfferBluePremium(full)).toBe(false);
    expect(blockedCreateCode(full, "brand")).toBe("BUSINESS_PROFILE_LIMIT");
    expect(usesPremiumProfileLayout(full)).toBe(true);
  });

  it("allows one store only, even with Premium", () => {
    const premium = linked(allowance({ count: 2, limit: 5, premium: true }), { store: false, business: true, brand: true });
    expect(blockedCreateCode(premium, "store")).toBe("STORE_LIMIT_ONE");
    expect(blockedCreateCode(premium, "business")).toBeNull();
    expect(businessProfileCreationState(premium)).toBe("open");
  });

  it("blocks new profiles while Premium is needed", () => {
    const lapsed = linked(allowance({ count: 3, premiumNeeded: true }), closed);
    expect(businessProfileCreationState(lapsed)).toBe("premiumNeeded");
    expect(shouldOfferBluePremium(lapsed)).toBe(true);
    expect(usesPremiumProfileLayout(lapsed)).toBe(true);
  });
});
