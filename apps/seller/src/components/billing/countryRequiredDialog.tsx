"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { readErrorMessageForDisplay, sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import { countryChoices, createCountryRequiredRetry, isCountryRequiredCode, resolveCountryChoice, type CountryRequiredRetry } from "@/utils/countryRequired.util";

export function isCountryRequiredError(error: unknown): boolean {
  return error instanceof SellerApiRequestError && isCountryRequiredCode(error.code);
}

export function CountryRequiredDialog({ isOpen, onClose, onSaved }: { readonly isOpen: boolean; readonly onClose: () => void; readonly onSaved: () => void }) {
  const [choice, setChoice] = useState<string>("NG");
  const [otherCode, setOtherCode] = useState("");
  const [isSaving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const countryCode = resolveCountryChoice(choice, otherCode);

  async function save() {
    if (countryCode === null) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      await sendSellerApiRequest<void>("/users/me/preferences", { method: "PATCH", body: { countryCode } });
      onSaved();
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Where do you live?"
      description="We charge you in your country's currency. You only need to tell us once; you can change it later in settings."
      isBusy={isSaving}
      errorMessage={errorMessage}
      footer={
        <>
          <Button onClick={onClose}>Not now</Button>
          <Button variant="primary" onClick={() => void save()} disabled={countryCode === null} isBusy={isSaving}>Save and continue</Button>
        </>
      }
    >
      <SelectField label="Your country" value={choice} onChange={(event) => setChoice(event.target.value)} options={countryChoices.map((option) => ({ value: option.code, label: option.label }))} />
      {choice === "other" ? (
        <TextField label="Two-letter country code" hint="For example US or GB" value={otherCode} maxLength={2} autoCapitalize="characters" onChange={(event) => setOtherCode(event.target.value)} />
      ) : null}
    </ModalDialog>
  );
}

export function useCountryRequiredRetry(): { readonly retry: CountryRequiredRetry; readonly dialog: ReactNode } {
  const [isOpen, setOpen] = useState(false);
  const retry = useMemo(() => createCountryRequiredRetry(setOpen), []);
  return { retry, dialog: <CountryRequiredDialog isOpen={isOpen} onClose={retry.dismissed} onSaved={retry.saved} /> };
}
