"use client";

import { useState } from "react";

import { MarketingProductPicker } from "@/components/marketing/marketingProductPicker";
import { convertIsoToLocalDateTimeInputValue, convertLocalDateTimeInputValueToIso } from "@/components/promotions/promotionPresentation.util";
import { Button, IconButton } from "@/components/ui/button";
import { FormErrorSummary, MoneyField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { FlashSale, FlashSaleInput, MarketingProductOption } from "@/types/marketing.type";
import type { CurrencyCode } from "@/types/money.type";
import { validateFlashSaleInput } from "@/utils/marketingValidation.util";
import { convertMajorInputToMinorUnits, convertMinorUnitsToMajorInputText } from "@/utils/money.util";

import styles from "./marketing.module.css";

interface FlashSaleDraftItem {
  readonly option: MarketingProductOption;
  readonly salePriceText: string;
  readonly stockCapText: string;
}

function buildDraftItemsFromSale(sale: FlashSale | null, currency: CurrencyCode): FlashSaleDraftItem[] {
  return (sale?.items ?? []).map((item) => ({ option: { productId: item.productId, name: item.productName, imageUrl: item.imageUrl, price: item.originalPrice }, salePriceText: convertMinorUnitsToMajorInputText(item.salePrice.amountMinor, currency), stockCapText: item.stockCap === null ? "" : String(item.stockCap) }));
}

export function FlashSaleEditorDialog({ sale, currency, onClose, onSaved }: { readonly sale: FlashSale | null; readonly currency: CurrencyCode; readonly onClose: () => void; readonly onSaved: () => void }) {
  const { formatMoney } = useMoneyFormatter();
  const { showToast } = useToast();
  const [name, setName] = useState(sale?.name ?? "");
  const [startsLocal, setStartsLocal] = useState(convertIsoToLocalDateTimeInputValue(sale?.startsAt ?? new Date(Date.now() + 3_600_000).toISOString()));
  const [endsLocal, setEndsLocal] = useState(convertIsoToLocalDateTimeInputValue(sale?.endsAt ?? new Date(Date.now() + 13 * 3_600_000).toISOString()));
  const [items, setItems] = useState<FlashSaleDraftItem[]>(() => buildDraftItemsFromSale(sale, currency));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  function buildInput(): FlashSaleInput {
    return {
      name: name.trim(),
      startsAt: convertLocalDateTimeInputValueToIso(startsLocal) ?? "",
      endsAt: convertLocalDateTimeInputValueToIso(endsLocal) ?? "",
      items: items.map((item) => ({ productId: item.option.productId, salePriceMinor: convertMajorInputToMinorUnits(item.salePriceText, currency) ?? Number.NaN, stockCap: item.stockCapText.trim() === "" ? null : Number(item.stockCapText) })),
    };
  }

  async function saveFlashSale() {
    const input = buildInput();
    const issues = validateFlashSaleInput(input);
    input.items.forEach((item, index) => {
      const original = items[index]?.option.price.amountMinor ?? 0;
      if (item.salePriceMinor >= original) issues.push({ path: `items.${index}.salePriceMinor`, message: `${items[index]?.option.name}: flash price must be below ${formatMoney(items[index]?.option.price)}.` });
    });
    setFieldErrors(Object.fromEntries(issues.map((issue) => [issue.path, issue.message])));
    if (issues.length > 0) return;
    setIsSaving(true);
    try {
      if (sale) await sendSellerApiRequest(`/seller/marketing/flash-sales/${encodeURIComponent(sale.id)}`, { method: "PATCH", body: input });
      else await sendSellerApiRequest("/seller/marketing/flash-sales", { method: "POST", body: input });
      showToast(sale ? "Flash sale saved." : "Flash sale scheduled. Buyers see a countdown in the app.");
      onSaved();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  const updateItem = (index: number, changes: Partial<FlashSaleDraftItem>) => setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item)));

  return (
    <ModalDialog intent="discount"
      isOpen
      onClose={onClose}
      width="large"
      title={sale ? `Edit ${sale.name}` : "New flash sale"}
      description="A short, time-boxed price drop with a countdown in the Nantty app. Optional stock caps stop the sale price once that many units sell."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" isBusy={isSaving} onClick={() => void saveFlashSale()}>{sale ? "Save flash sale" : "Schedule flash sale"}</Button>
        </>
      }
    >
      <div className={styles.stack}>
        <FormErrorSummary messages={Object.values(fieldErrors)} />
        <TextField label="Name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} errorMessage={fieldErrors.name} placeholder="e.g. Payday Friday flash sale" />
        <div className={styles.twoColumns}>
          <TextField label="Starts" type="datetime-local" value={startsLocal} onChange={(event) => setStartsLocal(event.target.value)} errorMessage={fieldErrors.startsAt} />
          <TextField label="Ends" type="datetime-local" value={endsLocal} min={startsLocal} onChange={(event) => setEndsLocal(event.target.value)} errorMessage={fieldErrors.endsAt} hint="Up to 7 days" />
        </div>
        {items.map((item, index) => (
          <div key={item.option.productId} className={styles.editorItemRow}>
            <span className={styles.primaryCell}><strong>{item.option.name}</strong><span className={styles.muted}>Regular {formatMoney(item.option.price)}</span></span>
            <MoneyField label="Flash price" currency={currency} valueText={item.salePriceText} onValueTextChange={(salePriceText) => updateItem(index, { salePriceText })} errorMessage={fieldErrors[`items.${index}.salePriceMinor`]} />
            <TextField label="Stock cap" inputMode="numeric" placeholder="No cap" value={item.stockCapText} onChange={(event) => updateItem(index, { stockCapText: event.target.value.replace(/\D/g, "") })} errorMessage={fieldErrors[`items.${index}.stockCap`]} />
            <IconButton iconName="trash24" label={`Remove ${item.option.name}`} size="small" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
          </div>
        ))}
        {items.length < 20 ? (
          <MarketingProductPicker
            chosenProductIds={items.map((item) => item.option.productId)}
            onProductChosen={(option) => setItems((current) => [...current, { option, salePriceText: convertMinorUnitsToMajorInputText(Math.round((option.price.amountMinor * 0.8) / 100) * 100, currency), stockCapText: "" }])}
          />
        ) : null}
      </div>
    </ModalDialog>
  );
}
