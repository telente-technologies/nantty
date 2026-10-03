import type { Metadata } from "next";

import { OrdersIcon } from "@/components/ui/icons";

import styles from "./ordersSplit.module.css";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersIndexPage() {
  return (
    <div className={styles.placeholder}>
      <span className={styles.placeholderIcon} aria-hidden="true">
        <OrdersIcon size={28} />
      </span>
      <h2 className={styles.placeholderTitle}>Select an order</h2>
      <p className={styles.placeholderText}>Tracking, escrow status and receipts open here.</p>
    </div>
  );
}
