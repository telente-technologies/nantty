export const PaymentStatus = {
  PENDING: "pending",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  REFUNDED: "refunded",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentProvider = { PAYSTACK: "paystack", FLUTTERWAVE: "flutterwave" } as const;
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];
