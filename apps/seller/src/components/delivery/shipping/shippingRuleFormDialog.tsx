"use client";

import { useMemo, useState } from "react";

import { ShippingDestinationTree } from "@/components/delivery/shipping/shippingDestinationTree";
import { Button } from "@/components/ui/button";
import { MoneyField, SelectField, TextField, ToggleSwitch } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import type { CurrencyCode } from "@/types/money.type";
import type { ShippingRule, ShippingRuleInput, ShippingZone } from "@/types/shipping.type";
import { convertMajorInputToMinorUnits, convertMinorUnitsToMajorInputText } from "@/utils/money.util";
import { compressLeafKeysToDestinations, expandDestinationsToLeafKeys } from "@/utils/shippingDestinationSelection.util";

import styles from "./shipping.module.css";

export interface ShippingRuleWithZone {
  readonly rule: ShippingRule;
  readonly zone: ShippingZone;
}

export function ShippingRuleFormDialog({ existing, currency, onClose, onSaved }: { readonly existing: ShippingRuleWithZone | null; readonly currency: CurrencyCode; readonly onClose: () => void; readonly onSaved: () => void }) {
  const { showToast } = useToast();
  const [zoneName, setZoneName] = useState(existing?.zone.name ?? "");
  const [type, setType] = useState<ShippingRule["type"]>(existing?.rule.type ?? "flat_fee");
  const [feeText, setFeeText] = useState(existing ? convertMinorUnitsToMajorInputText(existing.rule.fee.amountMinor, currency) : "");
  const [active, setActive] = useState(existing?.rule.active ?? true);
  const [selectedLeafKeys, setSelectedLeafKeys] = useState(() => expandDestinationsToLeafKeys(existing?.zone.destinations ?? []));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const destinations = useMemo(() => compressLeafKeysToDestinations(selectedLeafKeys), [selectedLeafKeys]);

  async function saveShippingRule() {
    const feeMinor = type === "free" ? 0 : convertMajorInputToMinorUnits(feeText || "0", currency);
    const body: ShippingRuleInput = { zoneName: zoneName.trim(), destinations, type, feeMinor: feeMinor ?? -1, active };
    setIsSaving(true);
    setFieldErrors({});
    try {
      await sendSellerApiRequest(existing ? `/seller/shipping/rules/${encodeURIComponent(existing.rule.id)}` : "/seller/shipping/rules", { method: existing ? "PATCH" : "POST", body });
      showToast(existing ? `Saved ${body.zoneName}.` : `Added ${body.zoneName}.`);
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues) setFieldErrors(Object.fromEntries(error.issues.map((issue) => [issue.path, issue.message])));
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalDialog intent="delivery"
      isOpen
      onClose={onClose}
      width="large"
      title={existing ? `Edit ${existing.zone.name}` : "Add a shipping rule"}
      description="One price for the whole order group going to these destinations, never per item. The most specific destination wins: local government area, then state, then country."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" isBusy={isSaving} onClick={() => void saveShippingRule()}>
            Save rule
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        <TextField label="Destination group name" placeholder="South West" value={zoneName} maxLength={60} onChange={(event) => setZoneName(event.target.value)} errorMessage={fieldErrors.zoneName} />
        <div className={styles.twoColumns}>
          <SelectField label="Rule" value={type} options={[{ value: "flat_fee", label: "Flat fee per order" }, { value: "free", label: "Free shipping" }]} onChange={(event) => setType(event.target.value as ShippingRule["type"])} />
          {type === "flat_fee" ? <MoneyField label="Fee per order" currency={currency} valueText={feeText} onValueTextChange={setFeeText} errorMessage={fieldErrors.feeMinor} /> : null}
        </div>
        <div>
          <ShippingDestinationTree selectedLeafKeys={selectedLeafKeys} onChange={setSelectedLeafKeys} />
          {fieldErrors.destinations ? <p className={styles.fieldError} role="alert">{fieldErrors.destinations}</p> : null}
        </div>
        <ToggleSwitch label="Rule is active" description="Turn off to stop applying this rule without deleting it." checked={active} onCheckedChange={setActive} />
      </div>
    </ModalDialog>
  );
}
