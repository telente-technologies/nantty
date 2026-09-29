import { AudienceBuilder } from "@/components/audience/audienceBuilder";
import type { WizardFieldChanges } from "@/components/campaignWizard/campaignWizardState.store";
import type { WizardStepProps } from "@/components/campaignWizard/wizardStepProps.type";
import { PlacementFormatPicker } from "@/components/campaignWizard/placementFormatPicker";
import { SegmentedControl, TextField } from "@/components/ui/formFields";
import type { PlacementMode } from "@/types/campaign.type";

import styles from "./wizardSteps.module.css";

const placementModeOptions: readonly { readonly value: PlacementMode; readonly label: string }[] = [
  { value: "automatic", label: "Automatic (recommended)" },
  { value: "manual", label: "Choose placements" },
];

export function AudiencePlacementStep({ state, dispatch, errors, accountId }: WizardStepProps) {
  const updateFields = (changes: WizardFieldChanges) => dispatch({ type: "update_fields", changes });
  return (
    <div className={styles.stepBody}>
      <h2 className={styles.stepHeading}>Audience and placements</h2>
      <TextField label="Ad set name" value={state.adSetName} onValueChange={(adSetName) => updateFields({ adSetName })} maxLength={120} error={errors.adSetName} fieldClassName={styles.narrowField} />
      <AudienceBuilder accountId={accountId} audience={state.audience} onAudienceChange={(audience) => updateFields({ audience })} errors={{ locations: errors.locations }} />
      <section className={styles.fieldset} aria-labelledby="placements-heading">
        <h3 id="placements-heading">Placements</h3>
        <p className={styles.stepIntro}>Ads take the shape of the content around them. Automatic placements run each ad in every format it fits; choose placements to limit where they appear.</p>
        <SegmentedControl label="Placement mode" value={state.placementMode} options={placementModeOptions} onValueChange={(placementMode) => updateFields({ placementMode, placements: placementMode === "manual" && state.placements.length === 6 ? ["feed", "clips", "stories"] : state.placements })} />
        <PlacementFormatPicker placementMode={state.placementMode} placements={state.placements} onPlacementsChange={(placements) => updateFields({ placements })} />
        {errors.placements ? (
          <p className={styles.error} role="alert">
            {errors.placements}
          </p>
        ) : null}
      </section>
    </div>
  );
}
