"use client";

import Link from "next/link";
import { useState } from "react";

import { deliveryStatusPresentation } from "@/components/orders/orderPresentation.constant";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { KeyValueList } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import type { DeliveryShipment } from "@/types/delivery.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./delivery.module.css";
import { IconLabel } from "@/components/ui/zudoIcon";

export function DeliveryShipmentDialog({ shipment, onClose, onShipmentChanged }: { readonly shipment: DeliveryShipment; readonly onClose: () => void; readonly onShipmentChanged: () => void }) {
  const { showToast } = useToast();
  const [riderName, setRiderName] = useState(shipment.riderName ?? "");
  const [riderPhone, setRiderPhone] = useState(shipment.riderPhone ?? "");
  const [attemptNote, setAttemptNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const isOnTheWay = shipment.status === "in_transit" || shipment.status === "failed";
  const presentation = deliveryStatusPresentation[shipment.status];

  async function sendShipmentUpdate(actionKey: string, path: string, method: "POST" | "PATCH", body: unknown, successMessage: string) {
    setBusyAction(actionKey);
    setFieldErrors({});
    try {
      await sendSellerApiRequest<DeliveryShipment>(`/seller/delivery/shipments/${encodeURIComponent(shipment.orderId)}${path}`, { method, body });
      showToast(successMessage);
      onShipmentChanged();
      onClose();
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues) setFieldErrors(Object.fromEntries(error.issues.map((issue) => [issue.path, issue.message])));
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <ModalDialog isOpen onClose={onClose} width="medium" title={`Delivery for ${shipment.orderNumber}`} description={`${shipment.buyerName} · ${shipment.city}, ${shipment.state}`} footer={<Button onClick={onClose}>Close</Button>}>
      <div className={styles.stack}>
        <KeyValueList
          items={[
            { label: "Status", value: <StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge> },
            { label: "Courier", value: shipment.courier ?? "Not shipped yet" },
            { label: "Tracking", value: shipment.trackingNumber ?? "—" },
            { label: "Expected", value: formatDateTimeForDisplay(shipment.estimatedDeliveryAt) },
            { label: "Attempts", value: String(shipment.attempts) },
            ...(shipment.lastAttemptNote ? [{ label: "Last attempt", value: shipment.lastAttemptNote }] : []),
          ]}
        />
        <div className={styles.twoColumns}>
          <TextField label="Rider name" value={riderName} maxLength={60} onChange={(event) => setRiderName(event.target.value)} errorMessage={fieldErrors.riderName} />
          <TextField label="Rider phone" type="tel" value={riderPhone} maxLength={16} placeholder="+234 803 000 0000" onChange={(event) => setRiderPhone(event.target.value)} errorMessage={fieldErrors.riderPhone} />
        </div>
        <div className={styles.actionRow}>
          <Button isBusy={busyAction === "rider"} disabled={busyAction !== null} onClick={() => void sendShipmentUpdate("rider", "", "PATCH", { riderName: riderName.trim(), riderPhone: riderPhone.trim() }, "Rider details saved.")}>
            Save rider
          </Button>
          {shipment.status === "failed" ? (
            <Button isBusy={busyAction === "retry"} disabled={busyAction !== null} onClick={() => void sendShipmentUpdate("retry", "", "PATCH", { retry: true, riderName: riderName.trim(), riderPhone: riderPhone.trim() }, "Back on the way for another attempt.")}>
              Retry delivery
            </Button>
          ) : null}
        </div>
        {isOnTheWay ? (
          <>
            <TextAreaField label="Delivery attempt note" placeholder="For example: customer not picking calls" rows={2} maxLength={300} value={attemptNote} onChange={(event) => setAttemptNote(event.target.value)} errorMessage={fieldErrors.note} />
            <div className={styles.actionRow}>
              <Button variant="primary" iconName="check16" isBusy={busyAction === "delivered"} disabled={busyAction !== null} onClick={() => void sendShipmentUpdate("delivered", "/attempts", "POST", { outcome: "delivered", note: attemptNote.trim() }, `${shipment.orderNumber} delivered.`)}>
                Mark delivered
              </Button>
              <Button variant="danger" isBusy={busyAction === "failed"} disabled={busyAction !== null} onClick={() => void sendShipmentUpdate("failed", "/attempts", "POST", { outcome: "failed", note: attemptNote.trim() }, "Failed attempt recorded.")}>
                Record failed attempt
              </Button>
            </div>
          </>
        ) : null}
        <Link href={`/orders/${shipment.orderId}`}><IconLabel name="arrowRight24" size={16}>Open the order</IconLabel></Link>
      </div>
    </ModalDialog>
  );
}
