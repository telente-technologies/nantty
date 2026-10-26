"use client";

import type { ProductDraft } from "@/components/catalog/productEditorDraft.util";
import { productVisibilityDescription, productVisibilityLabel } from "@/components/catalog/productPresentation.util";
import { Callout } from "@/components/ui/feedback";
import { SelectField, TextField, ToggleSwitch } from "@/components/ui/formFields";
import { Panel } from "@/components/ui/panel";
import type { ProductStatus, ProductVisibility } from "@/types/catalog.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./productEditor.module.css";

interface ProductPublishingSectionProps {
  readonly draft: ProductDraft;
  readonly fieldErrors: Record<string, string>;
  readonly onDraftChange: (patch: Partial<ProductDraft>) => void;
  readonly isPublishing: boolean;
  readonly onPublishedOnlineChange: (publishedOnline: boolean) => void;
}

const visibilityOptions: ProductVisibility[] = ["public", "store_only", "link_only"];

export function ProductPublishingSection({ draft, fieldErrors, onDraftChange, isPublishing, onPublishedOnlineChange }: ProductPublishingSectionProps) {
  const scheduledDate = draft.status === "draft" && draft.publishAtLocalText ? new Date(draft.publishAtLocalText) : null;
  return (
    <Panel title="Publishing" description="Decide when this product goes live and who can find it.">
      <div className={styles.formGrid}>
        <SelectField
          label="Status"
          value={draft.status}
          onChange={(event) => {
            const status = event.target.value as ProductStatus;
            onDraftChange({ status, publishedOnline: status === "active" ? draft.publishedOnline : false, publishAtLocalText: status === "draft" ? draft.publishAtLocalText : "" });
          }}
          options={[{ value: "active", label: "Active — ready to sell" }, { value: "draft", label: "Draft — not for sale yet" }, { value: "archived", label: "Archived — kept for records" }]}
          errorMessage={fieldErrors.status}
        />
        <SelectField
          label="Who can see it"
          value={draft.visibility}
          onChange={(event) => onDraftChange({ visibility: event.target.value as ProductVisibility })}
          options={visibilityOptions.map((visibility) => ({ value: visibility, label: productVisibilityLabel[visibility] }))}
          hint={productVisibilityDescription[draft.visibility]}
          errorMessage={fieldErrors.visibility}
        />
        {draft.status === "draft" ? (
          <TextField
            className={styles.fullRow}
            label="Publish automatically on"
            type="datetime-local"
            value={draft.publishAtLocalText}
            min={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)}
            onChange={(event) => onDraftChange({ publishAtLocalText: event.target.value })}
            errorMessage={fieldErrors.publishAt}
            hint="Leave empty to keep it as a draft. At this time it becomes active and, if it has a photo, listed on Nantty."
          />
        ) : null}
      </div>
      {scheduledDate && !Number.isNaN(scheduledDate.getTime()) ? <Callout tone="info">Scheduled to go live {formatDateTimeForDisplay(scheduledDate.toISOString())}.</Callout> : null}
      <div className={styles.toggleList}>
        <ToggleSwitch
          label="List on the Nantty marketplace"
          description="Customers can buy it in the Nantty app. Needs an active status and at least one photo. App orders hold stock automatically."
          checked={draft.publishedOnline}
          disabled={draft.status !== "active" || isPublishing}
          onCheckedChange={onPublishedOnlineChange}
        />
      </div>
    </Panel>
  );
}
