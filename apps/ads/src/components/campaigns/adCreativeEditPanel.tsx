"use client";

import { useEffect, useState } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/feedback";
import { SelectField, TextAreaField, TextField } from "@/components/ui/formFields";
import { OverlayDialog } from "@/components/ui/overlayDialog";
import { useToast } from "@/components/ui/toastProvider";
import { callToActionLabels, headlineMaximumLength, primaryTextMaximumLength } from "@/constants/campaignOptions.constant";
import { campaignsApi } from "@/services/campaignsApi.service";
import { AdsApiRequestError, readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { Ad } from "@/types/campaign.type";
import type { CallToAction, CreativeInput } from "@/types/creative.type";
import { validateRequiredText, type FieldErrors } from "@/utils/formValidation.util";

type CreativeField = "name" | "headline" | "primaryText";

function buildCreativeInputFromAd(ad: Ad, changes: Pick<CreativeInput, "headline" | "primaryText" | "callToAction">): CreativeInput {
  const { creative } = ad;
  return {
    type: creative.type ?? "single",
    mediaClickable: creative.mediaClickable ?? false,
    cards: (creative.cards ?? []).map((card) => ({ mediaId: card.media.id, headline: card.headline, description: card.description, callToAction: card.callToAction, destination: card.destination })),
    app: creative.app ?? null,
    format: creative.format,
    source: creative.source,
    mediaIds: creative.source.type === "upload" ? creative.media.map((media) => media.id) : [],
    destination: creative.destination,
    ...changes,
  };
}

export function AdCreativeEditPanel({ ad, isOpen, onClose, onSaved }: { readonly ad: Ad; readonly isOpen: boolean; readonly onClose: () => void; readonly onSaved: (ad: Ad) => void }) {
  const { accountId } = useAdAccount();
  const { showToast } = useToast();
  const [name, setName] = useState(ad.name);
  const [headline, setHeadline] = useState(ad.creative.headline);
  const [primaryText, setPrimaryText] = useState(ad.creative.primaryText);
  const [callToAction, setCallToAction] = useState<CallToAction>(ad.creative.callToAction);
  const [errors, setErrors] = useState<FieldErrors<CreativeField>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(ad.name);
    setHeadline(ad.creative.headline);
    setPrimaryText(ad.creative.primaryText);
    setCallToAction(ad.creative.callToAction);
    setErrors({});
  }, [isOpen, ad]);

  async function validateAndSaveCreative() {
    const nextErrors: FieldErrors<CreativeField> = {
      name: validateRequiredText(name, "Ad name", 120),
      headline: validateRequiredText(headline, "Headline", headlineMaximumLength),
      primaryText: primaryText.trim().length > primaryTextMaximumLength ? `Primary text can be at most ${primaryTextMaximumLength} characters.` : undefined,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setIsSaving(true);
    try {
      const saved = await campaignsApi.updateAd(accountId, ad.id, { name: name.trim(), creative: buildCreativeInputFromAd(ad, { headline: headline.trim(), primaryText: primaryText.trim(), callToAction }) });
      showToast(saved.status === "in_review" ? "Saved and sent for review." : "Ad saved.");
      onSaved(saved);
      onClose();
    } catch (error) {
      if (error instanceof AdsApiRequestError) setErrors({ headline: error.issues.find((issue) => issue.path.endsWith("headline"))?.message, primaryText: error.issues.find((issue) => issue.path.endsWith("primaryText"))?.message });
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <OverlayDialog
      isOpen={isOpen}
      onClose={onClose}
      layout="sidePanel"
      title="Edit ad"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={isSaving} onClick={validateAndSaveCreative}>
            {ad.status === "draft" ? "Save changes" : "Save and send for review"}
          </Button>
        </>
      }
    >
      {ad.status !== "draft" ? <InlineNotice tone="caution">Changing the text sends the ad for review again. It stops delivering until it is approved.</InlineNotice> : null}
      <TextField label="Ad name" hint="Only you and your team see this." value={name} onValueChange={setName} maxLength={120} error={errors.name} />
      <TextField label="Headline" value={headline} onValueChange={setHeadline} maxLength={headlineMaximumLength} error={errors.headline} hint={`${headline.length}/${headlineMaximumLength}`} />
      <TextAreaField label="Primary text" value={primaryText} onValueChange={setPrimaryText} maximumLength={primaryTextMaximumLength} error={errors.primaryText} rows={5} />
      <SelectField<CallToAction> label="Button" value={callToAction} onValueChange={setCallToAction} options={(Object.keys(callToActionLabels) as CallToAction[]).map((value) => ({ value, label: callToActionLabels[value] }))} />
    </OverlayDialog>
  );
}
