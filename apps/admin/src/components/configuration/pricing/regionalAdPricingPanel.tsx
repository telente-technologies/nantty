"use client";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { configurationDocumentEndpoint } from "@/services/configurationApi.service";
import type { AdRegionPricing, CreatorSubscriptionBand, PricingRegionCode, RegionalPricingDocument } from "@/types/regionalPricing.type";

import { MoneyAmountField } from "../shared/configurationFields";
import { VersionedDocumentSection } from "../shared/versionedDocumentSection";
import styles from "./regionalPricing.module.css";

const regionalPricingEndpoint = configurationDocumentEndpoint<"regional-pricing">();
type AdAmountKey = "cpmFloorMinor" | "suggestedCpmMinor" | "cpcFloorMinor" | "suggestedCpcMinor" | "suggestedCpvMinor" | "minimumDailyBudgetMinor" | "suggestedDailyBudgetMinor" | "boostMinimumDailyMinor";
const adColumns: readonly { readonly key: AdAmountKey; readonly label: string }[] = [
  { key: "cpmFloorMinor", label: "CPM floor" },
  { key: "suggestedCpmMinor", label: "Suggested CPM" },
  { key: "cpcFloorMinor", label: "CPC floor" },
  { key: "suggestedCpcMinor", label: "Suggested CPC" },
  { key: "suggestedCpvMinor", label: "Suggested cost per view" },
  { key: "minimumDailyBudgetMinor", label: "Minimum daily budget" },
  { key: "suggestedDailyBudgetMinor", label: "Suggested daily budget" },
  { key: "boostMinimumDailyMinor", label: "Boost minimum per day" },
];

export function RegionalAdPricingPanel() {
  const { can } = useAdminPermissions();
  return (
    <VersionedDocumentSection<RegionalPricingDocument>
      endpoint={regionalPricingEndpoint}
      recordId="regional-pricing"
      title="Ads, boosts and creator subscription bands"
      canWrite={can("config:revenue")}
      renderEditor={(content, updateContent, canWrite) => {
        const updateAdRow = (region: PricingRegionCode, key: AdAmountKey, amountMinor: number) =>
          updateContent((current) => ({ ...current, ads: current.ads.map((row): AdRegionPricing => (row.region === region ? { ...row, [key]: amountMinor } : row)) }));
        const updateBand = (region: PricingRegionCode, index: number, key: "webMinor" | "appMinor", amountMinor: number) =>
          updateContent((current) => ({
            ...current,
            creatorSubscriptionBands: { ...current.creatorSubscriptionBands, [region]: (current.creatorSubscriptionBands[region] ?? []).map((band, bandIndex): CreatorSubscriptionBand => (bandIndex === index ? { ...band, [key]: amountMinor } : band)) },
          }));
        return (
          <div className={styles.sections}>
            <p className={styles.note}>Floors apply to the region a campaign targets and are converted into the advertiser&apos;s billing currency with the currency module&apos;s rates. Several targeted regions use the strictest floor. Floors sit just under the cheapest incumbent's low end and suggested bids at about 70–80% of Meta's typical price (research in docs/pricing.md §5). Boost packages are the boost minimum × 1, 3, 7 and 15.</p>
            <div className={styles.tableScroller}>
              <table className={styles.priceTable}>
                <caption className="visuallyHidden">Ad floors and minimum budgets per region</caption>
                <thead>
                  <tr>
                    <th scope="col">Region</th>
                    {adColumns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {content.ads.map((row) => (
                    <tr key={row.region}>
                      <th scope="row">{row.region} · {row.currency}</th>
                      {adColumns.map((column) => (
                        <td key={column.key}>
                          <MoneyAmountField label={`${column.label} in ${row.region}`} isLabelHidden currency={row.currency} money={{ amountMinor: row[column.key], currency: row.currency }} isDisabled={!canWrite} onChange={(money) => updateAdRow(row.region, column.key, money?.amountMinor ?? 0)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.note}>Creator subscription bands are suggestions a creator picks from. The creator keeps 80% of net after the store or payment processing fee in every region.</p>
            <div className={styles.tableScroller}>
              <table className={styles.priceTable}>
                <caption className="visuallyHidden">Creator subscription bands per region</caption>
                <thead>
                  <tr>
                    <th scope="col">Region</th>
                    <th scope="col">Band</th>
                    <th scope="col">Web</th>
                    <th scope="col">App</th>
                  </tr>
                </thead>
                <tbody>
                  {content.ads.flatMap((adRow) =>
                    (content.creatorSubscriptionBands[adRow.region] ?? []).map((band, index) => (
                      <tr key={`${adRow.region}-${band.band}`}>
                        <th scope="row">{index === 0 ? `${adRow.region} · ${adRow.currency}` : ""}</th>
                        <td>{band.band}</td>
                        <td><MoneyAmountField label={`${band.band} web price in ${adRow.region}`} isLabelHidden currency={adRow.currency} money={{ amountMinor: band.webMinor, currency: adRow.currency }} isDisabled={!canWrite} onChange={(money) => updateBand(adRow.region, index, "webMinor", money?.amountMinor ?? 0)} /></td>
                        <td><MoneyAmountField label={`${band.band} app price in ${adRow.region}`} isLabelHidden currency={adRow.currency} money={{ amountMinor: band.appMinor, currency: adRow.currency }} isDisabled={!canWrite} onChange={(money) => updateBand(adRow.region, index, "appMinor", money?.amountMinor ?? 0)} /></td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      }}
    />
  );
}
