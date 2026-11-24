import { createSecureRandomHex } from "../secureRandomId.util";

describe("secure random identifiers", () => {
  it("returns the requested number of cryptographically random hexadecimal bytes", () => {
    const values = Array.from({ length: 32 }, () => createSecureRandomHex(16));

    expect(values.every((value) => /^[0-9a-f]{32}$/.test(value))).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });
});
