"use client";

import { useEffect, useMemo, useState } from "react";

import { buildEstimateRequestFromWizard } from "@/components/campaignWizard/campaignWizardSubmission.util";
import type { CampaignWizardState } from "@/components/campaignWizard/campaignWizardState.store";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.hook";
import { audiencesApi } from "@/services/audiencesApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { AudienceEstimate } from "@/types/audience.type";

export function useAudienceEstimate(accountId: string, state: CampaignWizardState, currency: string) {
  const requestText = useMemo(() => JSON.stringify(buildEstimateRequestFromWizard(state, currency)), [state, currency]);
  const debouncedRequestText = useDebouncedValue(requestText, 500);
  const [estimate, setEstimate] = useState<AudienceEstimate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const hasLocations = state.audience.locations.length > 0;

  useEffect(() => {
    if (!hasLocations) {
      setEstimate(null);
      return;
    }
    const abortController = new AbortController();
    setIsEstimating(true);
    setErrorMessage(null);
    audiencesApi
      .estimateAudience(accountId, JSON.parse(debouncedRequestText), abortController.signal)
      .then((result) => setEstimate(result))
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) setErrorMessage(readErrorMessageForDisplay(error));
      })
      .finally(() => {
        if (!abortController.signal.aborted) setIsEstimating(false);
      });
    return () => abortController.abort();
  }, [accountId, debouncedRequestText, hasLocations]);

  return { estimate, errorMessage, isEstimating: isEstimating || requestText !== debouncedRequestText, hasLocations };
}
