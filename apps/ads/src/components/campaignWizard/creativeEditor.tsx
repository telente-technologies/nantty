"use client";

import { ContentSourcePicker } from "@/components/campaignWizard/contentSourcePicker";
import { CreativeUploadField } from "@/components/campaignWizard/creativeUploadField";
import type { WizardAdDraft } from "@/components/campaignWizard/campaignWizardState.store";
import { buildPreviewCreativeFromAdDraft } from "@/components/campaignWizard/campaignWizardSubmission.util";
import type { WizardFieldErrors } from "@/components/campaignWizard/campaignWizardValidation.util";
import { AdPreviewWithSurfaceSwitcher } from "@/components/creative/adPreview";
import { SelectField, TextAreaField, TextField } from "@/components/ui/formFields";
import { TabList } from "@/components/ui/tabs";
import { callToActionLabels, creativeFormatLabels, headlineMaximumLength, primaryTextMaximumLength } from "@/constants/campaignOptions.constant";
import type { AdAccount } from "@/types/adAccount.type";
import type { AdPlacement } from "@/types/campaign.type";
import type { CallToAction, ContentSource, CreativeFormat, CreativeSourceType, DestinationType } from "@/types/creative.type";

import styles from "./creativeEditor.module.css";

const sourceTabs: readonly { readonly value: CreativeSourceType; readonly label: string }[] = [
  { value: "post", label: "Post" },
  { value: "clip", label: "Clip" },
  { value: "product", label: "Product" },
  { value: "store", label: "Store" },
  { value: "upload", label: "Upload new" },
];

const destinationLabels: Record<DestinationType, string> = { post: "The post or clip", profile: "Your profile", store: "Your store", product: "The product page", messages: "Zudomart messages", url: "A website" };

const formatBySourceType: Record<Exclude<CreativeSourceType, "upload">, CreativeFormat> = { post: "feed_post", clip: "clip", product: "product", store: "store" };

interface CreativeEditorProps {
  readonly accountId: string;
  readonly account: AdAccount;
  readonly ad: WizardAdDraft;
  readonly adIndex: number;
  readonly placements: readonly AdPlacement[];
  readonly errors: WizardFieldErrors;
  readonly onAdChange: (changes: Partial<Omit<WizardAdDraft, "key">>) => void;
}

export function CreativeEditor({ accountId, account, ad, adIndex, placements, errors, onAdChange }: CreativeEditorProps) {
  const errorFor = (field: string) => errors[`ads.${adIndex}.${field}`];

  function applyChosenSource(source: ContentSource) {
    onAdChange({
      selectedSource: source,
      format: formatBySourceType[source.type],
      headline: ad.headline || (source.product?.title ?? source.title).slice(0, headlineMaximumLength),
      primaryText: ad.primaryText || source.text.slice(0, primaryTextMaximumLength),
      destinationType: source.type === "product" ? "product" : source.type === "store" ? "store" : ad.destinationType,
    });
  }

  return (
    <div className={styles.editor}>
      <div className={styles.editorFields}>
        <TextField label="Ad name" value={ad.name} onValueChange={(name) => onAdChange({ name })} maxLength={120} />
        <div>
          <p className={styles.fieldLabel}>What to promote</p>
          <TabList label="Creative source" tabs={sourceTabs} selected={ad.sourceType} onSelect={(sourceType) => onAdChange({ sourceType, selectedSource: sourceType === ad.sourceType ? ad.selectedSource : null, format: sourceType === "upload" ? "feed_post" : formatBySourceType[sourceType] })} />
          {ad.sourceType === "upload" ? (
            <CreativeUploadField accountId={accountId} uploadedMedia={ad.uploadedMedia} onUploadedMediaChange={(uploadedMedia) => onAdChange({ uploadedMedia })} error={errorFor("media")} />
          ) : (
            <>
              <ContentSourcePicker accountId={accountId} sourceType={ad.sourceType} selectedSourceId={ad.selectedSource?.id ?? null} onSourceSelected={applyChosenSource} />
              {errorFor("source") ? (
                <p className={styles.error} role="alert">
                  {errorFor("source")}
                </p>
              ) : null}
            </>
          )}
        </div>
        <SelectField label="Format" value={ad.format} options={(Object.keys(creativeFormatLabels) as CreativeFormat[]).map((format) => ({ value: format, label: creativeFormatLabels[format] }))} onValueChange={(format) => onAdChange({ format })} />
        <TextField label="Headline" value={ad.headline} onValueChange={(headline) => onAdChange({ headline })} error={errorFor("headline")} hint={`${ad.headline.length}/${headlineMaximumLength}`} />
        <TextAreaField label="Primary text" value={ad.primaryText} onValueChange={(primaryText) => onAdChange({ primaryText })} maximumLength={primaryTextMaximumLength} error={errorFor("primaryText")} rows={4} />
        <div className={styles.twoColumns}>
          <SelectField label="Button" value={ad.callToAction} options={(Object.keys(callToActionLabels) as CallToAction[]).map((callToAction) => ({ value: callToAction, label: callToActionLabels[callToAction] }))} onValueChange={(callToAction) => onAdChange({ callToAction })} />
          <SelectField label="Button opens" value={ad.destinationType} options={(Object.keys(destinationLabels) as DestinationType[]).map((destinationType) => ({ value: destinationType, label: destinationLabels[destinationType] }))} onValueChange={(destinationType) => onAdChange({ destinationType })} />
        </div>
        {ad.destinationType === "url" ? <TextField label="Website address" type="url" placeholder="https://" value={ad.destinationUrl} onValueChange={(destinationUrl) => onAdChange({ destinationUrl })} error={errorFor("destinationUrl")} hint="Only secure https:// links are allowed." /> : null}
      </div>
      <aside className={styles.previewColumn} aria-label="Ad preview">
        <p className={styles.fieldLabel}>Preview</p>
        <AdPreviewWithSurfaceSwitcher creative={buildPreviewCreativeFromAdDraft(ad, account)} availablePlacements={placements} />
        <p className={styles.muted}>Shown the way people see it in the Zudomart app.</p>
      </aside>
    </div>
  );
}
