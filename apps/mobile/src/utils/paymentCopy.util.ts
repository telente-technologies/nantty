export const ESCROW_NOTE_NIGERIA = "Your payment stays locked in your own wallet, held by our licensed payment partner, until you confirm delivery.";
export const ESCROW_NOTE_ELSEWHERE = "Outside Nigeria there's no escrow: you pay the seller directly, and our dispute process still applies.";
export const SECURE_PAYMENT_WINDOW = "secure payment window";
export const PAYMENT_PROCESSING_FEE_LABEL = "Payment processing fee";

export function checkoutEscrowNote(isNigeria: boolean | null): string {
  if (isNigeria === false) return ESCROW_NOTE_ELSEWHERE;
  return `${ESCROW_NOTE_NIGERIA} Direct orders from verified stores pay the seller right away.`;
}

export function paymentPartnerLine(provider: string | null | undefined): string {
  return provider === "flutterwave" ? "Payments are processed by Flutterwave." : "Pay by card or bank transfer.";
}

export function paidThroughLabel(provider: string | null | undefined): string {
  return provider === "flutterwave" ? "Flutterwave" : "Card / bank transfer";
}

export const OUTSIDE_NIGERIA_NOTE = "Outside Nigeria you pay at checkout by card or mobile money, directly to the seller. Nantty doesn't keep a balance for you.";
