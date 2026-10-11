import assert from "node:assert/strict";
import { test } from "node:test";

import { addOptionValues, countOptionCombinations, describeOptionGroupProblem, measureUtf8Bytes, moveOptionValue, splitPastedOptionValues } from "../components/catalog/productOptions.util";

const group = (name: string, values: string[], pendingText = "") => ({ key: name || "blank", name, values, pendingText });

test("adds trimmed chips and rejects empty and case-insensitive duplicates", () => {
  assert.deepEqual(addOptionValues([], "  S "), { values: ["S"], added: ["S"], error: null });
  assert.deepEqual(addOptionValues(["S"], " s "), { values: ["S"], added: [], error: "“s” is already added." });
  assert.equal(addOptionValues(["S"], "  ").error, "Type a value first.");
});

test("splits pasted lists, including tabs from spreadsheets", () => {
  assert.deepEqual(splitPastedOptionValues("S, M\nL\tXL;;"), ["S", "M", "L", "XL"]);
  assert.deepEqual(addOptionValues(["M"], "S, M, L").added, ["S", "L"]);
});

test("caps a long pasted list at 30 values and long values at 40 bytes", () => {
  const result = addOptionValues([], Array.from({ length: 45 }, (_, index) => `V${index}`).join(","));
  assert.equal(result.values.length, 30);
  assert.match(result.error ?? "", /15 were left out/);
  assert.equal(measureUtf8Bytes("🔥"), 4);
  assert.match(addOptionValues([], "🔥".repeat(11)).error ?? "", /too long/);
  assert.deepEqual(addOptionValues([], "🔥🔥 Hot").added, ["🔥🔥 Hot"]);
});

test("reorders and validates option groups", () => {
  assert.deepEqual(moveOptionValue(["S", "M", "L"], 0, 2), ["M", "L", "S"]);
  assert.equal(describeOptionGroupProblem(group("Size", ["S"]), [group("Size", ["S"]), { ...group("size", ["M"]), key: "other" }]), "You already have an option called Size.");
  assert.match(describeOptionGroupProblem(group("", ["S"]), []) ?? "", /name/);
  assert.equal(describeOptionGroupProblem(group("", []), []), null);
  assert.equal(countOptionCombinations([group("Size", ["S", "M"]), group("Colour", ["Red", "Blue", "Green"]), group("Fit", [])]), 6);
});
