"use client";

import type { ProductDraft } from "@/components/catalog/productEditorDraft.util";
import { Callout } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { Panel } from "@/components/ui/panel";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { BrandDirectoryEntry, ProductBrandRelationship } from "@/types/brand.type";
import type { CursorPage } from "@/types/pagination.type";

export const productBrandRelationshipLabels: Record<ProductBrandRelationship, string> = {
  own: "Our own brand",
  authorised_reseller: "Authorised reseller",
  genuine_resale: "Genuine resale",
};

interface ProductBrandSectionProps {
  readonly draft: ProductDraft;
  readonly fieldErrors: Record<string, string>;
  readonly onDraftChange: (patch: Partial<ProductDraft>) => void;
}

export function ProductBrandSection({ draft, fieldErrors, onDraftChange }: ProductBrandSectionProps) {
  const directoryQuery = useSellerQuery<CursorPage<BrandDirectoryEntry>>("/seller/brands/directory");
  const entries = directoryQuery.data?.data ?? [];
  const selectedEntry = entries.find((entry) => entry.id === draft.brandId);
  const relationshipOptions: ProductBrandRelationship[] = selectedEntry?.isMine ? ["own", "authorised_reseller", "genuine_resale"] : ["authorised_reseller", "genuine_resale"];

  function chooseBrand(brandId: string) {
    const entry = entries.find((candidate) => candidate.id === brandId);
    onDraftChange({ brandId, brandRelationship: !entry ? "" : entry.isMine ? "own" : "genuine_resale" });
  }

  return (
    <Panel title="Brand" description="Tag the brand so buyers can find it and brands can protect their name.">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SelectField
          label="Brand"
          value={draft.brandId}
          onChange={(event) => chooseBrand(event.target.value)}
          errorMessage={fieldErrors["brand.brandId"]}
          options={[
            { value: "", label: "No brand" },
            ...entries.map((entry) => ({ value: entry.id, label: `${entry.name}${entry.isMine ? " (your brand)" : entry.isOfficial ? " · Official" : ""}` })),
          ]}
          hint={directoryQuery.errorMessage ?? "Only registered brands, plus your own, can be tagged."}
        />
        {draft.brandId ? (
          <SelectField
            label="How you sell it"
            value={draft.brandRelationship}
            onChange={(event) => onDraftChange({ brandRelationship: event.target.value as ProductBrandRelationship })}
            errorMessage={fieldErrors["brand.relationship"]}
            options={relationshipOptions.map((relationship) => ({ value: relationship, label: productBrandRelationshipLabels[relationship] }))}
          />
        ) : null}
        {draft.brandId && draft.brandRelationship !== "own" ? (
          <Callout tone="caution">Only tag another brand for genuine goods. Official brands can see your listing and report counterfeits.</Callout>
        ) : null}
      </div>
    </Panel>
  );
}
