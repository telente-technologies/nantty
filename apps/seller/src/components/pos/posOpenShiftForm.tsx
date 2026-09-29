"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { MoneyField } from "@/components/ui/formFields";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { PosShift } from "@/types/pos.type";
import type { CurrencyCode } from "@/types/money.type";
import { convertMajorInputToMinorUnits } from "@/utils/money.util";

import styles from "./posDialogs.module.css";

export function PosOpenShiftForm({ registerId, currency, onShiftOpened }: { readonly registerId: string; readonly currency: CurrencyCode; readonly onShiftOpened: (shift: PosShift) => void }) {
  const { settings } = useStoreContext();
  const [floatText, setFloatText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);

  async function openShiftWithFloat() {
    const openingFloatMinor = floatText.trim() === "" ? 0 : convertMajorInputToMinorUnits(floatText, currency);
    if (openingFloatMinor === null || openingFloatMinor < 0) {
      setErrorMessage("Enter the cash in the drawer as a number, or 0.");
      return;
    }
    setIsOpening(true);
    setErrorMessage(null);
    try {
      onShiftOpened(await sendSellerApiRequest<PosShift>("/seller/pos/shifts", { method: "POST", body: { registerId, openingFloatMinor } }));
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <form className={styles.formStack} onSubmit={(event) => { event.preventDefault(); void openShiftWithFloat(); }}>
      {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
      <MoneyField label="Cash in the drawer (float)" currency={currency} currencySymbol={settings?.currency ?? currency} valueText={floatText} onValueTextChange={setFloatText} hint="Count the notes and coins before your first sale." autoFocus />
      <Button type="submit" variant="primary" size="large" isBusy={isOpening}>Open shift</Button>
    </form>
  );
}
