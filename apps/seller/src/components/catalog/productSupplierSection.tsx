"use client";

import { FeaturePlanBadge } from "@/components/billing/planGate";
import type { ProductDraft } from "@/components/catalog/productEditorDraft.util";
import { SelectField } from "@/components/ui/formFields";
import { Panel } from "@/components/ui/panel";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { Supplier } from "@/types/catalog.type";
import type { CursorPage } from "@/types/pagination.type";

import styles from "./productEditor.module.css";

export function ProductSupplierSection({ draft, fieldErrors, onDraftChange }: { readonly draft: ProductDraft; readonly fieldErrors: Record<string, string>; readonly onDraftChange: (patch: Partial<ProductDraft>) => void }) {
  const { hasFeature } = usePlanFeatures();
  const canLinkSupplier = hasFeature("advanced_inventory");
  const suppliersQuery = useSellerQuery<CursorPage<Supplier>>(canLinkSupplier ? "/seller/suppliers" : null, { limit: 200 });
  return (
    <Panel title={<span className={styles.titleWithBadge}>Supplier <FeaturePlanBadge feature="advanced_inventory" /></span>} description="Who you restock this product from. Used for reorder suggestions.">
      {canLinkSupplier ? (
        <SelectField
          label="Supplier"
          value={draft.supplierId}
          onChange={(event) => onDraftChange({ supplierId: event.target.value })}
          errorMessage={fieldErrors.supplierId}
          hint={<a href="/inventory/suppliers">Manage suppliers</a>}
          options={[{ value: "", label: "No supplier" }, ...(suppliersQuery.data?.data ?? []).map((supplier) => ({ value: supplier.id, label: supplier.name }))]}
        />
      ) : (
        <p className={styles.muted}>Link suppliers and get reorder suggestions with Pro.</p>
      )}
    </Panel>
  );
}
