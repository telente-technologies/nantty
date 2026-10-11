import { ApiError } from "@/errors/api.error";

import { describePaymentProblem } from "../paymentProblem.util";
import { checkoutEscrowNote, paidThroughLabel, paymentPartnerLine } from "../paymentCopy.util";

describe("payment problem dialogs", () => {
  it("titles each money error and keeps the remaining wallet amount", () => {
    const limit = describePaymentProblem(new ApiError(422, "x", "WALLET_DAILY_LIMIT", undefined, { remaining: { amountMinor: 1_500_000, currency: "NGN" } }));
    expect(limit?.title).toBe("Wallet limit reached");
    expect(limit?.message).toMatch(/15,000/);
    expect(describePaymentProblem(new ApiError(422, "x", "PAYMENT_AMOUNT_OUT_OF_RANGE"))?.title).toBe("Amount not allowed");
    expect(describePaymentProblem(new ApiError(403, "Verify", "VERIFICATION_REQUIRED"))?.title).toBe("Verification needed");
    expect(describePaymentProblem(new ApiError(403, "Owe", "SELLER_DEBT_LIMIT"))?.title).toBe("Selling paused");
    const buyerSide = describePaymentProblem(new ApiError(403, "x", "SELLER_DEBT_LIMIT", undefined, { audience: "buyer" }));
    expect(buyerSide?.title).toBe("This seller can't take new orders");
    expect(buyerSide?.message).toMatch(/This seller can't take new orders/);
    expect(describePaymentProblem(new ApiError(401, "Used", "STEP_UP_REUSED"))?.title).toBe("Confirm it's you again");
    expect(describePaymentProblem(new ApiError(409, "Not ready", "WALLET_NOT_READY"))?.title).toBe("Wallet not ready yet");
  });

  it("ignores errors it doesn't own", () => {
    expect(describePaymentProblem(new ApiError(422, "x", "COUNTRY_REQUIRED"))).toBeNull();
    expect(describePaymentProblem(new Error("boom"))).toBeNull();
  });

  it("names Flutterwave when it is the provider and stays neutral otherwise", () => {
    expect(paymentPartnerLine("flutterwave")).toMatch(/Flutterwave/);
    expect(paymentPartnerLine(null)).toBe("Pay by card or bank transfer.");
    expect(paidThroughLabel("flutterwave")).toBe("Flutterwave");
    expect(paidThroughLabel(undefined)).toBe("Card / bank transfer");
    expect(checkoutEscrowNote(true)).toMatch(/your own wallet/);
    expect(checkoutEscrowNote(false)).toMatch(/no escrow/);
  });
});
