"use client";

import { useState } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/formFields";
import { OverlayDialog } from "@/components/ui/overlayDialog";
import { useToast } from "@/components/ui/toastProvider";
import { campaignsApi } from "@/services/campaignsApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { Ad } from "@/types/campaign.type";

const minimumAppealLength = 20;
const maximumAppealLength = 1000;

export function AdAppealDialog({ ad, isOpen, onClose, onAppealed }: { readonly ad: Ad; readonly isOpen: boolean; readonly onClose: () => void; readonly onAppealed: (ad: Ad) => void }) {
  const { accountId } = useAdAccount();
  const { showToast } = useToast();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isSending, setIsSending] = useState(false);

  async function validateAndSendAppeal() {
    const trimmed = message.trim();
    if (trimmed.length < minimumAppealLength || trimmed.length > maximumAppealLength) {
      setError(`Explain in ${minimumAppealLength}–${maximumAppealLength} characters why the ad follows the policy.`);
      return;
    }
    setIsSending(true);
    try {
      const updated = await campaignsApi.appealRejectedAd(accountId, ad.id, trimmed);
      showToast("Appeal sent. A person will review the ad again.");
      onAppealed(updated);
      setMessage("");
      onClose();
    } catch (sendError) {
      setError(readErrorMessageForDisplay(sendError));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <OverlayDialog intent="dispute"
      isOpen={isOpen}
      onClose={onClose}
      title="Appeal this decision"
      description="You can appeal each rejection once. If the ad needs a change, edit it instead — edits are reviewed again automatically."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={isSending} onClick={validateAndSendAppeal}>
            Send appeal
          </Button>
        </>
      }
    >
      <TextAreaField
        label="Why does this ad follow the policy?"
        value={message}
        onValueChange={(value) => {
          setMessage(value);
          setError(undefined);
        }}
        maximumLength={maximumAppealLength}
        error={error}
        hint="Mention licences, proof of authenticity or context the reviewer may have missed."
        rows={6}
      />
    </OverlayDialog>
  );
}
