"use client";

import { useState } from "react";

import { OrderFulfilmentForm } from "@/components/orders/orderFulfilmentForm";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { OnlineOrder, OnlineOrderStatus } from "@/types/order.type";

import styles from "./orders.module.css";

const nextStepCopy: Partial<Record<OnlineOrderStatus, { readonly title: string; readonly description: string }>> = {
  new: { title: "New order — accept or reject", description: "The customer has paid into escrow. Accept to start preparing it, or reject if you cannot fulfil it and they are refunded in full." },
  processing: { title: "Prepare this order", description: "Pack the items below. Mark it ready when it is waiting for the courier, or add tracking straight away." },
  ready: { title: "Ready for pickup — ship it", description: "Hand the parcel to a courier, then add the tracking details. The customer is notified in the app." },
  shipped: { title: "On the way", description: "Mark it delivered once the courier confirms. Escrow releases to your wallet three days later unless the customer reports a problem." },
};

export function OrderNextStepPanel({ order, onOrderChanged, onRejectRequested }: { readonly order: OnlineOrder; readonly onOrderChanged: (order: OnlineOrder) => void; readonly onRejectRequested: () => void }) {
  const { showToast } = useToast();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const copy = nextStepCopy[order.status];
  if (!copy) return null;

  async function sendOrderAction(actionKey: string, path: string, body: unknown, successMessage: string) {
    setBusyAction(actionKey);
    try {
      const updatedOrder = await sendSellerApiRequest<OnlineOrder>(`/seller/orders/${order.id}/${path}`, { method: "POST", body });
      showToast(successMessage);
      onOrderChanged(updatedOrder);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Panel title={copy.title} description={copy.description}>
      <div className={styles.formStack}>
        {order.status === "new" ? (
          <div className={styles.actionRow}>
            <Button variant="primary" iconName="check16" isBusy={busyAction === "accept"} disabled={busyAction !== null} onClick={() => void sendOrderAction("accept", "accept", {}, `Accepted ${order.orderNumber}. The customer has been told you are preparing it.`)}>
              Accept order
            </Button>
            <Button variant="danger" disabled={busyAction !== null} onClick={onRejectRequested}>
              Reject
            </Button>
          </div>
        ) : null}
        {order.status === "processing" ? (
          <div className={styles.actionRow}>
            <Button iconName="boxArrowDown24" isBusy={busyAction === "ready"} disabled={busyAction !== null} onClick={() => void sendOrderAction("ready", "status", { status: "ready" }, `${order.orderNumber} is ready for pickup.`)}>
              Mark ready for pickup
            </Button>
          </div>
        ) : null}
        {order.status === "processing" || order.status === "ready" ? <OrderFulfilmentForm order={order} onShipped={onOrderChanged} /> : null}
        {order.status === "shipped" ? (
          <div className={styles.actionRow}>
            <Button variant="primary" iconName="check16" isBusy={busyAction === "delivered"} disabled={busyAction !== null} onClick={() => void sendOrderAction("delivered", "status", { status: "delivered" }, `${order.orderNumber} marked as delivered.`)}>
              Mark as delivered
            </Button>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
