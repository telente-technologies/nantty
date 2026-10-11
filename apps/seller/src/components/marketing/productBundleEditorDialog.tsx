"use client";

import { useState } from "react";

import { MarketingProductPicker } from "@/components/marketing/marketingProductPicker";
import { Button, IconButton } from "@/components/ui/button";
import { FormErrorSummary, MoneyField, SelectField, TextAreaField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { MarketingProductOption, ProductBundle, ProductBundleInput } from "@/types/marketing.type";
import type { CurrencyCode } from "@/types/money.type";
import { validateProductBundleInput } from "@/utils/marketingValidation.util";
import { convertMajorInputToMinorUnits, convertMinorUnitsToMajorInputText } from "@/utils/money.util";

import styles from "./marketing.module.css";

interface BundleDraftItem {
  readonly option: MarketingProductOption;
  readonly quantity: number;
}

export function ProductBundleEditorDialog({ bundle, currency, onClose, onSaved }: { readonly bundle: ProductBundle | null; readonly currency: CurrencyCode; readonly onClose: () => void; readonly onSaved: () => void }) {
  const { formatMoney } = useMoneyFormatter();
  const { showToast } = useToast();
  const [name, setName] = useState(bundle?.name ?? "");
  const [description, setDescription] = useState(bundle?.description ?? "");
  const [status, setStatus] = useState<ProductBundle["status"]>(bundle?.status ?? "active");
  const [priceText, setPriceText] = useState(bundle ? convertMinorUnitsToMajorInputText(bundle.bundlePrice.amountMinor, currency) : "");
  const [items, setItems] = useState<BundleDraftItem[]>((bundle?.items ?? []).map((item) => ({ option: { productId: item.productId, name: item.productName, imageUrl: item.imageUrl, price: item.unitPrice }, quantity: item.quantity })));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const regularMinor = items.reduce((sum, item) => sum + item.option.price.amountMinor * item.quantity, 0);
  const bundleMinor = convertMajorInputToMinorUnits(priceText, currency);
  const savingsMinor = bundleMinor !== null ? regularMinor - bundleMinor : null;

  async function saveBundle() {
    const input: ProductBundleInput = { name: name.trim(), description: description.trim(), status, bundlePriceMinor: bundleMinor ?? Number.NaN, items: items.map((item) => ({ productId: item.option.productId, quantity: item.quantity })) };
    const issues = validateProductBundleInput(input);
    if (bundleMinor !== null && bundleMinor >= regularMinor && items.length > 0) issues.push({ path: "bundlePrice", message: `The bundle price must be below ${formatMoney({ amountMinor: regularMinor, currency })}.` });
    setFieldErrors(Object.fromEntries(issues.map((issue) => [issue.path, issue.message])));
    if (issues.length > 0) return;
    setIsSaving(true);
    try {
      if (bundle) await sendSellerApiRequest(`/seller/marketing/bundles/${encodeURIComponent(bundle.id)}`, { method: "PATCH", body: input });
      else await sendSellerApiRequest("/seller/marketing/bundles", { method: "POST", body: input });
      showToast(bundle ? "Bundle saved." : "Bundle created.");
      onSaved();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalDialog intent="product"
      isOpen
      onClose={onClose}
      width="large"
      title={bundle ? `Edit ${bundle.name}` : "New bundle"}
      description="Sell products together for one lower price. Buyers see the bundle on each product page in the app."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" isBusy={isSaving} onClick={() => void saveBundle()}>{bundle ? "Save bundle" : "Create bundle"}</Button>
        </>
      }
    >
      <div className={styles.stack}>
        <FormErrorSummary messages={Object.values(fieldErrors)} />
        <div className={styles.twoColumns}>
          <TextField label="Name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} errorMessage={fieldErrors.name} placeholder="e.g. Weekend starter pack" />
          <SelectField label="Status" value={status} onChange={(event) => setStatus(event.target.value as ProductBundle["status"])} options={[{ value: "active", label: "Active" }, { value: "paused", label: "Paused" }, { value: "draft", label: "Draft" }]} />
        </div>
        <TextAreaField label="Description (optional)" rows={2} maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} errorMessage={fieldErrors.description} />
        {items.map((item, index) => (
          <div key={item.option.productId} className={styles.itemRow}>
            <span className={styles.itemName}><strong>{item.option.name}</strong> <span className={styles.muted}>{formatMoney(item.option.price)} each</span></span>
            <TextField label="Quantity" hideLabel inputMode="numeric" style={{ width: 70 }} value={String(item.quantity)} onChange={(event) => setItems((current) => current.map((existing, existingIndex) => (existingIndex === index ? { ...existing, quantity: Math.min(20, Number(event.target.value.replace(/\D/g, "") || "0")) } : existing)))} />
            <IconButton iconName="trash24" label={`Remove ${item.option.name}`} size="small" onClick={() => setItems((current) => current.filter((_, existingIndex) => existingIndex !== index))} />
          </div>
        ))}
        {fieldErrors.items ? <p className={styles.muted} role="alert">{fieldErrors.items}</p> : null}
        {items.length < 10 ? <MarketingProductPicker chosenProductIds={items.map((item) => item.option.productId)} onProductChosen={(option) => setItems((current) => [...current, { option, quantity: 1 }])} /> : null}
        <div className={styles.twoColumns}>
          <MoneyField label="Bundle price" currency={currency} valueText={priceText} onValueTextChange={setPriceText} errorMessage={fieldErrors.bundlePrice} hint={`Separately: ${formatMoney({ amountMinor: regularMinor, currency })}`} />
          <p className={styles.priceLine}>{savingsMinor !== null && savingsMinor > 0 ? <>Buyers save <strong>{formatMoney({ amountMinor: savingsMinor, currency })}</strong></> : <span className={styles.muted}>Set a price below the separate total.</span>}</p>
        </div>
      </div>
    </ModalDialog>
  );
}
