import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateAppStoreFees } from "@/mocks/handlers/configuration/appStoreFeesValidation.mock";

const fees = (overrides: Record<string, unknown> = {}) => ({ appleFeeBps: 3_000, appleSmallBusinessProgram: true, appleSmallBusinessFeeBps: 1_500, googleSubscriptionFeeBps: 1_500, ...overrides });

describe("appStore.fees setting", () => {
  it("accepts the Go defaults", () => {
    assert.equal(validateAppStoreFees(fees()).appleSmallBusinessProgram, true);
  });

  it("refuses fees above 50%, negative fees and unknown keys like the Go validator", () => {
    assert.throws(() => validateAppStoreFees(fees({ appleFeeBps: 6_000 })));
    assert.throws(() => validateAppStoreFees(fees({ googleSubscriptionFeeBps: -1 })));
    assert.throws(() => validateAppStoreFees(fees({ unknown: 1 })));
    assert.throws(() => validateAppStoreFees(fees({ appleSmallBusinessProgram: "yes" })));
  });
});
