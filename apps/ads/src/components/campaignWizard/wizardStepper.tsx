import { campaignWizardSteps } from "@/components/campaignWizard/campaignWizardSteps.constant";
import { NanttyIcon } from "@/components/ui/nanttyIcon";

import styles from "./campaignWizard.module.css";

interface WizardStepperProps {
  readonly currentStepIndex: number;
  readonly highestVisitedStepIndex: number;
  readonly onStepSelected: (stepIndex: number) => void;
}

export function WizardStepper({ currentStepIndex, highestVisitedStepIndex, onStepSelected }: WizardStepperProps) {
  return (
    <nav aria-label="Campaign steps" className={styles.stepper}>
      <ol>
        {campaignWizardSteps.map((step, index) => {
          const isCurrent = index === currentStepIndex;
          const isComplete = index < currentStepIndex || (index <= highestVisitedStepIndex && index !== currentStepIndex);
          const isReachable = index <= highestVisitedStepIndex;
          return (
            <li key={step.key}>
              <button
                type="button"
                className={[styles.stepButton, isCurrent ? styles.stepCurrent : "", isComplete ? styles.stepComplete : ""].join(" ")}
                aria-current={isCurrent ? "step" : undefined}
                disabled={!isReachable}
                onClick={() => onStepSelected(index)}
              >
                <span className={styles.stepMarker} aria-hidden>
                  {isComplete && !isCurrent ? <NanttyIcon name="check16" size={12} /> : index + 1}
                </span>
                <span className={styles.stepText}>
                  <span className={styles.stepLabel}>{step.label}</span>
                  <span className={styles.stepDescription}>{step.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
