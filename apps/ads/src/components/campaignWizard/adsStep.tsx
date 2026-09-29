import { CreativeEditor } from "@/components/campaignWizard/creativeEditor";
import { readChosenPlacements } from "@/components/campaignWizard/campaignWizardSubmission.util";
import type { WizardStepProps } from "@/components/campaignWizard/wizardStepProps.type";
import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";

import styles from "./wizardSteps.module.css";

export function AdsStep({ state, dispatch, errors, accountId }: WizardStepProps) {
  const { account } = useAdAccount();
  const selectedAdIndex = Math.max(0, state.ads.findIndex((ad) => ad.key === state.selectedAdKey));
  const selectedAd = state.ads[selectedAdIndex];
  return (
    <div className={styles.stepBody}>
      <h2 className={styles.stepHeading}>Ads</h2>
      <p className={styles.stepIntro}>Add up to 6 ads. Delivery favours the ones that perform best.</p>
      <div className={styles.adTabs} role="tablist" aria-label="Ads in this ad set">
        {state.ads.map((ad, index) => {
          const hasErrors = Object.keys(errors).some((key) => key.startsWith(`ads.${index}.`));
          return (
            <div key={ad.key} className={ad.key === state.selectedAdKey ? `${styles.adTab} ${styles.adTabSelected}` : styles.adTab}>
              <button type="button" role="tab" aria-selected={ad.key === state.selectedAdKey} className={styles.adTabButton} onClick={() => dispatch({ type: "select_ad", adKey: ad.key })}>
                {ad.name || `Ad ${index + 1}`}
                {hasErrors ? <span className={styles.adTabError}> · needs attention</span> : null}
              </button>
              {state.ads.length > 1 ? (
                <button type="button" className={styles.adTabRemove} aria-label={`Remove ${ad.name}`} onClick={() => dispatch({ type: "remove_ad", adKey: ad.key })}>
                  ×
                </button>
              ) : null}
            </div>
          );
        })}
        <Button size="small" variant="ghost" iconName="plus16" disabled={state.ads.length >= 6} onClick={() => dispatch({ type: "add_ad" })}>
          Add ad
        </Button>
      </div>
      {selectedAd ? (
        <div role="tabpanel">
          <CreativeEditor key={selectedAd.key} accountId={accountId} account={account} ad={selectedAd} adIndex={selectedAdIndex} placements={readChosenPlacements(state)} errors={errors} onAdChange={(changes) => dispatch({ type: "update_ad", adKey: selectedAd.key, changes })} />
        </div>
      ) : null}
    </div>
  );
}
