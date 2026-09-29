import { CheckboxField } from "@/components/ui/formFields";
import { adFormatGroups } from "@/constants/adFormats.constant";
import { placementOptions } from "@/constants/campaignOptions.constant";
import type { AdPlacement, PlacementMode } from "@/types/campaign.type";

import styles from "./placementFormatPicker.module.css";

interface PlacementFormatPickerProps {
  readonly placementMode: PlacementMode;
  readonly placements: readonly AdPlacement[];
  readonly onPlacementsChange: (placements: AdPlacement[]) => void;
}

export function PlacementFormatPicker({ placementMode, placements, onPlacementsChange }: PlacementFormatPickerProps) {
  const isManual = placementMode === "manual";
  function toggleWholeFormat(formatPlacements: readonly AdPlacement[], isChecked: boolean) {
    const withoutFormat = placements.filter((placement) => !formatPlacements.includes(placement));
    onPlacementsChange(isChecked ? [...withoutFormat, ...formatPlacements] : withoutFormat);
  }
  function toggleSinglePlacement(placement: AdPlacement, isChecked: boolean) {
    onPlacementsChange(isChecked ? [...placements, placement] : placements.filter((candidate) => candidate !== placement));
  }
  return (
    <div className={styles.grid}>
      {adFormatGroups.map((format) => {
        const chosenCount = format.placements.filter((placement) => placements.includes(placement)).length;
        const isFormatOn = !isManual || chosenCount > 0;
        return (
          <fieldset key={format.group} className={isFormatOn ? `${styles.card} ${styles.cardOn}` : styles.card} disabled={!isManual}>
            <legend className="visuallyHidden">{format.label}</legend>
            {isManual ? (
              <CheckboxField label={<span className={styles.formatTitle}>{format.label}</span>} description={format.description} checked={chosenCount === format.placements.length} onCheckedChange={(isChecked) => toggleWholeFormat(format.placements, isChecked)} />
            ) : (
              <div>
                <p className={styles.formatTitle}>{format.label}</p>
                <p className={styles.description}>{format.description}</p>
              </div>
            )}
            <p className={styles.guidance}>{format.creativeGuidance}</p>
            {isManual && format.placements.length > 1 ? (
              <div className={styles.subPlacements}>
                {format.placements.map((placement) => (
                  <CheckboxField key={placement} label={placementOptions.find((option) => option.placement === placement)?.label ?? placement} checked={placements.includes(placement)} onCheckedChange={(isChecked) => toggleSinglePlacement(placement, isChecked)} />
                ))}
              </div>
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );
}
