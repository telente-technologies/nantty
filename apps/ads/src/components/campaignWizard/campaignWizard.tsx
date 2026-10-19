"use client";

import { useRouter } from "next/navigation";
import { useReducer, useRef, useState } from "react";

import { createDefaultAudienceForCountry, describeAudienceInOneLine } from "@/components/audience/audienceSummary.util";
import { AdsStep } from "@/components/campaignWizard/adsStep";
import { AudienceEstimatePanel } from "@/components/campaignWizard/audienceEstimatePanel";
import { AudiencePlacementStep } from "@/components/campaignWizard/audiencePlacementStep";
import { BudgetScheduleStep } from "@/components/campaignWizard/budgetScheduleStep";
import { CampaignSettingsStep } from "@/components/campaignWizard/campaignSettingsStep";
import { createInitialWizardState, reduceCampaignWizardState, type CampaignWizardState } from "@/components/campaignWizard/campaignWizardState.store";
import { campaignWizardSteps, findStepIndexForApiIssuePath } from "@/components/campaignWizard/campaignWizardSteps.constant";
import { buildCampaignSubmissionFromWizard, readOwnDestinationTargets } from "@/components/campaignWizard/campaignWizardSubmission.util";
import { findFirstStepWithErrors, validateWizardStep, type WizardFieldErrors } from "@/components/campaignWizard/campaignWizardValidation.util";
import { ObjectiveStep } from "@/components/campaignWizard/objectiveStep";
import { ReviewStep } from "@/components/campaignWizard/reviewStep";
import { useAudienceEstimate } from "@/components/campaignWizard/useAudienceEstimate.hook";
import type { WizardStepProps } from "@/components/campaignWizard/wizardStepProps.type";
import { WizardStepper } from "@/components/campaignWizard/wizardStepper";
import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { VerificationPrompt } from "@/components/verification/verificationPrompt";
import { supportedAccountCountries } from "@/constants/locale.constant";
import { AdsApiRequestError, isVerificationRequiredError, readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import { campaignsApi } from "@/services/campaignsApi.service";
import type { AudienceSpec } from "@/types/audience.type";
import type { CampaignObjective } from "@/types/campaign.type";
import { createClientIdempotencyKey } from "@/utils/formValidation.util";

import styles from "./campaignWizard.module.css";

const stepComponents = [ObjectiveStep, CampaignSettingsStep, AudiencePlacementStep, BudgetScheduleStep, AdsStep, ReviewStep] as const;

function convertApiIssuesToFieldErrors(error: AdsApiRequestError): WizardFieldErrors {
  const fieldErrors: WizardFieldErrors = {};
  for (const issue of error.issues) {
    if (issue.path.startsWith("adSet.audience.locations")) fieldErrors.locations = issue.message;
    else if (issue.path.includes("budget")) fieldErrors.budgetAmount = issue.message;
    else if (issue.path.includes("bidStrategy")) fieldErrors.bidAmount = issue.message;
    else if (issue.path === "campaign.name") fieldErrors.campaignName = issue.message;
    else if (issue.path.includes("schedule.endAt")) fieldErrors.endAt = issue.message;
    else if (/^ads\.\d+\.creative\./.test(issue.path)) fieldErrors[issue.path.replace(".creative.", ".").replace(".mediaIds", ".media").replace(".destination.url", ".destinationUrl").replace(".destination.targetId", ".destinationTarget")] = issue.message;
    else fieldErrors[issue.path] = issue.message;
  }
  return fieldErrors;
}

function createWizardStateWithPreselectedObjective(defaultAudience: AudienceSpec, preselectedObjective: CampaignObjective | null): CampaignWizardState {
  const initialState = createInitialWizardState(defaultAudience);
  return preselectedObjective ? reduceCampaignWizardState(initialState, { type: "choose_objective", objective: preselectedObjective }) : initialState;
}

export function CampaignWizard({ preselectedObjective = null }: { readonly preselectedObjective?: CampaignObjective | null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { accountId, account, currency, canPerform, buildAccountPagePath } = useAdAccount();
  const country = supportedAccountCountries.find((candidate) => candidate.code === account.countryCode);
  const [state, dispatch] = useReducer(reduceCampaignWizardState, undefined, () => createWizardStateWithPreselectedObjective(createDefaultAudienceForCountry(account.countryCode, country?.name ?? account.countryCode), preselectedObjective));
  const [errors, setErrors] = useState<WizardFieldErrors>({});
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [submittingMode, setSubmittingMode] = useState<"draft" | "publish" | null>(null);
  const idempotencyKeyRef = useRef(createClientIdempotencyKey("campaign"));
  const headingRef = useRef<HTMLDivElement>(null);
  const estimate = useAudienceEstimate(accountId, state, currency);

  if (!canPerform("campaigns:manage")) {
    return <InlineNotice tone="caution" title="You can view campaigns but not create them.">Ask an admin of this ad account to give you the Advertiser role.</InlineNotice>;
  }

  function moveToStep(stepIndex: number) {
    setErrors({});
    dispatch({ type: "go_to_step", stepIndex });
    headingRef.current?.focus();
  }

  function continueToNextStep() {
    const stepErrors = validateWizardStep(state, state.stepIndex, currency);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    moveToStep(state.stepIndex + 1);
  }

  async function submitCampaign(submitForReview: boolean) {
    setSubmitErrorMessage(null);
    setVerificationMessage(null);
    const firstInvalidStep = findFirstStepWithErrors(state, currency);
    if (firstInvalidStep) {
      dispatch({ type: "go_to_step", stepIndex: firstInvalidStep.stepIndex });
      setErrors(firstInvalidStep.errors);
      return;
    }
    setSubmittingMode(submitForReview ? "publish" : "draft");
    try {
      const result = await campaignsApi.createCampaignWithAdSetAndAds(accountId, buildCampaignSubmissionFromWizard(state, currency, submitForReview, readOwnDestinationTargets(account)), idempotencyKeyRef.current);
      showToast(submitForReview ? "Campaign published and sent for review" : "Campaign saved as a draft");
      router.push(buildAccountPagePath(`/campaigns/${result.campaign.id}`));
    } catch (error) {
      if (error instanceof AdsApiRequestError && error.issues.length > 0) {
        const firstIssuePath = error.issues[0]?.path ?? "";
        dispatch({ type: "go_to_step", stepIndex: findStepIndexForApiIssuePath(firstIssuePath) });
        setErrors(convertApiIssuesToFieldErrors(error));
      }
      if (!(error instanceof AdsApiRequestError && error.status === 409)) idempotencyKeyRef.current = createClientIdempotencyKey("campaign");
      setSubmitErrorMessage(isVerificationRequiredError(error) ? null : readErrorMessageForDisplay(error));
      setVerificationMessage(isVerificationRequiredError(error) ? error.message : null);
    } finally {
      setSubmittingMode(null);
    }
  }

  const StepComponent = stepComponents[state.stepIndex] ?? ObjectiveStep;
  const stepProps: WizardStepProps = { state, dispatch, errors, currency, accountId };
  const isLastStep = state.stepIndex === campaignWizardSteps.length - 1;
  const showsEstimate = state.stepIndex >= 2;

  return (
    <div className={styles.wizard}>
      <PageHeader eyebrow="Campaigns" title="Create campaign" description={`Amounts are in ${currency}. You can save a draft at any time.`} actions={<ButtonLink href={buildAccountPagePath("/campaigns")} variant="ghost">Cancel</ButtonLink>} />
      <div className={showsEstimate ? `${styles.layout} ${styles.layoutWithEstimate}` : styles.layout}>
        <WizardStepper currentStepIndex={state.stepIndex} highestVisitedStepIndex={state.highestVisitedStepIndex} onStepSelected={moveToStep} />
        <div className={styles.stepColumn}>
          <div ref={headingRef} tabIndex={-1} className={styles.stepCard} aria-label={`Step ${state.stepIndex + 1} of ${campaignWizardSteps.length}: ${campaignWizardSteps[state.stepIndex]?.label ?? ""}`}>
            <StepComponent {...stepProps} />
          </div>
          {verificationMessage ? <VerificationPrompt message={verificationMessage} /> : null}
          {submitErrorMessage ? <InlineNotice tone="error" title="The campaign was not saved">{submitErrorMessage}</InlineNotice> : null}
          <div className={styles.actionBar}>
            <Button variant="ghost" iconName="arrowLeft24" disabled={state.stepIndex === 0} onClick={() => moveToStep(state.stepIndex - 1)}>
              Back
            </Button>
            <div className={styles.actionBarEnd}>
              <Button variant="secondary" isLoading={submittingMode === "draft"} disabled={submittingMode !== null || !state.objective} onClick={() => submitCampaign(false)}>
                Save draft
              </Button>
              {isLastStep ? (
                <Button variant="primary" isLoading={submittingMode === "publish"} disabled={submittingMode !== null} onClick={() => submitCampaign(true)}>
                  Publish
                </Button>
              ) : (
                <Button variant="primary" trailingIconName="caretRight24" onClick={continueToNextStep}>
                  Continue
                </Button>
              )}
            </div>
          </div>
        </div>
        {showsEstimate ? (
          <div className={styles.estimateColumn}>
            <AudienceEstimatePanel estimate={estimate.estimate} isEstimating={estimate.isEstimating} errorMessage={estimate.errorMessage} hasLocations={estimate.hasLocations} audienceSummary={describeAudienceInOneLine(state.audience)} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
