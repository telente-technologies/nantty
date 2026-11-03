import { getSellerApplicationCountryState, isSellerApplicationContactComplete } from "../sellerApplicationEligibility.util";

describe("seller application country eligibility", () => {
  it("allows Nigerian seller applications", () => {
    expect(getSellerApplicationCountryState("NG")).toBe("eligible");
    expect(getSellerApplicationCountryState(" ng ")).toBe("eligible");
  });

  it("blocks seller applications for accounts set to another country", () => {
    expect(getSellerApplicationCountryState("GH")).toBe("unsupported_country");
    expect(getSellerApplicationCountryState("GB")).toBe("unsupported_country");
  });

  it("requires an account country before a seller can apply", () => {
    expect(getSellerApplicationCountryState(null)).toBe("country_required");
    expect(getSellerApplicationCountryState(undefined)).toBe("country_required");
    expect(getSellerApplicationCountryState("  ")).toBe("country_required");
  });

  it("keeps the seller phone number and pickup location required", () => {
    const contact = { phone: "0803 441 7720", addressLine: "12 Market Road", city: "Lagos", state: "Lagos" };
    expect(isSellerApplicationContactComplete(contact)).toBe(true);
    expect(isSellerApplicationContactComplete({ ...contact, phone: "" })).toBe(false);
    expect(isSellerApplicationContactComplete({ ...contact, phone: "0803 44" })).toBe(false);
  });
});
