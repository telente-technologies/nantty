import { describe, expect, it } from "@jest/globals";

import { ApiError } from "@/errors/api.error";
import { isCoinTransferFeeChanged, isDefinitiveCoinTransferRejection } from "./coinTransferRetry.util";

describe("coin transfer retry classification", () => {
  it("treats transport errors and server failures as uncertain outcomes", () => {
    expect(isDefinitiveCoinTransferRejection(new Error("request timed out"))).toBe(false);
    expect(isDefinitiveCoinTransferRejection(new ApiError(500, "internal error"))).toBe(false);
    expect(isDefinitiveCoinTransferRejection(new ApiError(504, "gateway timeout"))).toBe(false);
    expect(isDefinitiveCoinTransferRejection(new ApiError(408, "request timeout"))).toBe(false);
  });

  it("allows recovery after a known rejected request", () => {
    expect(isDefinitiveCoinTransferRejection(new ApiError(402, "insufficient balance"))).toBe(true);
    expect(isDefinitiveCoinTransferRejection(new ApiError(403, "transfer blocked"))).toBe(true);
    expect(isDefinitiveCoinTransferRejection(new ApiError(429, "rate limited"))).toBe(false);
  });

  it("treats a stale fee quote as a safe new-confirmation path", () => {
    const staleQuote = new ApiError(409, "quote changed", "COIN_TRANSFER_FEE_CHANGED");
    expect(isCoinTransferFeeChanged(staleQuote)).toBe(true);
    expect(isDefinitiveCoinTransferRejection(staleQuote)).toBe(false);
    expect(isCoinTransferFeeChanged(new ApiError(409, "other conflict"))).toBe(false);
  });
});
