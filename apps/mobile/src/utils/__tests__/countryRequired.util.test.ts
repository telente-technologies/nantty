import { createCountryRequiredRetry, isCountryRequiredCode, resolveCountryChoice } from "../countryRequired.util";

describe("country required before paying", () => {
  it("only reacts to COUNTRY_REQUIRED", () => {
    expect(isCountryRequiredCode("COUNTRY_REQUIRED")).toBe(true);
    expect(isCountryRequiredCode("FREE_BOOST_USED")).toBe(false);
    expect(isCountryRequiredCode(undefined)).toBe(false);
  });

  it("accepts a listed country or a valid two-letter code", () => {
    expect(resolveCountryChoice("KE", "")).toBe("KE");
    expect(resolveCountryChoice("other", " gb ")).toBe("GB");
    expect(resolveCountryChoice("other", "G")).toBeNull();
  });

  it("retries exactly once after the country is saved, and never after a dismiss", () => {
    const states: boolean[] = [];
    let retries = 0;
    const retry = createCountryRequiredRetry((isOpen) => states.push(isOpen));
    expect(retry.handle("COUNTRY_REQUIRED", () => retries++)).toBe(true);
    retry.saved();
    retry.saved();
    expect(retries).toBe(1);
    retry.handle("COUNTRY_REQUIRED", () => retries++);
    retry.dismissed();
    retry.saved();
    expect(retries).toBe(1);
    expect(states).toEqual([true, false, false, true, false, false]);
  });
});
