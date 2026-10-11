"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import styles from "@/app/(app)/seller/page.module.css";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { sellerService } from "@/services/seller.service";
import type { CatalogProduct, CatalogProductImage, CatalogProductUpsertRequest } from "@/types/sellerCatalog.type";
import {
  buildCatalogProductUpsertRequest, EMPTY_SELLER_PRODUCT_FORM, formValuesFromCatalogProduct, validateSellerProductForm, type SellerProductFormErrors, type SellerProductFormValues,
} from "@/utils/sellerProductForm.util";

import { ProductImagesField } from "./productImagesField";

export interface SellerProductFormProps {
  readonly existing: CatalogProduct | null;
  readonly submitLabel: string;
  readonly onSubmit: (request: CatalogProductUpsertRequest) => Promise<void>;
}

export function SellerProductForm({ existing, submitLabel, onSubmit }: SellerProductFormProps) {
  const [values, setValues] = useState<SellerProductFormValues>(() => (existing ? formValuesFromCatalogProduct(existing) : EMPTY_SELLER_PRODUCT_FORM));
  const [errors, setErrors] = useState<SellerProductFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const skuSeed = useRef<string | null>(null);
  const locations = useQuery({ queryKey: ["seller", "locations"], queryFn: sellerService.listMyStoreLocations, enabled: existing === null, retry: false, staleTime: 5 * 60_000 });
  const defaultLocationId = locations.data?.find((location) => location.isDefault && location.active)?.id ?? locations.data?.find((location) => location.active)?.id ?? null;
  const dirty = existing ? JSON.stringify(values) !== JSON.stringify(formValuesFromCatalogProduct(existing)) : JSON.stringify(values) !== JSON.stringify(EMPTY_SELLER_PRODUCT_FORM);

  useEffect(() => {
    if (!dirty || saving) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty, saving]);

  const update = (patch: Partial<SellerProductFormValues>) => setValues((current) => ({ ...current, ...patch }));
  const changeImages = useCallback((change: (current: readonly CatalogProductImage[]) => readonly CatalogProductImage[]) => setValues((current) => ({ ...current, images: change(current.images) })), []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || uploading) return;
    const found = validateSellerProductForm(values, existing === null);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (existing === null && Number(values.stockText) > 0 && defaultLocationId === null && !locations.isError) {
      setSubmitError("Loading your store location. Try again in a moment.");
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setSubmitError(null);
    try {
      skuSeed.current ??= crypto.randomUUID().slice(0, 8).toUpperCase();
      await onSubmit(buildCatalogProductUpsertRequest(values, existing, defaultLocationId, skuSeed.current));
    } catch (error) {
      setSubmitError(readErrorMessageForDisplay(error));
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      <div className={styles.field}>
        Photos
        <ProductImagesField images={values.images} onChangeImages={changeImages} onUploadingChange={setUploading} disabled={saving} />
        {errors.images ? <p className={styles.error} role="alert">{errors.images}</p> : null}
      </div>
      <label className={styles.field}>Name
        <input className={styles.input} value={values.name} maxLength={120} onChange={(event) => update({ name: event.target.value })} aria-invalid={Boolean(errors.name)} required />
        {errors.name ? <span className={styles.error} role="alert">{errors.name}</span> : null}
      </label>
      <label className={styles.field}>Description
        <textarea className={styles.textarea} value={values.description} maxLength={5000} onChange={(event) => update({ description: event.target.value })} />
      </label>
      <label className={styles.field}>Price
        <input className={styles.input} value={values.priceText} onChange={(event) => update({ priceText: event.target.value })} placeholder="0.00" inputMode="decimal" aria-invalid={Boolean(errors.price)} required />
        {errors.price ? <span className={styles.error} role="alert">{errors.price}</span> : null}
      </label>
      <label className={styles.field}>{existing ? "In stock" : "Stock"}
        <input className={styles.input} value={values.stockText} onChange={(event) => update({ stockText: event.target.value })} inputMode="numeric" disabled={existing !== null} aria-invalid={Boolean(errors.stock)} />
        {existing ? <span className={styles.rowMeta}>Change stock from your inventory in the Seller dashboard.</span> : <span className={styles.rowMeta}>For each size and colour.</span>}
        {errors.stock ? <span className={styles.error} role="alert">{errors.stock}</span> : null}
      </label>
      <label className={styles.field}>Sizes (comma separated)
        <input className={styles.input} value={values.sizesText} onChange={(event) => update({ sizesText: event.target.value })} placeholder="S, M, L" />
      </label>
      <label className={styles.field}>Colours (comma separated)
        <input className={styles.input} value={values.colorsText} onChange={(event) => update({ colorsText: event.target.value })} placeholder="Black, White" />
      </label>
      {submitError ? <p className={styles.error} role="alert">{submitError}</p> : null}
      <button type="submit" className={styles.primary} disabled={saving || uploading}>{saving ? "Saving…" : uploading ? "Uploading…" : submitLabel}</button>
    </form>
  );
}
