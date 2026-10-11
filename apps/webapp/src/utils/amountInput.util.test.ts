import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseMajorAmountToMinorUnits } from "./amountInput.util";

describe("withdrawal amount input", () => {
  it("reads grouped thousands as the full amount, not the first group", () => {
    assert.equal(parseMajorAmountToMinorUnits("1,000"), 100_000);
    assert.equal(parseMajorAmountToMinorUnits("50,000.50"), 5_000_050);
    assert.equal(parseMajorAmountToMinorUnits(" 2500.5 "), 250_050);
    assert.equal(parseMajorAmountToMinorUnits("0.29"), 29);
  });

  it("refuses text that parseFloat would silently shorten or reinterpret", () => {
    for (const text of ["", "12abc", "1e5", "-100", "1,00", "1.234", "Infinity", "0x10", "1 000", "99999999999999999999"]) {
      assert.equal(parseMajorAmountToMinorUnits(text), null, text);
    }
  });
});
