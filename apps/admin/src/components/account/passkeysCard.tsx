"use client";

import { useState } from "react";

import { requestConfirmation } from "@nantty/web-kit";

import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { Card } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay } from "@/services/adminApiClient.service";
import { fetchPasskeyCreationOptions, registerOwnPasskey, removeOwnPasskey } from "@/services/platformApi.service";
import { createPasskeyCredential, isPasskeySupportedInThisBrowser, type PasskeyCreationOptionsJson } from "@/services/webauthnCeremony.service";
import type { AdminPasskey } from "@/types/admin.type";
import { formatDateOnly } from "@/utils/formatting.util";

import styles from "./accountSecurity.module.css";

export function PasskeysCard({ passkeys, onChanged }: { readonly passkeys: readonly AdminPasskey[]; readonly onChanged: () => void }) {
  const { showToast } = useToast();
  const [label, setLabel] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function addPasskey() {
    setIsWorking(true);
    setErrorMessage(null);
    try {
      const options = await fetchPasskeyCreationOptions<PasskeyCreationOptionsJson>();
      const credential = await createPasskeyCredential(options);
      await registerOwnPasskey(label.trim() || "Passkey", credential);
      setLabel("");
      showToast("Passkey added. You can use it at sign-in and for sensitive actions.");
      onChanged();
    } catch (error) {
      setErrorMessage(error instanceof DOMException ? "The passkey prompt was closed or is not available on this device." : readErrorMessageForDisplay(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function removePasskey(passkey: AdminPasskey) {
    const removed = await requestConfirmation({
      title: `Remove "${passkey.label}"?`,
      description: "You won't be able to sign in with this passkey any more.",
      confirmLabel: "Remove passkey",
      tone: "danger",
      intent: "passkey",
      onConfirm: () => removeOwnPasskey(passkey.id),
      describeError: readErrorMessageForDisplay,
    });
    if (!removed) return;
    showToast("Passkey removed.");
    onChanged();
  }

  return (
    <Card title="Passkeys">
      <div className={styles.stack}>
        <p className={styles.muted}>Passkeys use your device's fingerprint, face or PIN. They resist phishing better than codes.</p>
        {passkeys.length === 0 ? <p>No passkeys yet.</p> : null}
        <ul className={styles.list}>
          {passkeys.map((passkey) => (
            <li key={passkey.id}>
              <span>
                <strong>{passkey.label}</strong>
                <span className={styles.muted}> · added {formatDateOnly(passkey.createdAt)}</span>
              </span>
              <Button size="small" variant="quietDanger" onClick={() => void removePasskey(passkey)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
        {isPasskeySupportedInThisBrowser() ? (
          <div className={styles.inlineForm}>
            <TextField label="Passkey name" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Work MacBook" maxLength={60} />
            <Button onClick={addPasskey} isBusy={isWorking} iconName="plus16">
              Add passkey
            </Button>
          </div>
        ) : (
          <p className={styles.muted}>This browser does not support passkeys.</p>
        )}
        {errorMessage ? <InlineError message={errorMessage} /> : null}
      </div>
    </Card>
  );
}
