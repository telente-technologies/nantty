"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";

import { OrderListPanel } from "@/components/orders/orderListPanel";

import styles from "./ordersSplit.module.css";

export default function OrdersLayout({ children }: { readonly children: ReactNode }) {
  const activeOrderId = useSelectedLayoutSegment();
  return (
    <div className={[styles.split, activeOrderId ? styles.splitWithDetail : ""].join(" ")}>
      <div className={styles.listPane}>
        <OrderListPanel activeOrderId={activeOrderId} />
      </div>
      <div className={styles.detailPane}>{children}</div>
    </div>
  );
}
