import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { reportTargetTypeOptions } from "@/constants/trustOptions.constant";

describe("moderation report target filters", () => {
  it("exposes Space, account, product, store and sound reports in the Admin queue filter", () => {
    for (const targetType of ["SPACE", "USER", "PRODUCT", "STORE", "SOUND"]) {
      assert.ok(reportTargetTypeOptions.some((option) => option.value === targetType), `${targetType} report filter is available`);
    }
  });
});
