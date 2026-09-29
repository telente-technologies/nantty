import type { Dispatch } from "react";

import type { CampaignWizardAction, CampaignWizardState } from "@/components/campaignWizard/campaignWizardState.store";
import type { WizardFieldErrors } from "@/components/campaignWizard/campaignWizardValidation.util";

export interface WizardStepProps {
  readonly state: CampaignWizardState;
  readonly dispatch: Dispatch<CampaignWizardAction>;
  readonly errors: WizardFieldErrors;
  readonly currency: string;
  readonly accountId: string;
}
