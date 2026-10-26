"use client";

import Link from "next/link";

import type { ProductDraft } from "@/components/catalog/productEditorDraft.util";
import { SelectField, TextAreaField, TextField, ToggleSwitch } from "@/components/ui/formFields";
import { Panel } from "@/components/ui/panel";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { ProductCategory } from "@/types/catalog.type";
import type { CursorPage } from "@/types/pagination.type";

import styles from "./productEditor.module.css";

interface ProductBasicsSectionProps {
  readonly draft: ProductDraft;
  readonly fieldErrors: Record<string, string>;
  readonly onDraftChange: (patch: Partial<ProductDraft>) => void;
}

export function ProductBasicsSection({ draft, fieldErrors, onDraftChange }: ProductBasicsSectionProps) {
  const categoriesQuery = useSellerQuery<CursorPage<ProductCategory>>("/seller/categories");
  return (
    <Panel title="Details">
      <div className={styles.formGrid}>
        <TextField label="Product name" value={draft.name} maxLength={120} onChange={(event) => onDraftChange({ name: event.target.value })} errorMessage={fieldErrors.name} required />
        <SelectField
          label="Category"
          value={draft.categoryId}
          onChange={(event) => onDraftChange({ categoryId: event.target.value })}
          errorMessage={fieldErrors.categoryId}
          hint={<Link href="/products/categories">Manage categories</Link>}
          options={[{ value: "", label: "No category" }, ...(categoriesQuery.data?.data ?? []).map((category) => ({ value: category.id, label: category.name }))]}
        />
        <TextAreaField className={styles.fullRow} label="Description" value={draft.description} maxLength={5000} rows={5} onChange={(event) => onDraftChange({ description: event.target.value })} errorMessage={fieldErrors.description} hint="Shown on the product page in the Nantty app." />
        <TextField className={styles.fullRow} label="Tags" value={draft.tagsText} onChange={(event) => onDraftChange({ tagsText: event.target.value })} errorMessage={fieldErrors.tags} hint="Separate with commas, for example bestseller, made-in-nigeria." maxLength={640} />
      </div>
      <div className={styles.toggleList}>
        <ToggleSwitch label="Charge tax" description="Uses your store's tax settings at checkout." checked={draft.taxable} onCheckedChange={(taxable) => onDraftChange({ taxable })} />
        <ToggleSwitch label="Track stock" description="Count units per location, hold stock for app orders and warn when it runs low." checked={draft.trackInventory} onCheckedChange={(trackInventory) => onDraftChange({ trackInventory })} />
      </div>
    </Panel>
  );
}
