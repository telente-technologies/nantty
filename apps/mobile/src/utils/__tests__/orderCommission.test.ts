import {
  mockOrderRecords,
  PLATFORM_FEE_PERCENT,
  sellerPayoutUsdCentsForOrderRecord,
  usdCentsForOrderRecord,
} from "@/mocks/orderFixtures.mock";
describe("zero sales commission", () => {
  it("keeps the full order amount in every seeded seller payout", () => {
    expect(PLATFORM_FEE_PERCENT).toBe(0);
    for (const record of mockOrderRecords)
      expect(sellerPayoutUsdCentsForOrderRecord(record)).toBe(
        usdCentsForOrderRecord(record),
      );
  });
});
