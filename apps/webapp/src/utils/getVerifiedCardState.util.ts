import type { VerificationProfileType } from "@/types/models.type";
import type { MyVerification, VerificationDiscounts, VerificationOfferDiscount } from "@/types/verification.type";

export type GetVerifiedCheckmarkColor = "blue" | "gold";

export type GetVerifiedCardState =
  | { readonly kind: "hidden" }
  | { readonly kind: "offer"; readonly color: GetVerifiedCheckmarkColor }
  | { readonly kind: "pending"; readonly color: GetVerifiedCheckmarkColor }
  | { readonly kind: "rejected"; readonly color: GetVerifiedCheckmarkColor; readonly reason: string | null };

export interface GetVerifiedCardStateInput {
  readonly profileType: VerificationProfileType;
  readonly myVerification: MyVerification | null | undefined;
  readonly dismissedOnServer: boolean;
}

export const checkmarkColorForProfileType = (profileType: VerificationProfileType): GetVerifiedCheckmarkColor | null =>
  profileType === "personal" ? "blue" : profileType === "business" ? "gold" : null;

export function resolveGetVerifiedCardState({ profileType, myVerification, dismissedOnServer }: GetVerifiedCardStateInput): GetVerifiedCardState {
  const color = checkmarkColorForProfileType(profileType);
  if (color === null || !myVerification) return { kind: "hidden" };
  const current = myVerification.current;
  if (current?.status === "active") return { kind: "hidden" };
  if (current?.status === "pending" || myVerification.application?.status === "pending") return { kind: "pending", color };
  if (myVerification.application?.status === "rejected") return { kind: "rejected", color, reason: myVerification.application.rejectionReason };
  if (dismissedOnServer) return { kind: "hidden" };
  return { kind: "offer", color };
}

export type GetVerifiedDiscountHighlight =
  | { readonly kind: "offerLink"; readonly offer: VerificationOfferDiscount }
  | { readonly kind: "bundle"; readonly percentOff: number }
  | { readonly kind: "yearly"; readonly percentOff: number };

const checkmarkPlanCodesByColor: Readonly<Record<GetVerifiedCheckmarkColor, readonly string[]>> = { blue: ["blue", "premium"], gold: ["gold_only", "seller_pro", "seller_business"] };

const offerFitsColor = (offer: VerificationOfferDiscount, color: GetVerifiedCheckmarkColor) => offer.plans.some((plan) => checkmarkPlanCodesByColor[color].includes(plan.planCode));

export function pickGetVerifiedDiscountHighlight(discounts: VerificationDiscounts | null | undefined, color: GetVerifiedCheckmarkColor): GetVerifiedDiscountHighlight | null {
  if (!discounts) return null;
  const offer = discounts.offers.find((candidate) => offerFitsColor(candidate, color));
  if (offer) return { kind: "offerLink", offer };
  if (color === "gold" && discounts.bundle && discounts.bundle.percentOff > 0) return { kind: "bundle", percentOff: discounts.bundle.percentOff };
  if (discounts.yearlyPercentOff > 0) return { kind: "yearly", percentOff: discounts.yearlyPercentOff };
  return null;
}

export function describeGetVerifiedDiscount(highlight: GetVerifiedDiscountHighlight, formatAmount: (amountMinor: number, currency: string) => string): string {
  if (highlight.kind === "bundle") return `Your Blue + Gold bundle takes ${highlight.percentOff}% off Gold.`;
  if (highlight.kind === "yearly") return `Save ${highlight.percentOff}% when you pay yearly.`;
  const { discount } = highlight.offer;
  const amount = discount.kind === "fixed_amount" && discount.amountOff ? formatAmount(discount.amountOff.amountMinor, discount.amountOff.currency) : `${discount.percentOff ?? 0}%`;
  return `You have an offer: ${amount} off, sent to your email.`;
}
