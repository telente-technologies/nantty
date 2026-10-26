import { useState } from "react";

import { Avatar } from "@/components/ui/media";
import { Badge } from "@/components/ui/feedback";
import { describeStoreTrust, isDirectPaymentStore } from "@/utils/paymentMode.util";
import type { PaymentMode } from "@/types";
import type { CartStoreGroup } from "@/utils/groupCartItemsByStore.util";

import styles from "./paymentModeChooser.module.css";

interface PaymentModeChooserProps {
  readonly groups: readonly CartStoreGroup[];
  readonly modes: Readonly<Record<string, PaymentMode>>;
  readonly onChange: (storeId: string, mode: PaymentMode) => void;
}

const options: readonly { readonly mode: PaymentMode; readonly title: string; readonly note: string }[] = [
  { mode: "escrow", title: "Escrow protection (recommended)", note: "Your money is held until you confirm delivery." },
  { mode: "direct", title: "Pay directly", note: "The seller is paid right away." },
];

function DirectPaymentOption({ storeName, selected, onConfirm }: { readonly storeName: string; readonly selected: boolean; readonly onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const confirmed = confirmation.trim().toUpperCase() === "DIRECT";

  function changeConfirmation(value: string) {
    setConfirmation(value);
    if (value.trim().toUpperCase() === "DIRECT") {
      onConfirm();
      setConfirming(false);
      setConfirmation("");
    }
  }

  return (
    <>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        className={[styles.option, selected ? styles.optionActive : ""].filter(Boolean).join(" ")}
        onClick={() => {
          if (!selected) setConfirming(true);
        }}
      >
        <span className={styles.optionTitle}>{options[1]?.title}</span>
        <span className={styles.meta}>{options[1]?.note}</span>
      </button>
      {selected || confirming ? (
        <div className={styles.directWarning}>
          <p className={styles.warning} role="note">
            You lose escrow protection. Refunds and disputes depend on the seller, and Nantty cannot hold or reverse this payment.
          </p>
          {!selected ? (
            <label className={styles.confirmLabel}>
              Type <strong>DIRECT</strong> to confirm paying {storeName} directly
              <input
                className={styles.confirmInput}
                value={confirmation}
                autoComplete="off"
                spellCheck={false}
                aria-label={`Type DIRECT to confirm paying ${storeName} directly`}
                onChange={(event) => changeConfirmation(event.target.value)}
              />
            </label>
          ) : null}
          {!selected && confirmed ? <span className={styles.meta}>Confirmed.</span> : null}
        </div>
      ) : null}
    </>
  );
}

export function PaymentModeChooser({ groups, modes, onChange }: PaymentModeChooserProps) {
  return (
    <ul className={styles.list}>
      {groups.map((group) => {
        const canPayDirectly = isDirectPaymentStore(group.store);
        const chosen = modes[group.storeId] ?? "escrow";
        return (
          <li key={group.storeId} className={styles.group}>
            <div className={styles.header}>
              <Avatar name={group.store?.name ?? "Seller"} src={group.store?.logoUrl ?? null} size="xs" />
              <span className={styles.name}>{group.store?.name ?? "Seller"}</span>
              {canPayDirectly ? <Badge tone="brand">Gold</Badge> : null}
              {group.store ? <span className={styles.meta}>{describeStoreTrust(group.store)}</span> : null}
            </div>
            {canPayDirectly ? (
              <div className={styles.options} role="radiogroup" aria-label={`How to pay ${group.store?.name ?? "this seller"}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={chosen === "escrow"}
                  className={[styles.option, chosen === "escrow" ? styles.optionActive : ""].filter(Boolean).join(" ")}
                  onClick={() => onChange(group.storeId, "escrow")}
                >
                  <span className={styles.optionTitle}>{options[0]?.title}</span>
                  <span className={styles.meta}>{options[0]?.note}</span>
                </button>
                <DirectPaymentOption storeName={group.store?.name ?? "this seller"} selected={chosen === "direct"} onConfirm={() => onChange(group.storeId, "direct")} />
              </div>
            ) : (
              <p className={styles.meta}>Protected by Nantty Escrow</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
