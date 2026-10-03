"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MoneyField, ToggleSwitch } from "@/components/ui/formFields";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { ShippingProfile } from "@/types/shipping.type";
import { convertMajorInputToMinorUnits, convertMinorUnitsToMajorInputText } from "@/utils/money.util";

import styles from "./shipping.module.css";

export function ShippingThresholdPanel({ profile, canEdit, onSaved }: { readonly profile: ShippingProfile; readonly canEdit: boolean; readonly onSaved: () => void }) {
  const { showToast } = useToast();
  const [isEnabled, setIsEnabled] = useState(profile.freeShippingThreshold !== null);
  const [thresholdText, setThresholdText] = useState(profile.freeShippingThreshold ? convertMinorUnitsToMajorInputText(profile.freeShippingThreshold.amountMinor, profile.currency) : "");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  async function saveThreshold() {
    const thresholdMinor = isEnabled ? convertMajorInputToMinorUnits(thresholdText, profile.currency) : null;
    if (isEnabled && (thresholdMinor === null || thresholdMinor <= 0)) return setErrorMessage("Enter an order total above zero.");
    setErrorMessage(undefined);
    setIsSaving(true);
    try {
      await sendSellerApiRequest("/seller/shipping/profile", { method: "PATCH", body: { freeShippingThresholdMinor: thresholdMinor } });
      showToast("Free shipping threshold saved.");
      onSaved();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Panel title="Free shipping threshold" description="Orders at or above this total ship free to any destination you serve.">
      <div className={styles.stack}>
        <ToggleSwitch label="Offer free shipping above a total" checked={isEnabled} disabled={!canEdit} onCheckedChange={setIsEnabled} />
        {isEnabled ? <MoneyField label="Free shipping from" currency={profile.currency} valueText={thresholdText} onValueTextChange={setThresholdText} disabled={!canEdit} errorMessage={errorMessage} /> : null}
        {canEdit ? <div><Button variant="primary" isBusy={isSaving} onClick={() => void saveThreshold()}>Save threshold</Button></div> : null}
      </div>
    </Panel>
  );
}
