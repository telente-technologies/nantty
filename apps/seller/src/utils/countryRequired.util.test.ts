import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCountryRequiredRetry, isCountryRequiredCode, resolveCountryChoice } from "./countryRequired.util";

describe("country required before paying", () => {
  it("only reacts to COUNTRY_REQUIRED", () => {
    assert.equal(isCountryRequiredCode("COUNTRY_REQUIRED"), true);
    assert.equal(isCountryRequiredCode("VERIFICATION_REQUIRED"), false);
    assert.equal(isCountryRequiredCode(undefined), false);
  });

  it("accepts a listed country or a valid two-letter code", () => {
    assert.equal(resolveCountryChoice("GH", ""), "GH");
    assert.equal(resolveCountryChoice("other", " us "), "US");
    assert.equal(resolveCountryChoice("other", "U"), null);
    assert.equal(resolveCountryChoice("other", "U1"), null);
  });

  it("opens the picker, then retries exactly once after the country is saved", () => {
    const states: boolean[] = [];
    let retries = 0;
    const retry = createCountryRequiredRetry((isOpen) => states.push(isOpen));
    assert.equal(retry.handle("INSUFFICIENT_FUNDS", () => retries++), false);
    assert.equal(retry.handle("COUNTRY_REQUIRED", () => retries++), true);
    retry.saved();
    retry.saved();
    assert.equal(retries, 1);
    assert.deepEqual(states, [true, false, false]);
  });

  it("does not retry when the buyer closes the picker", () => {
    let retries = 0;
    const retry = createCountryRequiredRetry(() => undefined);
    retry.handle("COUNTRY_REQUIRED", () => retries++);
    retry.dismissed();
    retry.saved();
    assert.equal(retries, 0);
  });
});
