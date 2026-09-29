import { AudienceBuilder } from "@/components/audience/audienceBuilder";
import type { WizardFieldChanges } from "@/components/campaignWizard/campaignWizardState.store";
import type { WizardStepProps } from "@/components/campaignWizard/wizardStepProps.type";
import { CheckboxField, SegmentedControl, TextField } from "@/components/ui/formFields";
import { placementOptions } from "@/constants/campaignOptions.constant";
import type { AdPlacement, PlacementMode } from "@/types/campaign.type";

import styles from "./wizardSteps.module.css";

const placementModeOptions: readonly { readonly value: PlacementMode; readonly label: string }[] = [
  { value: "automatic", label: "Automatic (recommended)" },
  { value: "manual", label: "Choose placements" },
];

export function AudiencePlacementStep({ state, dispatch, errors, accountId }: WizardStepProps) {
  const updateFields = (changes: WizardFieldChanges) => dispatch({ type: "update_fields", changes });
  function togglePlacement(placement: AdPlacement, isChecked: boolean) {
    const nextPlacements = isChecked ? [...state.placements, placement] : state.placements.filter((candidate) => candidate !== placement);
    updateFields({ placements: nextPlacements });
  }
  return (
    <div className={styles.stepBody}>
      <h2 className={styles.stepHeading}>Audience and placements</h2>
      <TextField label="Ad set name" value={state.adSetName} onValueChange={(adSetName) => updateFields({ adSetName })} maxLength={120} error={errors.adSetName} fieldClassName={styles.narrowField} />
      <AudienceBuilder accountId={accountId} audience={state.audience} onAudienceChange={(audience) => updateFields({ audience })} errors={{ locations: errors.locations }} />
      <section className={styles.fieldset} aria-labelledby="placements-heading">
        <h3 id="placements-heading">Placements</h3>
        <p className={styles.stepIntro}>Automatic placements show your ads wherever they are likely to perform best across Zudomart.</p>
        <SegmentedControl label="Placement mode" value={state.placementMode} options={placementModeOptions} onValueChange={(placementMode) => updateFields({ placementMode, placements: placementMode === "manual" && state.placements.length === 6 ? ["feed", "clips"] : state.placements })} />
        {state.placementMode === "manual" ? (
          <div className={styles.placementGrid}>
            {placementOptions.map((option) => (
              <div key={option.placement} className={styles.placementOption}>
                <CheckboxField label={option.label} description={option.description} checked={state.placements.includes(option.placement)} onCheckedChange={(isChecked) => togglePlacement(option.placement, isChecked)} />
              </div>
            ))}
          </div>
        ) : null}
        {errors.placements ? (
          <p className={styles.error} role="alert">
            {errors.placements}
          </p>
        ) : null}
      </section>
    </div>
  );
}
