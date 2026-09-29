"use client";

import { useState } from "react";

import { SwitchToggle } from "@/components/ui/formFields";
import { DeliveryStatusBadge } from "@/components/ui/statusBadge";
import type { DeliveryStatus } from "@/types/campaign.type";

import styles from "./campaignTables.module.css";

interface DeliveryStatusCellProps {
  readonly itemName: string;
  readonly status: DeliveryStatus;
  readonly canToggle: boolean;
  readonly onToggleDelivery: (nextStatus: "active" | "paused") => Promise<void>;
}

export function DeliveryStatusCell({ itemName, status, canToggle, onToggleDelivery }: DeliveryStatusCellProps) {
  const [isSaving, setIsSaving] = useState(false);
  const isToggleable = canToggle && (status === "active" || status === "paused");
  async function switchDeliveryOnOrOff(turnOn: boolean) {
    setIsSaving(true);
    try {
      await onToggleDelivery(turnOn ? "active" : "paused");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <span className={styles.deliveryCell}>
      {isToggleable ? <SwitchToggle label={`${status === "active" ? "Pause" : "Resume"} ${itemName}`} hideLabel checked={status === "active"} disabled={isSaving} onCheckedChange={switchDeliveryOnOrOff} /> : null}
      <DeliveryStatusBadge status={status} />
    </span>
  );
}
