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
                {options.map((option) => (
                  <button
                    key={option.mode}
                    type="button"
                    role="radio"
                    aria-checked={chosen === option.mode}
                    className={[styles.option, chosen === option.mode ? styles.optionActive : ""].filter(Boolean).join(" ")}
                    onClick={() => onChange(group.storeId, option.mode)}
                  >
                    <span className={styles.optionTitle}>{option.title}</span>
                    <span className={styles.meta}>{option.note}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className={styles.meta}>Protected by Zudomart Escrow</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
