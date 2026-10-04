import { useDebouncedValue } from "@/hooks/useDebouncedValue.hook";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { billingApi } from "@/services/billingApi.service";
import type { CampaignCostEstimate, CampaignCostEstimateRequest, EstimateRange } from "@/types/billing.type";
import { formatMoneyForDisplay } from "@/utils/money.util";
import { formatWholeCount } from "@/utils/numberFormatting.util";

import styles from "./campaignCostEstimatePanel.module.css";

const resultLabels: Record<CampaignCostEstimate["resultKind"], string> = { reach: "People reached", clicks: "Clicks", video_views: "Video views", follows: "Follows", messages: "Messages" };

interface CampaignCostEstimatePanelProps {
  readonly countryCodes: readonly string[];
  readonly currency: string;
  readonly budgetType: "daily" | "lifetime";
  readonly budgetAmountMinor: number | null;
  readonly startAtLocal: string;
  readonly endAtLocal: string;
  readonly objective: string | null;
}

const formatRange = (range: EstimateRange) => (range.low === range.high ? formatWholeCount(range.low) : `${formatWholeCount(range.low)}–${formatWholeCount(range.high)}`);

function toIsoOrUndefined(localDateTime: string): string | undefined {
  const parsed = new Date(localDateTime);
  return localDateTime && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : undefined;
}

export function CampaignCostEstimatePanel({ countryCodes, currency, budgetType, budgetAmountMinor, startAtLocal, endAtLocal, objective }: CampaignCostEstimatePanelProps) {
  const requestKey = useDebouncedValue(
    JSON.stringify({ countries: countryCodes, currency, budget: { type: budgetType, amountMinor: budgetAmountMinor ?? 0 }, startAt: toIsoOrUndefined(startAtLocal), endAt: toIsoOrUndefined(endAtLocal), objective: objective ?? "traffic" }),
    400,
  );
  const estimate = useAdsQuery(() => billingApi.estimateCampaignCost(JSON.parse(requestKey) as CampaignCostEstimateRequest), `cost-estimate-${requestKey}`);
  const money = (amountMinor: number) => formatMoneyForDisplay({ amountMinor, currency: estimate.data?.billingCurrency ?? currency });
  const moneyRange = (range: EstimateRange) => (range.low === range.high ? money(range.low) : `${money(range.low)}–${money(range.high)}`);
  const data = estimate.data;
  return (
    <section className={styles.panel} aria-labelledby="cost-estimate-heading" aria-busy={estimate.isLoading}>
      <h3 id="cost-estimate-heading" className={styles.heading}>Cost and results before you launch</h3>
      {estimate.errorMessage ? <p className={styles.warning}>{estimate.errorMessage}</p> : null}
      {data ? (
        <div aria-live="polite">
          <p className={styles.muted}>
            {data.days} {data.days === 1 ? "day" : "days"}{endAtLocal ? "" : " (no end date: shown for 7 days)"}. Minimum daily budget for the regions you target: {money(data.minimumDailyBudgetMinor)}. Suggested: {money(data.suggestedDailyBudgetMinor)} a day or {money(data.suggestedLifetimeBudgetMinor)} for the whole schedule.
          </p>
          {data.belowMinimum ? <p className={styles.warning}>Your daily budget is below the minimum, so the campaign can&apos;t launch yet.</p> : null}
          <dl className={styles.totals}>
            <div><dt>Total cost</dt><dd>{money(data.totalCostMinor)}</dd></div>
            <div><dt>Impressions</dt><dd>{formatRange(data.impressions)}</dd></div>
            <div><dt>Reach</dt><dd>{formatRange(data.reach)}</dd></div>
            <div><dt>Clicks</dt><dd>{formatRange(data.clicks)}</dd></div>
            <div><dt>{resultLabels[data.resultKind]}</dt><dd>{formatRange(data.results)}</dd></div>
            <div><dt>Cost per result</dt><dd>{moneyRange(data.costPerResultMinor)}</dd></div>
          </dl>
          {data.regions.length > 1 ? (
            <div className={styles.tableScroller}>
              <table className={styles.regionTable}>
                <caption className="visuallyHidden">Estimated results per region</caption>
                <thead>
                  <tr>
                    <th scope="col">Region</th>
                    <th scope="col">Budget share</th>
                    <th scope="col">Impressions</th>
                    <th scope="col">{resultLabels[data.resultKind]}</th>
                    <th scope="col">Cost per result</th>
                  </tr>
                </thead>
                <tbody>
                  {data.regions.map((region) => (
                    <tr key={region.region}>
                      <th scope="row">
                        {region.region}
                        {region.exchangeNote ? <span className={styles.muted}><br />{region.exchangeNote}</span> : null}
                      </th>
                      <td>{money(region.dailyBudgetMinor)}/day ({Math.round(region.budgetShareBps / 100)}%){region.belowRegionMinimum ? <span className={styles.warning}><br />Below this region&apos;s {money(region.minimumDailyBudgetMinor)} minimum</span> : null}</td>
                      <td>{formatRange(region.impressions)}</td>
                      <td>{formatRange(region.results)}</td>
                      <td>{moneyRange(region.costPerResultMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : data.regions[0]?.exchangeNote ? <p className={styles.muted}>{data.regions[0].exchangeNote}</p> : null}
          <p className={styles.muted}>Estimates use research-based prices for each region and are not guaranteed. Spend is charged in {data.billingCurrency}.</p>
        </div>
      ) : null}
    </section>
  );
}
