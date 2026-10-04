import { campaignNameMaximumLength, headlineMaximumLength, primaryTextMaximumLength } from "@/constants/campaignOptions.constant";
import type { CampaignWizardState, WizardAdDraft } from "@/components/campaignWizard/campaignWizardState.store";
import { buildCreativeShapeFromAdDraft, readChosenPlacements } from "@/components/campaignWizard/campaignWizardSubmission.util";
import type { AdPlacement } from "@/types/campaign.type";
import { describeWhyCreativeCannotRunAnywhere } from "@/utils/adPlacementRules.util";
import { validateAppInstallFields, validateCarouselFields } from "@/utils/adCreativeFormats.util";
import { buildAppFromDraft, buildCreativeInputFromAdDraft } from "@/components/campaignWizard/campaignWizardSubmission.util";
import { isSafeHttpsUrl } from "@/utils/formValidation.util";
import { parseTypedMajorAmountToMoney } from "@/utils/money.util";

export type WizardFieldErrors = Record<string, string>;

function validateAdDraft(ad: WizardAdDraft, index: number, placements: readonly AdPlacement[], errors: WizardFieldErrors): void {
  const prefix = `ads.${index}`;
  const usesContentSource = ad.creativeType === "single" || ad.creativeType === "promoted_post";
  if (ad.creativeType === "carousel") {
    for (const [field, message] of Object.entries(validateCarouselFields(buildCreativeInputFromAdDraft(ad).cards))) errors[`${prefix}.${field}`] = message;
  }
  if (ad.creativeType === "app_install") {
    for (const [field, message] of Object.entries(validateAppInstallFields(buildAppFromDraft(ad.app)))) errors[`${prefix}.${field}`] = message;
    if (ad.uploadedMedia.length === 0) errors[`${prefix}.media`] = "Upload an image or video for the ad.";
  }
  if (ad.creativeType === "promoted_post" && ad.sourceType !== "post" && ad.sourceType !== "clip") errors[`${prefix}.source`] = "Promote an existing post or clip.";
  if (usesContentSource && ad.sourceType === "upload" && ad.uploadedMedia.length === 0) errors[`${prefix}.media`] = "Upload at least one image or video.";
  if (usesContentSource && ad.sourceType !== "upload" && !ad.selectedSource) errors[`${prefix}.source`] = "Choose a post, clip, product or store to promote.";
  if (!ad.headline.trim()) errors[`${prefix}.headline`] = "Add a headline.";
  if (ad.headline.trim().length > headlineMaximumLength) errors[`${prefix}.headline`] = `Keep the headline under ${headlineMaximumLength} characters.`;
  if (ad.primaryText.trim().length > primaryTextMaximumLength) errors[`${prefix}.primaryText`] = `Keep the text under ${primaryTextMaximumLength} characters.`;
  if (ad.creativeType === "single" && ad.destinationType === "url" && !isSafeHttpsUrl(ad.destinationUrl.trim())) errors[`${prefix}.destinationUrl`] = "Enter a full https:// website address.";
  const hasCreative = ad.creativeType === "carousel" ? ad.cards.some((card) => card.media) : ad.sourceType === "upload" ? ad.uploadedMedia.length > 0 : Boolean(ad.selectedSource);
  const placementProblem = hasCreative ? describeWhyCreativeCannotRunAnywhere(buildCreativeShapeFromAdDraft(ad), placements) : null;
  if (placementProblem) errors[`${prefix}.placements`] = placementProblem;
}

export function validateWizardStep(state: CampaignWizardState, stepIndex: number, currency: string): WizardFieldErrors {
  const errors: WizardFieldErrors = {};
  if (stepIndex === 0 && !state.objective) errors.objective = "Choose what you want this campaign to achieve.";
  if (stepIndex === 1) {
    if (!state.campaignName.trim()) errors.campaignName = "Name the campaign.";
    if (state.campaignName.trim().length > campaignNameMaximumLength) errors.campaignName = `Keep the name under ${campaignNameMaximumLength} characters.`;
    if (state.spendCapText.trim() && !parseTypedMajorAmountToMoney(state.spendCapText, currency)?.amountMinor) errors.spendCap = "Enter a spend cap amount, or leave it empty.";
  }
  if (stepIndex === 2) {
    if (!state.adSetName.trim()) errors.adSetName = "Name the ad set.";
    if (state.audience.locations.length === 0) errors.locations = "Add at least one country, state or city.";
    if (state.placementMode === "manual" && state.placements.length === 0) errors.placements = "Choose at least one placement.";
  }
  if (stepIndex === 3) {
    const budget = parseTypedMajorAmountToMoney(state.budgetAmountText, currency);
    if (!budget || budget.amountMinor <= 0) errors.budgetAmount = "Enter a budget.";
    if (!state.startAtLocal) errors.startAt = "Choose when delivery starts.";
    if (state.budgetType === "lifetime" && !state.endAtLocal) errors.endAt = "A lifetime budget needs an end date.";
    if (state.endAtLocal && state.startAtLocal && new Date(state.endAtLocal) <= new Date(state.startAtLocal)) errors.endAt = "The end must be after the start.";
    if (state.bidType !== "auto" && !parseTypedMajorAmountToMoney(state.bidAmountText, currency)?.amountMinor) errors.bidAmount = "Enter your bid amount.";
    if (state.isFrequencyCapEnabled) {
      const impressions = Number(state.frequencyImpressionsText);
      const perDays = Number(state.frequencyPerDaysText);
      if (!Number.isInteger(impressions) || impressions < 1 || impressions > 20 || !Number.isInteger(perDays) || perDays < 1 || perDays > 30) errors.frequencyCap = "Use 1–20 impressions per 1–30 days.";
    }
  }
  if (stepIndex === 4) state.ads.forEach((ad, index) => validateAdDraft(ad, index, readChosenPlacements(state), errors));
  return errors;
}

export function findFirstStepWithErrors(state: CampaignWizardState, currency: string): { stepIndex: number; errors: WizardFieldErrors } | null {
  for (let stepIndex = 0; stepIndex <= 4; stepIndex += 1) {
    const errors = validateWizardStep(state, stepIndex, currency);
    if (Object.keys(errors).length > 0) return { stepIndex, errors };
  }
  return null;
}
