"use client";

import { useMemo, useState } from "react";

import { ModalDialog } from "@/components/ui/modalDialog";
import { createCountryRequiredRetry, type CountryRequiredRetry } from "@/utils/countryRequired.util";

import { CountryRequiredPicker, countryRequiredNote, countryRequiredTitle } from "./countryRequiredPicker";

export function CountryRequiredDialog({ isOpen, onClose, onSaved }: { readonly isOpen: boolean; readonly onClose: () => void; readonly onSaved: () => void }) {
  return (
    <ModalDialog isOpen={isOpen} onClose={onClose} title={countryRequiredTitle} description={countryRequiredNote}>
      <CountryRequiredPicker showHeading={false} onSaved={onSaved} />
    </ModalDialog>
  );
}

export function useCountryRequiredRetry(): { readonly retry: CountryRequiredRetry; readonly dialog: React.ReactNode } {
  const [isOpen, setOpen] = useState(false);
  const retry = useMemo(() => createCountryRequiredRetry(setOpen), []);
  return { retry, dialog: <CountryRequiredDialog isOpen={isOpen} onClose={retry.dismissed} onSaved={retry.saved} /> };
}
