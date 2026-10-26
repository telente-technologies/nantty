import type { OfferPreview, OfferState } from "@/types/subscriptionOffer.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export function describeOfferDiscount(discount: OfferPreview["discount"]): string {
  return discount.kind === "fixed_amount" && discount.amountOff ? `${formatMoneyForDisplay(discount.amountOff, { showDecimals: false })} off` : `${discount.percentOff ?? 0}% off`;
}

export function describeOfferHeadline(offer: Pick<OfferPreview, "discount" | "plans">): string {
  return `${describeOfferDiscount(offer.discount)} ${offer.plans.map((plan) => plan.planLabel).join(" or ")}`;
}

export function describeOfferDuration(cycles: number): string {
  return cycles <= 1 ? "Your first payment" : `Your first ${cycles} billing cycles`;
}

export function describeBlockedOffer(offer: OfferPreview): { readonly title: string; readonly text: string } | null {
  const blocked: Partial<Record<OfferState, { readonly title: string; readonly text: string }>> = {
    expired: { title: "This offer has expired", text: "The link is past its end date, so the discount can't be claimed any more." },
    revoked: { title: "This offer is no longer available", text: "Nantty withdrew this offer. Any discount you already started keeps going as promised." },
    fully_claimed: { title: "This offer has already been claimed", text: offer.singleUse ? "This link could be claimed once, and someone else got there first." : "Every place on this offer has been taken." },
    claimed_by_you: { title: "You've already used this offer", text: "The discount is on your subscription. You can manage it in your settings." },
    not_for_profile: { title: "This offer isn't for this profile", text: `It applies to ${offer.plans.map((plan) => plan.planLabel).join(" or ")}, which this profile can't buy. Switch to a profile that can use it and open the link again.` },
    wrong_currency: {
      title: "This offer is in a different currency",
      text: offer.discount.amountOff ? `The ${formatMoneyForDisplay(offer.discount.amountOff, { showDecimals: false })} discount only works when you're charged in ${offer.discount.amountOff.currency}, and you'd be charged in another currency.` : "The discount can't be used with the currency you'd be charged in.",
    },
  };
  return blocked[offer.state] ?? null;
}

export function readOfferTokenFromPath(token: string): string | null {
  return /^[A-Za-z0-9_-]{8,64}$/.test(token) ? token : null;
}
