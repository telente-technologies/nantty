import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { reportTargetTypeOptions } from "@/constants/trustOptions.constant";

describe("moderation report target filters", () => {
  it("exposes Space reports in the Admin queue filter", () => {
    assert.ok(reportTargetTypeOptions.some((option) => option.value === "SPACE"));
  });
});
