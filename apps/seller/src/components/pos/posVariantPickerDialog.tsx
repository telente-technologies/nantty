"use client";

import { ModalDialog } from "@/components/ui/modalDialog";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { Product, ProductVariant } from "@/types/catalog.type";
import { readAvailableStockAtLocation } from "@/utils/posCatalog.util";

import styles from "./posDialogs.module.css";

export function PosVariantPickerDialog({ product, locationId, onChoose, onClose }: { readonly product: Product | null; readonly locationId: string | null; readonly onChoose: (product: Product, variant: ProductVariant) => void; readonly onClose: () => void }) {
  const { formatMoney } = useMoneyFormatter();
  return (
    <ModalDialog isOpen={product !== null} onClose={onClose} title={product ? `Choose ${product.options.map((option) => option.name.toLowerCase()).join(" and ") || "a variant"}` : ""} description={product?.name} width="medium">
      <ul className={styles.choiceGrid}>
        {product?.variants.map((variant, index) => {
          const available = readAvailableStockAtLocation(variant, locationId);
          return (
            <li key={variant.id}>
              <button type="button" className={styles.choiceButton} autoFocus={index === 0} onClick={() => onChoose(product, variant)}>
                <span className={styles.choiceTitle}>{variant.title}</span>
                <span className={styles.choiceMeta}>{formatMoney(variant.price)}</span>
                <span className={available <= 0 ? styles.choiceWarning : styles.choiceMeta}>{available <= 0 ? "Out of stock here" : `${available} in stock`}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </ModalDialog>
  );
}
