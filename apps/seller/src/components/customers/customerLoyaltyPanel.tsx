"use client";

import { useState } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { createIdempotencyKey, readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Customer } from "@/types/customer.type";
import { readMinorUnitsPerMajorUnit } from "@/utils/money.util";

import styles from "./customers.module.css";

export function CustomerLoyaltyPanel({ customer, onCustomerChanged }: { readonly customer: Customer; readonly onCustomerChanged: (customer: Customer) => void }) {
  const { can } = useSellerSession();
  const { showToast } = useToast();
  const { formatMoney } = useMoneyFormatter();
  const loyalty = useStoreContext().settings?.loyalty;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pointsText, setPointsText] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey("loyalty"));

  async function saveLoyaltyAdjustment() {
    const pointsDelta = Number(pointsText.trim());
    const nextErrors: Record<string, string> = {};
    if (!/^-?\d{1,7}$/.test(pointsText.trim()) || pointsDelta === 0) nextErrors.points = "Enter whole points, e.g. 200 or -150.";
    else if (customer.loyaltyPoints + pointsDelta < 0) nextErrors.points = `They only have ${customer.loyaltyPoints} points.`;
    if (reason.trim().length < 3) nextErrors.reason = "Give a reason (at least 3 characters).";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setIsSaving(true);
    try {
      const updated = await sendSellerApiRequest<Customer>(`/seller/customers/${customer.id}/loyalty-adjustments`, { method: "POST", idempotencyKey, body: { pointsDelta, reason: reason.trim() } });
      onCustomerChanged(updated);
      showToast(`${customer.name} now has ${updated.loyaltyPoints.toLocaleString()} points.`);
      setIsDialogOpen(false);
      setPointsText("");
      setReason("");
      setIdempotencyKey(createIdempotencyKey("loyalty"));
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  const pointsValue = loyalty ? { amountMinor: customer.loyaltyPoints * loyalty.redeemValuePerPoint.amountMinor, currency: loyalty.redeemValuePerPoint.currency } : null;
  return (
    <Panel title="Loyalty points" actions={can("customers:manage") ? <Button size="small" onClick={() => setIsDialogOpen(true)}>Adjust</Button> : null}>
      <p className={styles.loyaltyPoints}>{customer.loyaltyPoints.toLocaleString()}</p>
      {loyalty?.enabled && pointsValue ? (
        <p className={styles.muted}>
          Worth {formatMoney(pointsValue)}. Earns {loyalty.pointsEarnedPerMajorUnit} point per {formatMoney({ amountMinor: readMinorUnitsPerMajorUnit(loyalty.redeemValuePerPoint.currency), currency: loyalty.redeemValuePerPoint.currency })} spent; redeemable from {loyalty.minimumPointsToRedeem} points at {formatMoney(loyalty.redeemValuePerPoint)} each.
        </p>
      ) : (
        <p className={styles.muted}>Loyalty is switched off in Settings.</p>
      )}
      <ModalDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Adjust loyalty points"
        description="Use a minus sign to remove points. Every change is logged."
        width="small"
        footer={
          <>
            <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button variant="primary" isBusy={isSaving} onClick={() => void saveLoyaltyAdjustment()}>Save adjustment</Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <TextField label="Points to add or remove" inputMode="numeric" value={pointsText} onChange={(event) => setPointsText(event.target.value.replace(/[^\d-]/g, ""))} errorMessage={errors.points} />
          <TextField label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} errorMessage={errors.reason} placeholder="Birthday gift" />
        </div>
      </ModalDialog>
    </Panel>
  );
}
