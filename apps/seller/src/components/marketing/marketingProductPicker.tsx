"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/filterControls";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { MarketingProductOption } from "@/types/marketing.type";
import type { CursorPage } from "@/types/pagination.type";

import styles from "./marketing.module.css";

export function MarketingProductPicker({ chosenProductIds, onProductChosen, label = "Add products" }: { readonly chosenProductIds: readonly string[]; readonly onProductChosen: (option: MarketingProductOption) => void; readonly label?: string }) {
  const { formatMoney } = useMoneyFormatter();
  const [searchText, setSearchText] = useState("");
  const [options, setOptions] = useState<MarketingProductOption[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    sendSellerApiRequest<CursorPage<MarketingProductOption>>("/seller/marketing/product-options", { query: { q: searchText }, signal: abortController.signal })
      .then((page) => {
        setOptions(page.data);
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setErrorMessage(readErrorMessageForDisplay(error));
      });
    return () => abortController.abort();
  }, [searchText]);

  const availableOptions = options.filter((option) => !chosenProductIds.includes(option.productId));
  return (
    <div className={styles.stack}>
      <SearchInput label={label} placeholder="Search your products" value={searchText} onValueChange={setSearchText} />
      {errorMessage ? <Callout tone="caution">{errorMessage}</Callout> : null}
      <ul className={styles.pickerList}>
        {availableOptions.slice(0, 8).map((option) => (
          <li key={option.productId} className={styles.pickerRow}>
            {option.imageUrl ? <img src={option.imageUrl} alt="" width={32} height={32} className={styles.thumbnail} /> : <span className={styles.thumbnail} aria-hidden="true" />}
            <span className={styles.pickerName}>{option.name}</span>
            <span className={styles.muted}>{formatMoney(option.price)}</span>
            <Button size="small" iconName="plus16" onClick={() => onProductChosen(option)}>Add</Button>
          </li>
        ))}
        {availableOptions.length === 0 && !errorMessage ? <li className={styles.pickerRow}>No more products match.</li> : null}
      </ul>
    </div>
  );
}
