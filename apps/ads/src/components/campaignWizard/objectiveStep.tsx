import type { WizardStepProps } from "@/components/campaignWizard/wizardStepProps.type";
import { objectiveOptions, type ObjectiveOption } from "@/constants/campaignOptions.constant";

import styles from "./wizardSteps.module.css";

const groupLabels: Record<ObjectiveOption["group"], string> = { awareness: "Awareness", consideration: "Consideration", conversion: "Conversion" };

export function ObjectiveStep({ state, dispatch, errors }: WizardStepProps) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.stepHeading}>What should this campaign achieve?</legend>
      <p className={styles.stepIntro}>The objective decides how delivery is optimised and which result you pay attention to. It cannot be changed after publishing.</p>
      {errors.objective ? (
        <p className={styles.error} role="alert">
          {errors.objective}
        </p>
      ) : null}
      {(["awareness", "consideration", "conversion"] as const).map((group) => (
        <div key={group} className={styles.objectiveGroup}>
          <p className={styles.groupLabel}>{groupLabels[group]}</p>
          <div className={styles.objectiveGrid}>
            {objectiveOptions
              .filter((option) => option.group === group)
              .map((option) => (
                <label key={option.objective} className={state.objective === option.objective ? `${styles.choiceCard} ${styles.choiceCardSelected}` : styles.choiceCard}>
                  <input type="radio" name="objective" value={option.objective} checked={state.objective === option.objective} onChange={() => dispatch({ type: "choose_objective", objective: option.objective })} className={styles.choiceRadio} />
                  <span className={styles.choiceTitle}>{option.label}</span>
                  <span className={styles.choiceDescription}>{option.description}</span>
                  <span className={styles.choiceMeta}>Result: {option.resultLabel}</span>
                </label>
              ))}
          </div>
        </div>
      ))}
    </fieldset>
  );
}
