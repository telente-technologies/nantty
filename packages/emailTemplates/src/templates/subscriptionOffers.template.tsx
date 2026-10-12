import type { EmailContext, Money } from "../emailTypes";
import { consentRules, defineEmailTemplate } from "./defineTemplate";

export interface SubscriptionOfferEmailProps {
  readonly planLabels: readonly string[];
  readonly percentOff?: number;
  readonly amountOff?: Money;
  readonly durationCycles: number;
  readonly expiresAt?: string;
  readonly note?: string;
  readonly claimUrl: string;
  readonly singleUse: boolean;
}

function joinPlanLabels(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? "a Zudomart plan";
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

export function subscriptionOfferHeadline(props: SubscriptionOfferEmailProps, context: EmailContext): string {
  const discount = props.amountOff === undefined ? `${props.percentOff ?? 0}% off` : `${context.money(props.amountOff)} off`;
  return `${discount} ${joinPlanLabels(props.planLabels)}`;
}

function durationText(cycles: number): string {
  return cycles <= 1 ? "Your first payment" : `Your first ${cycles} billing cycles`;
}

export const subscriptionOfferInvite = defineEmailTemplate<SubscriptionOfferEmailProps>({
  category: "payments", kind: "transactional", audience: "Person a staff member sent a subscription offer link to (may not have an account yet)", consent: consentRules.always,
  key: "subscriptionOfferInvite", name: "Subscription offer link", trigger: "subscriptionOffer.sent",
  subject: (p, c) => `Your Zudomart offer: ${subscriptionOfferHeadline(p, c)}`,
  preheader: (p, c) => (p.expiresAt ? `Claim it before ${c.date(p.expiresAt)}.` : "Claim it whenever you're ready."),
  blocks: (p, c) => [
    { type: "hero", eyebrow: "A Zudomart offer for you", title: subscriptionOfferHeadline(p, c) },
    ...(p.note ? [{ type: "quote" as const, author: "A note from the Zudomart team", text: p.note }] : []),
    {
      type: "details",
      rows: [
        { label: p.planLabels.length > 1 ? "Plans" : "Plan", value: joinPlanLabels(p.planLabels) },
        { label: "Discount applies to", value: durationText(p.durationCycles) },
        { label: "Offer ends", value: p.expiresAt ? c.dateTime(p.expiresAt) : "No end date" },
      ],
    },
    { type: "button", label: "Claim your offer", href: p.claimUrl },
    {
      type: "paragraph", muted: true,
      text: `Sign in or create a Zudomart account to claim it, then pay on the web. The offer can't be combined with other discounts; we always give you the better price.${p.singleUse ? " This link can be claimed once, so the first person to use it gets the offer." : ""}`,
    },
    { type: "paragraph", muted: true, text: "If you weren't expecting this, you can ignore this email." },
  ],
  sample: { planLabels: ["Pro plan"], percentOff: 30, durationCycles: 3, expiresAt: "2026-11-01T09:00:00.000Z", note: "Thanks for joining our seller pilot.\nThis is on us for the first three months.", claimUrl: "https://zudomart.com/offer/Xq3v0mZp9bT2nR8kL5wA7cD1eF4gH6jK0lM2nP4qR6s", singleUse: true },
});

