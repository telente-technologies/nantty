"use client";

import { useState } from "react";

import { requestConfirmation } from "@zudomart/web-kit";

import { DeliveryAreaFormDialog } from "@/components/delivery/deliveryAreaFormDialog";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button } from "@/components/ui/button";
import { Callout, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { DeliveryArea } from "@/types/delivery.type";
import type { CursorPage } from "@/types/pagination.type";

import styles from "./delivery.module.css";

export function DeliveryAreasManager() {
  const { can } = useSellerSession();
  const { showToast } = useToast();
  const { formatMoney } = useMoneyFormatter();
  const areasQuery = useSellerQuery<CursorPage<DeliveryArea>>("/seller/delivery/areas");
  const [editingArea, setEditingArea] = useState<DeliveryArea | "new" | null>(null);
  const [removingAreaId, setRemovingAreaId] = useState<string | null>(null);
  const canEdit = can("delivery:manage");
  const areas = areasQuery.data?.data ?? [];

  async function removeDeliveryArea(area: DeliveryArea) {
    if (!(await requestConfirmation({ title: `Remove ${area.name}?`, description: "Customers there will no longer see a delivery option.", confirmLabel: "Remove area", tone: "danger", intent: "remove" }))) return;
    setRemovingAreaId(area.id);
    try {
      await sendSellerApiRequest(`/seller/delivery/areas/${encodeURIComponent(area.id)}`, { method: "DELETE" });
      showToast(`Removed ${area.name}.`);
      areasQuery.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setRemovingAreaId(null);
    }
  }

  return (
    <Panel
      title="Delivery areas & fees"
      description="Where you deliver, what it costs the customer and how long it takes. Shown at checkout in the Zudomart app."
      actions={canEdit ? <Button variant="primary" iconName="plus16" onClick={() => setEditingArea("new")}>Add area</Button> : null}
    >
      {areasQuery.isLoading && !areasQuery.data ? <LoadingBlock label="Loading delivery areas" /> : null}
      {areasQuery.errorMessage ? <Callout tone="error" action={<Button size="small" onClick={areasQuery.reload}>Try again</Button>}>{areasQuery.errorMessage}</Callout> : null}
      {areasQuery.data && areas.length === 0 ? <EmptyState iconName="mapPin24" title="No delivery areas yet" description="Add the states and cities you deliver to, with a fee for each." /> : null}
      <ul className={styles.areaList}>
        {areas.map((area) => (
          <li key={area.id} className={styles.areaRow}>
            <span className={styles.primaryCell}>
              <span className={styles.areaTitle}>
                {area.name}
                {area.active ? null : <StatusBadge tone="caution">Paused</StatusBadge>}
              </span>
              <span className={styles.muted}>
                {area.state} · {area.cities.join(", ")}
              </span>
            </span>
            <span className={styles.areaMeta}>
              <strong>{formatMoney(area.fee)}</strong>
              <span className={styles.muted}>
                {area.estimatedDaysMin === area.estimatedDaysMax ? `${area.estimatedDaysMin}` : `${area.estimatedDaysMin}–${area.estimatedDaysMax}`} days
              </span>
              {canEdit ? (
                <span className={styles.actionRow}>
                  <Button size="small" onClick={() => setEditingArea(area)}>
                    Edit
                  </Button>
                  <Button size="small" variant="ghost" isBusy={removingAreaId === area.id} onClick={() => void removeDeliveryArea(area)}>
                    Remove
                  </Button>
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {editingArea ? <DeliveryAreaFormDialog key={editingArea === "new" ? "new" : editingArea.id} area={editingArea === "new" ? null : editingArea} onClose={() => setEditingArea(null)} onSaved={areasQuery.reload} /> : null}
    </Panel>
  );
}
