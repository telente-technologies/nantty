import { Callout } from "@/components/ui/feedback";
import type { BillingOffer } from "@/types/billingOffer.type";
import { formatMoneyForDisplay } from "@/utils/money.util";

export function TrialOfferNotice({ offer }: { readonly offer: BillingOffer }) {
  if (!offer.isEligible) {
    return offer.ineligibleReasons.length > 0 && !offer.activeTrial ? (
      <Callout tone="info" title="A free trial is not available right now">
        <ul>{offer.ineligibleReasons.map((reason) => <li key={reason.code}>{reason.message}</li>)}</ul>
      </Callout>
    ) : null;
  }
  return (
    <Callout tone="success" title={`Try Pro or Business free for ${offer.trialDays === 7 ? "7 days" : "1 month"}`}>
      You save a card on our payment partner&apos;s secure page. {formatMoneyForDisplay(offer.verificationCharge)} charged to verify your card — refunded immediately. You are only charged when the trial ends, and we remind you 3 days and 1 day before. Receipts and reminders go to your account email, {offer.accountEmail}, which you can change in Account settings.
    </Callout>
  );
}
