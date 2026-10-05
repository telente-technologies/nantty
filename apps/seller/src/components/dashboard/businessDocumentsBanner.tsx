"use client";

import { TrialReminderCallout } from "@/components/billing/trialStatusPanel";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { BillingOffer } from "@/types/billingOffer.type";
import type { BusinessDocumentsOverview, BusinessDocumentsResponse } from "@/types/businessDocuments.type";
import { presentBusinessDocuments } from "@/utils/businessDocuments.util";

const messageByStatus: Record<Exclude<BusinessDocumentsOverview["overallStatus"], "approved">, string> = {
  not_started: "Upload your CAC certificate, ID and proof of address to unlock the Gold checkmark. You can keep selling in the meantime.",
  in_review: "Thanks. We are reviewing your documents. You can keep selling in the meantime.",
  needs_attention: "One of your documents needs a new file. You can keep selling while you fix it.",
};

export function BusinessDocumentsBanner() {
  const { can } = useSellerSession();
  const documents = useSellerQuery<BusinessDocumentsResponse>(can("billing:manage") ? "/seller/business-documents" : null);
  const offer = useSellerQuery<BillingOffer>(can("billing:manage") ? "/seller/subscription/trial" : null);
  const overview = documents.data ? presentBusinessDocuments(documents.data, false) : null;
  return (
    <>
      {offer.data?.activeTrial ? <TrialReminderCallout trial={offer.data.activeTrial} onCancelled={offer.reload} /> : null}
      {overview && overview.overallStatus !== "approved" ? (
        <Callout tone={overview.overallStatus === "needs_attention" ? "caution" : "info"} title="Business documents" action={<ButtonLink size="small" href="/settings/business-documents">{overview.overallStatus === "in_review" ? "View status" : "Open documents"}</ButtonLink>}>
          {messageByStatus[overview.overallStatus]} The Gold checkmark comes with Pro or Business after approval.
        </Callout>
      ) : null}
    </>
  );
}
