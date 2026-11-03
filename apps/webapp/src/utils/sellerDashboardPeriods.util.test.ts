import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SELLER_DASHBOARD_PERIODS } from "./sellerDashboardPeriods.util";

describe("seller dashboard period filters", () => {
  it("exposes all periods supported by the mobile dashboard and API", () => {
    assert.deepEqual(
      SELLER_DASHBOARD_PERIODS.map(({ key }) => key),
      ["live", "yesterday", "today", "week", "month", "all"],
    );
  });

  it("labels the live window clearly", () => {
    assert.equal(SELLER_DASHBOARD_PERIODS[0]?.label, "Live");
  });
});
