"use client";

import { useState, type FormEvent } from "react";

import { courierOptions } from "@/components/orders/orderPresentation.constant";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/formFields";
import { useToast } from "@/components/ui/toastProvider";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { createIdempotencyKey, readErrorMessageForDisplay, sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import type { OnlineOrder } from "@/types/order.type";
import { isValidOptionalTrackingUrl } from "@/utils/trackingUrl.util";

import styles from "./orders.module.css";

export function OrderFulfilmentForm({ order, onShipped }: { readonly order: OnlineOrder; readonly onShipped: (order: OnlineOrder) => void }) {
  const { showToast } = useToast();
  const { locations, selectedLocationId } = useStoreContext();
  const activeLocations = locations.filter((location) => location.active);
  const [courierChoice, setCourierChoice] = useState(courierOptions[0] ?? "Other");
  const [otherCourierName, setOtherCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [fromLocationId, setFromLocationId] = useState(activeLocations.find((location) => location.kind === "warehouse")?.id ?? selectedLocationId ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey] = useState(() => createIdempotencyKey("ship"));

  function validateShippingDetails(): Record<string, string> {
    const errors: Record<string, string> = {};
    const courier = courierChoice === "Other" ? otherCourierName.trim() : courierChoice;
    if (courier.length < 2 || courier.length > 60) errors.courier = "Enter the courier's name.";
    if (!/^[A-Za-z0-9-]{4,40}$/.test(trackingNumber.trim())) errors.trackingNumber = "Enter the tracking number (4–40 letters, digits or dashes).";
    if (!isValidOptionalTrackingUrl(trackingUrl)) errors.trackingUrl = "Enter a valid HTTPS tracking link (up to 300 characters).";
    if (!fromLocationId) errors.fromLocationId = "Choose where the parcel ships from.";
    return errors;
  }

  async function submitShippingDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateShippingDetails();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setIsSubmitting(true);
    try {
      const shippedOrder = await sendSellerApiRequest<OnlineOrder>(`/seller/orders/${order.id}/fulfilment`, {
        method: "POST",
        idempotencyKey,
        body: { courier: courierChoice === "Other" ? otherCourierName.trim() : courierChoice, trackingNumber: trackingNumber.trim(), trackingUrl: trackingUrl.trim() || null, fromLocationId },
      });
      showToast(`Marked ${order.orderNumber} as shipped. The buyer has been notified.`);
      onShipped(shippedOrder);
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues) setFieldErrors(Object.fromEntries(error.issues.map((issue) => [issue.path, issue.message])));
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.formStack} onSubmit={submitShippingDetails} noValidate>
      <div className={styles.formRow}>
        <SelectField label="Courier" value={courierChoice} onChange={(event) => setCourierChoice(event.target.value)} options={courierOptions.map((courier) => ({ value: courier, label: courier }))} errorMessage={courierChoice !== "Other" ? fieldErrors.courier : null} />
        {courierChoice === "Other" ? <TextField label="Courier name" value={otherCourierName} onChange={(event) => setOtherCourierName(event.target.value)} maxLength={60} errorMessage={fieldErrors.courier} /> : null}
        <TextField label="Tracking number" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value.toUpperCase())} maxLength={40} errorMessage={fieldErrors.trackingNumber} autoComplete="off" />
      </div>
      <div className={styles.formRow}>
        <TextField label="Tracking link (optional)" type="url" placeholder="https://" value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} maxLength={300} errorMessage={fieldErrors.trackingUrl} />
        <SelectField label="Ships from" value={fromLocationId} onChange={(event) => setFromLocationId(event.target.value)} options={[{ value: "", label: "Choose a location" }, ...activeLocations.map((location) => ({ value: location.id, label: location.name }))]} errorMessage={fieldErrors.fromLocationId} hint="Stock reserved for this order is taken from here." />
      </div>
      <div className={styles.actionRow}>
        <Button type="submit" variant="primary" iconName="truck24" isBusy={isSubmitting}>
          Mark as shipped
        </Button>
      </div>
    </form>
  );
}
