"use client";

import { Panel } from "@/components/ui/panel";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { Customer } from "@/types/customer.type";

import styles from "./customers.module.css";

export function CustomerStoreCreditPanel({ customer }: { readonly customer: Customer }) {
  const { formatMoney } = useMoneyFormatter();
  const rewards = useStoreContext().settings?.storeRewards;
  return (
    <Panel title="Store credit">
      <p className={styles.storeCredit}>{formatMoney(customer.storeCreditBalance)}</p>
      {customer.storeCreditExpiresAt ? <p className={styles.muted}>Expires {new Date(customer.storeCreditExpiresAt).toLocaleDateString()}. Only usable at your store.</p> : null}
      {!rewards?.enabled ? <p className={styles.muted}>Store rewards are switched off in Marketing.</p> : null}
    </Panel>
  );
}
