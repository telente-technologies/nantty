"use client";

import type { ProductDraft } from "@/components/catalog/productEditorDraft.util";
import { SelectField, TextAreaField, TextField, ToggleSwitch } from "@/components/ui/formFields";
import { Panel } from "@/components/ui/panel";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { ProductCategory, ProductStatus } from "@/types/catalog.type";
import type { CursorPage } from "@/types/pagination.type";

import styles from "./productEditor.module.css";

interface ProductBasicsSectionProps {
  readonly draft: ProductDraft;
  readonly fieldErrors: Record<string, string>;
  readonly onDraftChange: (patch: Partial<ProductDraft>) => void;
  readonly isExistingProduct: boolean;
  readonly isPublishing: boolean;
  readonly onPublishedOnlineChange: (publishedOnline: boolean) => void;
}

export function ProductBasicsSection({ draft, fieldErrors, onDraftChange, isExistingProduct, isPublishing, onPublishedOnlineChange }: ProductBasicsSectionProps) {
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
          options={[{ value: "", label: "No category" }, ...(categoriesQuery.data?.data ?? []).map((category) => ({ value: category.id, label: category.name }))]}
        />
        <TextAreaField className={styles.fullRow} label="Description" value={draft.description} maxLength={5000} onChange={(event) => onDraftChange({ description: event.target.value })} errorMessage={fieldErrors.description} hint="Shown on the marketplace. The register only shows the name." />
        <SelectField
          label="Status"
          value={draft.status}
          onChange={(event) => onDraftChange({ status: event.target.value as ProductStatus, publishedOnline: event.target.value === "active" ? draft.publishedOnline : false })}
          options={[{ value: "active", label: "Active — sell it" }, { value: "draft", label: "Draft — hidden everywhere" }, { value: "archived", label: "Archived" }]}
          hint="Only active products appear on the register."
        />
        <TextField label="Tags" value={draft.tagsText} onChange={(event) => onDraftChange({ tagsText: event.target.value })} errorMessage={fieldErrors.tags} hint="Separate with commas, for example bestseller, made-in-nigeria." maxLength={640} />
      </div>
      <div className={styles.toggleList}>
        <ToggleSwitch
          label="Sell on the Zudomart marketplace"
          description={isExistingProduct ? "Publishing is instant. Online orders and the register share one stock count." : "Online orders and the register share one stock count. Needs an active status and at least one photo."}
          checked={draft.publishedOnline}
          disabled={draft.status !== "active" || isPublishing}
          onCheckedChange={onPublishedOnlineChange}
        />
        <ToggleSwitch label="Charge tax" description="Uses your store's tax settings at checkout." checked={draft.taxable} onCheckedChange={(taxable) => onDraftChange({ taxable })} />
        <ToggleSwitch label="Track stock" description="Count units per location and warn when stock runs low." checked={draft.trackInventory} onCheckedChange={(trackInventory) => onDraftChange({ trackInventory })} />
      </div>
    </Panel>
  );
}
