import { buildSafePhoneLink } from "../phoneLink.util";

describe("buildSafePhoneLink", () => {
  it("normalizes international phone display formatting for a dial link", () => {
    expect(buildSafePhoneLink("+234 (803) 123-4567")).toBe("tel:+2348031234567");
  });

  it("rejects malformed or too-short values instead of constructing a URI", () => {
    expect(buildSafePhoneLink("call me")).toBeNull();
    expect(buildSafePhoneLink("+234 80")).toBeNull();
  });
});
