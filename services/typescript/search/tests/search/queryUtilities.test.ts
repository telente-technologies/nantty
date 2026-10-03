import { describe, expect, it } from "vitest";

import { clampPageSize, decodeSearchCursor, encodeSearchCursor } from "../../src/utils/cursor.util.js";
import { buildPrefixTsQuery, escapeLikePattern, extractQueryTokens, normalizeHashtag, normalizeSearchText } from "../../src/utils/queryNormalizer.util.js";

describe("query normalisation", () => {
  it("strips accents, case and punctuation", () => {
    expect(normalizeSearchText("  Café  Ñandú!! ")).toBe("cafe nandu");
  });

  it("builds a prefix tsquery from the last token and drops injection characters", () => {
    expect(buildPrefixTsQuery(extractQueryTokens("red snea'kers | & !"))).toBe("red & sneakers:*");
    expect(extractQueryTokens("")).toEqual([]);
  });

  it("escapes LIKE wildcards and normalises hashtags", () => {
    expect(escapeLikePattern("50%_off")).toBe("50\\%\\_off");
    expect(normalizeHashtag("#Lagos Life")).toBe("lagoslife");
  });
});

describe("cursor", () => {
  it("round-trips and rejects garbage", () => {
    expect(decodeSearchCursor(encodeSearchCursor({ score: 2.5, key: "product:a" }))).toEqual({ score: 2.5, key: "product:a" });
    expect(decodeSearchCursor("###")).toBeUndefined();
    expect(decodeSearchCursor(Buffer.from('{"s":"x","k":1}').toString("base64url"))).toBeUndefined();
  });

  it("clamps page sizes", () => {
    expect([clampPageSize(undefined), clampPageSize(0), clampPageSize(500), clampPageSize(7)]).toEqual([20, 1, 50, 7]);
  });
});
