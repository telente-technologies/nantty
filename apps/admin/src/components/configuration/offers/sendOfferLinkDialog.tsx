"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineError, NoticeBanner } from "@/components/ui/feedback";
import { TextAreaField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { sendOfferLink } from "@/services/subscriptionOffersApi.service";
import type { OfferLink, OfferLinkSend } from "@/types/subscriptionOffers.type";
import { describeOfferHeadline, isPlausibleEmail, splitRecipientEmails } from "@/utils/offerLinkFormat.util";

import styles from "./subscriptionOffers.module.css";

const maximumRecipients = 20;
const maximumNoteLength = 500;

export function SendOfferLinkDialog({ link, onClose, onSent }: { readonly link: OfferLink; readonly onClose: () => void; readonly onSent: (sends: readonly OfferLinkSend[]) => void }) {
  const [recipientsText, setRecipientsText] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const { showToast } = useToast();
  const send = useAdminMutation((input: { readonly recipientEmails: readonly string[]; readonly note: string; readonly reason: string }) =>
    sendOfferLink(link.id, { recipientEmails: input.recipientEmails, note: input.note }, input.reason));
  const recipients = splitRecipientEmails(recipientsText);
  const invalid = recipients.filter((email) => !isPlausibleEmail(email));
  const recipientProblem = invalid.length > 0 ? `Check these addresses: ${invalid.slice(0, 3).join(", ")}` : recipients.length > maximumRecipients ? `Send to at most ${maximumRecipients} people at a time.` : null;
  const canSend = recipients.length > 0 && recipientProblem === null && note.length <= maximumNoteLength && reason.trim().length >= 5;
  const submit = async () => {
    const result = await send.run({ recipientEmails: recipients, note: note.trim(), reason });
    if (!result) return;
    showToast(result.data.length === 1 ? "Offer email sent." : `Offer emailed to ${result.data.length} people.`);
    onSent(result.data);
  };
  return (
    <ModalDialog
      isOpen
      width="medium"
      title="Email this offer"
      description={`Recipients get a branded email for "${describeOfferHeadline(link)}" with one button to claim it. They don't need an account yet.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" isBusy={send.isRunning} disabled={!canSend} onClick={() => void submit()}>Send email</Button>
        </>
      }
    >
      <div className={styles.form}>
        <TextAreaField label="Recipient emails" hint="Separate addresses with commas or new lines." value={recipientsText} rows={3} onChange={(event) => setRecipientsText(event.target.value)} error={recipientProblem} />
        {link.singleUse && recipients.length > 1 ? (
          <NoticeBanner tone="caution" title="This link is single use">
            Only the first person to claim it gets the offer. Everyone else will see that it has already been claimed.
          </NoticeBanner>
        ) : null}
        <TextAreaField
          label="Personal note (optional)"
          hint={`${note.length} / ${maximumNoteLength}. Plain text; it appears quoted in the email.`}
          value={note}
          rows={4}
          maxLength={maximumNoteLength}
          onChange={(event) => setNote(event.target.value)}
        />
        <TextAreaField label="Reason (saved to the audit log)" value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} />
        {send.errorMessage ? <InlineError message={send.errorMessage} /> : null}
      </div>
    </ModalDialog>
  );
}
