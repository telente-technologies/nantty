import { describeAudienceInOneLine } from "@/components/audience/audienceSummary.util";
import { buildBidStrategyFromWizard, buildBudgetFromWizard, buildPreviewCreativeFromAdDraft, readChosenPlacements } from "@/components/campaignWizard/campaignWizardSubmission.util";
import type { WizardStepProps } from "@/components/campaignWizard/wizardStepProps.type";
import { AdPreview } from "@/components/creative/adPreview";
import { useAdAccount } from "@/components/session/adAccountProvider";
import { Card, KeyValueList } from "@/components/ui/surfaces";
import { bidStrategyOptions, callToActionLabels, findObjectiveOption, placementLabels } from "@/constants/campaignOptions.constant";
import { formatDateAndTime } from "@/utils/dateRange.util";
import { formatMoneyForDisplay, parseTypedMajorAmountToMoney } from "@/utils/money.util";

import styles from "./wizardSteps.module.css";

export function ReviewStep({ state, dispatch, currency }: WizardStepProps) {
  const { account } = useAdAccount();
  const budget = buildBudgetFromWizard(state, currency);
  const bidStrategy = buildBidStrategyFromWizard(state, currency);
  const spendCap = state.spendCapText.trim() ? parseTypedMajorAmountToMoney(state.spendCapText, currency) : null;
  const editButton = (stepIndex: number, label: string) => (
    <button type="button" className={styles.editLink} onClick={() => dispatch({ type: "go_to_step", stepIndex })} aria-label={`Edit ${label}`}>
      Edit
    </button>
  );
  return (
    <div className={styles.stepBody}>
      <h2 className={styles.stepHeading}>Review and publish</h2>
      <p className={styles.stepIntro}>Publishing sends your ads for review against the advertising policies, usually within a few hours. Nothing is charged until ads are approved and delivering.</p>
      <div className={styles.reviewGrid}>
        <Card title="Campaign" actions={editButton(1, "campaign")}>
          <KeyValueList
            items={[
              { label: "Name", value: state.campaignName },
              { label: "Objective", value: state.objective ? findObjectiveOption(state.objective).label : "—" },
              { label: "Budget", value: budget ? `${formatMoneyForDisplay(budget.amount)} ${budget.type === "daily" ? "per day" : "lifetime"} · ${state.budgetLevel === "campaign" ? "campaign level" : "ad set level"}` : "—" },
              { label: "Spend cap", value: spendCap ? formatMoneyForDisplay(spendCap) : "None" },
              { label: "Schedule", value: `${state.startAtLocal ? formatDateAndTime(new Date(state.startAtLocal).toISOString()) : "—"} → ${state.endAtLocal ? formatDateAndTime(new Date(state.endAtLocal).toISOString()) : "until paused"}` },
            ]}
          />
        </Card>
        <Card title="Ad set" actions={editButton(2, "ad set")}>
          <KeyValueList
            items={[
              { label: "Name", value: state.adSetName },
              { label: "Audience", value: describeAudienceInOneLine(state.audience) },
              { label: "Detailed targeting", value: `${state.audience.topicIds.length} interests · ${state.audience.behaviourIds.length} behaviours · ${state.audience.customAudienceIds.length} custom` },
              { label: "Placements", value: state.placementMode === "automatic" ? "Automatic" : readChosenPlacements(state).map((placement) => placementLabels[placement]).join(", ") },
              { label: "Bid", value: `${bidStrategyOptions.find((option) => option.type === bidStrategy.type)?.label ?? ""}${bidStrategy.amount ? ` · ${formatMoneyForDisplay(bidStrategy.amount)}` : ""}` },
              { label: "Frequency cap", value: state.isFrequencyCapEnabled ? `${state.frequencyImpressionsText} per ${state.frequencyPerDaysText} days` : "None" },
            ]}
          />
        </Card>
      </div>
      <Card title={`Ads (${state.ads.length})`} actions={editButton(4, "ads")}>
        <ul className={styles.reviewAds}>
          {state.ads.map((ad) => (
            <li key={ad.key} className={styles.reviewAd}>
              <div className={styles.reviewPreview}>
                <AdPreview creative={buildPreviewCreativeFromAdDraft(ad, account)} />
              </div>
              <p className={styles.reviewAdName}>{ad.name}</p>
              <p className={styles.reviewAdMeta}>{callToActionLabels[ad.callToAction]}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
