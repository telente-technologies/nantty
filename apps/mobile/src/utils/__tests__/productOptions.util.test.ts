import { addOptionValues, countVariantCombinations, createOptionGroupDraft, moveOptionValue, splitPastedOptionValues, utf8ByteLength } from "../productOptions.util";

describe("product option chips", () => {
  it("adds trimmed values and rejects empty and case-insensitive duplicates", () => {
    expect(addOptionValues([], "  S ")).toEqual({ values: ["S"], added: ["S"], error: null });
    expect(addOptionValues(["S"], " s ")).toEqual({ values: ["S"], added: [], error: "“s” is already added." });
    expect(addOptionValues(["S"], "   ").error).toBe("Type a value first.");
    expect(addOptionValues(["S"], " , ,").added).toEqual([]);
  });

  it("splits pasted lists into chips and reports skipped duplicates", () => {
    expect(splitPastedOptionValues("S, M,\nL; XL,,")).toEqual(["S", "M", "L", "XL"]);
    expect(addOptionValues(["M"], "S, M, L, l")).toEqual({ values: ["M", "S", "L"], added: ["S", "L"], error: "“M” is already added." });
  });

  it("caps values per option at catalog's 30 and value length at 40 bytes, counting emoji as bytes", () => {
    const long = Array.from({ length: 40 }, (_, index) => `Size ${index + 1}`).join(", ");
    const result = addOptionValues([], long);
    expect(result.values).toHaveLength(30);
    expect(result.error).toMatch(/up to 30 values\. 10 were left out/);
    expect(utf8ByteLength("👍🏽")).toBe(8);
    expect(addOptionValues([], "🔥 Hot").added).toEqual(["🔥 Hot"]);
    expect(addOptionValues([], "🔥".repeat(11)).error).toMatch(/too long/);
    expect(addOptionValues([], "a".repeat(40)).added).toHaveLength(1);
    expect(addOptionValues([], "a".repeat(41)).added).toHaveLength(0);
  });

  it("reorders values without losing any", () => {
    expect(moveOptionValue(["S", "M", "L"], 2, 0)).toEqual(["L", "S", "M"]);
    expect(moveOptionValue(["S", "M"], 1, 5)).toEqual(["S", "M"]);
  });

  it("counts variant combinations from named groups with values only", () => {
    expect(countVariantCombinations([createOptionGroupDraft("Size", ["S", "M"]), createOptionGroupDraft("Colour", ["Red", "Blue", "Green"]), createOptionGroupDraft("", ["x"]), createOptionGroupDraft("Fit")])).toBe(6);
  });
});
