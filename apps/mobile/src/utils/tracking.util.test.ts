import { isValidOptionalTrackingUrl, isValidTrackingNumber } from "./tracking.util";

describe("shipment tracking validation", () => {
  it("matches server tracking-number bounds and characters", () => {
    expect(isValidTrackingNumber(" GIG-1234 ")).toBe(true);
    expect(isValidTrackingNumber("ABC")).toBe(false);
    expect(isValidTrackingNumber("AB 1234")).toBe(false);
    expect(isValidTrackingNumber("A".repeat(41))).toBe(false);
  });

  it("accepts blank or valid HTTPS tracking URLs only", () => {
    expect(isValidOptionalTrackingUrl("  ")).toBe(true);
    expect(isValidOptionalTrackingUrl("https://carrier.example/track/1234")).toBe(true);
    expect(isValidOptionalTrackingUrl("http://carrier.example/track")).toBe(false);
    expect(isValidOptionalTrackingUrl("https://user:pass@carrier.example/track")).toBe(false);
    expect(isValidOptionalTrackingUrl("https://carrier.example/track with space")).toBe(false);
  });
});
