import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mockOrderRecords,
  PLATFORM_FEE_PERCENT,
  sellerPayoutUsdCentsForOrderRecord,
  usdCentsForOrderRecord,
} from "@/mocks/orderFixtures.mock";
describe("zero sales commission", () => {
  it("keeps the full order amount in every seeded seller payout", () => {
    assert.equal(PLATFORM_FEE_PERCENT, 0);
    for (const record of mockOrderRecords)
      assert.equal(
        sellerPayoutUsdCentsForOrderRecord(record),
        usdCentsForOrderRecord(record),
      );
  });
});
