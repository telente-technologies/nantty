import { userProfileShowsMart } from "@/utils/linkedProfiles.util";

describe("userProfileShowsMart", () => {
  it("never shows the Mart tab for a business page owner, even with the seller role", () => {
    expect(userProfileShowsMart({ isSeller: true, profileKind: "business", showsMart: true })).toBe(false);
  });

  it("follows the server's showsMart for stores and personal accounts", () => {
    expect(userProfileShowsMart({ isSeller: true, profileKind: "store", showsMart: true })).toBe(true);
    expect(userProfileShowsMart({ isSeller: false, profileKind: "store", showsMart: false })).toBe(false);
  });

  it("falls back to the seller role when an older server sends no kind", () => {
    expect(userProfileShowsMart({ isSeller: true })).toBe(true);
    expect(userProfileShowsMart({})).toBe(false);
    expect(userProfileShowsMart(undefined)).toBe(false);
  });
});
