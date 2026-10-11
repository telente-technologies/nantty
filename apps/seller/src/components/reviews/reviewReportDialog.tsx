"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Review, ReviewReportReason } from "@/types/review.type";

const reportReasonLabels: Record<ReviewReportReason, string> = {
  spam: "Spam or advertising",
  offensive: "Abusive or offensive",
  fake: "Fake — this person did not buy",
  not_about_purchase: "Not about the product or order",
  personal_information: "Shares private information",
  other: "Something else",
};

export function ReviewReportDialog({ review, onClose, onReported }: { readonly review: Review; readonly onClose: () => void; readonly onReported: (review: Review) => void }) {
  const { showToast } = useToast();
  const [reason, setReason] = useState<ReviewReportReason>("spam");
  const [details, setDetails] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function sendReport() {
    if (reason === "other" && details.trim().length < 5) {
      setErrorMessage("Tell us what is wrong (at least 5 characters).");
      return;
    }
    setIsSending(true);
    try {
      const updated = await sendSellerApiRequest<Review>(`/seller/reviews/${encodeURIComponent(review.id)}/report`, { method: "POST", body: { reason, details: details.trim() } });
      showToast("Thanks. Zudomart will review it within 2 working days. The review stays up until then.");
      onReported(updated);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <ModalDialog intent="report"
      isOpen
      onClose={onClose}
      width="small"
      title="Report this review"
      description={`From @${review.author.username}. Reports go to Zudomart's trust team — the buyer is not told who reported.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" isBusy={isSending} onClick={() => void sendReport()}>Send report</Button>
        </>
      }
    >
      <SelectField label="Reason" value={reason} onChange={(event) => setReason(event.target.value as ReviewReportReason)} options={(Object.keys(reportReasonLabels) as ReviewReportReason[]).map((value) => ({ value, label: reportReasonLabels[value] }))} />
      <TextAreaField label={reason === "other" ? "What is wrong?" : "Details (optional)"} rows={3} maxLength={500} value={details} onChange={(event) => setDetails(event.target.value)} errorMessage={errorMessage ?? undefined} />
    </ModalDialog>
  );
}
