import type { OfferDiscount, OfferLink, OfferLinkStatus } from "@/types/subscriptionOffers.type";
import { formatMoneyForDisplay } from "@/utils/formatting.util";

export const offerPlanOptions: readonly { readonly value: string; readonly label: string }[] = [
  { value: "blue_essential", label: "Blue Essential" },
  { value: "blue", label: "Blue Verified" },
  { value: "premium", label: "Blue Premium" },
  { value: "seller_pro", label: "Gold Pro" },
  { value: "seller_business", label: "Gold Business" },
  { value: "gold_only", label: "Gold only" },
];

export const offerStatusLabels: Readonly<Record<OfferLinkStatus, string>> = { active: "Active", expired: "Expired", revoked: "Revoked", fully_claimed: "Fully claimed" };

export function readOfferPlanLabel(planCode: string): string {
  return offerPlanOptions.find((option) => option.value === planCode)?.label ?? planCode;
}

export function describeOfferDiscount(discount: OfferDiscount): string {
  return discount.kind === "fixed_amount" && discount.amountOff ? `${formatMoneyForDisplay(discount.amountOff)} off` : `${discount.percentOff ?? 0}% off`;
}

export function describeOfferHeadline(link: Pick<OfferLink, "discount" | "plans">): string {
  return `${describeOfferDiscount(link.discount)} ${link.plans.map((plan) => readOfferPlanLabel(plan.planCode)).join(" or ")}`;
}

export function describeOfferDuration(cycles: number): string {
  return cycles <= 1 ? "First payment" : `${cycles} billing cycles`;
}

export function describeOfferUses(link: Pick<OfferLink, "claimedCount" | "redeemedCount" | "maxClaims" | "singleUse">): string {
  return `${link.redeemedCount} paid · ${link.claimedCount} / ${link.maxClaims}${link.singleUse ? " (single use)" : ""}`;
}

export function splitRecipientEmails(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map((entry) => entry.trim().toLowerCase()).filter(Boolean))];
}

export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/.test(email) && email.length <= 254;
}
