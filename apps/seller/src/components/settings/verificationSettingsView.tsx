"use client";

import { VerificationDocumentsList, type VerificationDetails } from "@/components/billing/verificationStatusView";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Callout, ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { KeyValueList, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";

export function VerificationSettingsView() {
  const { sessionView } = useSellerSession();
  const verificationQuery = useSellerQuery<VerificationDetails>("/seller/verification");
  const verification = sessionView?.access.verification;
  return (
    <>
      <Panel title="Gold badge">
        <KeyValueList
          items={[
            { label: "Verification", value: <StatusBadge tone={verification?.status === "verified" ? "success" : "caution"}>{verification?.status === "verified" ? "Verified" : verification?.status ?? "—"}</StatusBadge> },
            {
              label: "Badge on your store",
              value: verification?.badgeVisible ? (
                <StatusBadge tone="highlight">
                  <ZudoIcon name="sealCheck20" size={14} /> Gold {verification.tier === "PREMIUM" ? "Premium" : "Pro"}
                </StatusBadge>
              ) : (
                "Hidden"
              ),
            },
            { label: "Documents sent", value: formatDateForDisplay(verificationQuery.data?.submittedAt) },
          ]}
        />
      </Panel>
      <Panel title="Documents" description="Update documents from the Zudomart app under Profile › Store verification.">
        {verificationQuery.isLoading ? <LoadingBlock /> : verificationQuery.data ? <VerificationDocumentsList details={verificationQuery.data} /> : <ErrorCallout error={verificationQuery.error} message={verificationQuery.errorMessage} onRetry={verificationQuery.reload} />}
        {verificationQuery.data?.note ? <Callout tone="info" title="Note from Zudomart">{verificationQuery.data.note}</Callout> : null}
      </Panel>
    </>
  );
}
