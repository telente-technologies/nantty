"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { privacyService } from "@/services/privacy.service";

import { DeleteAccountDialog } from "./deleteAccountDialog";
import styles from "./settings.module.css";

const deletedItems = ["Your profile, bio and photos", "Your posts, clips, stories and comments", "Your saved addresses, payment methods and preferences"];
const anonymizedItems = ["Reviews and chat messages you sent stay visible without your name or photo", "Product interaction data is stripped of anything that identifies you"];
const retainedItems = ["Orders, payments, payouts and escrow records may be kept for as long as the law requires for tax, fraud and dispute purposes"];

function ExplanationList({ title, items }: { readonly title: string; readonly items: readonly string[] }) {
  return (
    <div>
      <h3 className={styles.subHeading}>{title}</h3>
      <ul className={styles.bulletList}>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

export function DeleteAccountSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const requestDeletion = useMutation({ mutationFn: () => privacyService.requestAccountDeletion(confirmation.trim()) });

  return (
    <section className={styles.block} aria-labelledby="delete-account-heading">
      <h2 id="delete-account-heading" className={styles.blockHeading}>Delete my account</h2>
      <p className={styles.muted}>Your account will be permanently deleted in 30 days. Log in any time before then to cancel. Here is what happens.</p>
      <ExplanationList title="What gets deleted" items={deletedItems} />
      <ExplanationList title="What gets anonymized" items={anonymizedItems} />
      <ExplanationList title="What we may keep" items={retainedItems} />
      {requestDeletion.data ? (
        <p role="status">Your account is scheduled for deletion on {new Date(requestDeletion.data.scheduledFor).toLocaleDateString()}.</p>
      ) : (
        <div><Button variant="danger" onClick={() => setIsOpen(true)}>Delete my account</Button></div>
      )}
      <DeleteAccountDialog isOpen={isOpen && !requestDeletion.data} onClose={() => setIsOpen(false)} confirmation={confirmation} onConfirmationChange={setConfirmation} deletion={{ isPending: requestDeletion.isPending, isSuccess: requestDeletion.isSuccess, errorMessage: requestDeletion.error?.message ?? null, confirm: () => requestDeletion.mutate() }} />
    </section>
  );
}
