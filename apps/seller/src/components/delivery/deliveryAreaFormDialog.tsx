"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MoneyField, TextField, ToggleSwitch } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import type { DeliveryArea, DeliveryAreaInput } from "@/types/delivery.type";
import { convertMajorInputToMinorUnits, convertMinorUnitsToMajorInputText } from "@/utils/money.util";

import styles from "./delivery.module.css";

export function DeliveryAreaFormDialog({ area, onClose, onSaved }: { readonly area: DeliveryArea | null; readonly onClose: () => void; readonly onSaved: () => void }) {
  const { showToast } = useToast();
  const { settings } = useStoreContext();
  const currency = area?.fee.currency ?? settings?.currency ?? "NGN";
  const [name, setName] = useState(area?.name ?? "");
  const [state, setState] = useState(area?.state ?? "");
  const [citiesText, setCitiesText] = useState(area?.cities.join(", ") ?? "");
  const [feeText, setFeeText] = useState(area ? convertMinorUnitsToMajorInputText(area.fee.amountMinor, area.fee.currency) : "");
  const [estimatedDaysMin, setEstimatedDaysMin] = useState(String(area?.estimatedDaysMin ?? 1));
  const [estimatedDaysMax, setEstimatedDaysMax] = useState(String(area?.estimatedDaysMax ?? 3));
  const [active, setActive] = useState(area?.active ?? true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  async function saveDeliveryArea() {
    const feeMinor = convertMajorInputToMinorUnits(feeText || "0", currency);
    const body: DeliveryAreaInput = {
      name: name.trim(),
      state: state.trim(),
      cities: citiesText.split(",").map((city) => city.trim()).filter(Boolean),
      feeMinor: feeMinor ?? -1,
      estimatedDaysMin: Number(estimatedDaysMin),
      estimatedDaysMax: Number(estimatedDaysMax),
      active,
    };
    setIsSaving(true);
    setFieldErrors({});
    try {
      await sendSellerApiRequest<DeliveryArea>(area ? `/seller/delivery/areas/${encodeURIComponent(area.id)}` : "/seller/delivery/areas", { method: area ? "PATCH" : "POST", body });
      showToast(area ? `Saved ${body.name}.` : `Added ${body.name}.`);
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
    <ModalDialog intent="location"
      isOpen
      onClose={onClose}
      title={area ? `Edit ${area.name}` : "Add a delivery area"}
      description="Customers in these cities see this fee and delivery time at checkout in the Zudomart app."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" isBusy={isSaving} onClick={() => void saveDeliveryArea()}>
            Save area
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        <div className={styles.twoColumns}>
          <TextField label="Area name" placeholder="South West" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} errorMessage={fieldErrors.name} />
          <TextField label="State" placeholder="Oyo" value={state} maxLength={40} onChange={(event) => setState(event.target.value)} errorMessage={fieldErrors.state} />
        </div>
        <TextField label="Cities and towns" hint="Separate with commas" placeholder="Ibadan, Ogbomoso, Oyo" value={citiesText} maxLength={600} onChange={(event) => setCitiesText(event.target.value)} errorMessage={fieldErrors.cities} />
        <div className={styles.twoColumns}>
          <MoneyField label="Delivery fee" currency={currency} valueText={feeText} onValueTextChange={setFeeText} errorMessage={fieldErrors.feeMinor} />
          <div className={styles.twoColumns}>
            <TextField label="Min days" type="number" min={0} max={30} value={estimatedDaysMin} onChange={(event) => setEstimatedDaysMin(event.target.value)} errorMessage={fieldErrors.estimatedDaysMin} />
            <TextField label="Max days" type="number" min={0} max={30} value={estimatedDaysMax} onChange={(event) => setEstimatedDaysMax(event.target.value)} errorMessage={fieldErrors.estimatedDaysMax} />
          </div>
        </div>
        <ToggleSwitch label="Deliver to this area" description="Turn off to stop taking orders from here for now." checked={active} onCheckedChange={setActive} />
      </div>
    </ModalDialog>
  );
}
