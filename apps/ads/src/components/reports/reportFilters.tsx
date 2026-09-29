"use client";

import { useMemo } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { SelectField, SwitchToggle, TextField } from "@/components/ui/formFields";
import { SearchableMultiSelect, type MultiSelectOption } from "@/components/ui/searchableMultiSelect";
import type { ReportViewState } from "@/components/reports/reportUrlState.util";
import { breakdownOptions } from "@/constants/reportOptions.constant";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { campaignsApi } from "@/services/campaignsApi.service";
import type { ReportBreakdown } from "@/types/report.type";
import { buildDateRangeFromPreset, buildPreviousPeriodForComparison, dateRangePresetLabels, formatDateRangeForDisplay, isValidIsoDate, readTodayIsoDate, type DateRangePreset } from "@/utils/dateRange.util";

import styles from "./reportsPage.module.css";

const presetOptions = (Object.keys(dateRangePresetLabels) as DateRangePreset[]).map((preset) => ({ value: preset, label: dateRangePresetLabels[preset] }));
const clickWindowOptions = [
  { value: "1", label: "1 day after click" },
  { value: "7", label: "7 days after click" },
  { value: "28", label: "28 days after click" },
] as const;
const viewWindowOptions = [
  { value: "1", label: "1 day after view" },
  { value: "0", label: "Clicks only" },
] as const;

export function ReportFilters({ state, onStateChange }: { readonly state: ReportViewState; readonly onStateChange: (next: ReportViewState) => void }) {
  const { accountId } = useAdAccount();
  const campaignsQuery = useAdsQuery(() => campaignsApi.listCampaigns(accountId), `report-campaign-options-${accountId}`);
  const campaignOptions: MultiSelectOption[] = useMemo(() => (campaignsQuery.data?.items ?? []).map((campaign) => ({ value: campaign.id, label: campaign.name })), [campaignsQuery.data]);
  const selectedCampaignOptions = state.campaignIds.map((id) => campaignOptions.find((option) => option.value === id) ?? { value: id, label: id });
  const today = readTodayIsoDate();

  function changePreset(preset: DateRangePreset) {
    if (preset === "custom") onStateChange({ ...state, preset });
    else onStateChange({ ...state, preset, ...buildDateRangeFromPreset(preset) });
  }

  function changeCustomDate(field: "from" | "to", value: string) {
    if (!isValidIsoDate(value)) return;
    const next = { ...state, preset: "custom" as const, [field]: value };
    if (next.from <= next.to) onStateChange(next);
  }

  return (
    <div className={styles.filters}>
      <div className={styles.filterRow}>
        <SelectField label="Date range" value={state.preset} onValueChange={changePreset} options={presetOptions} fieldClassName={styles.narrowField} />
        {state.preset === "custom" ? (
          <>
            <TextField label="From" type="date" value={state.from} max={today} onValueChange={(value) => changeCustomDate("from", value)} fieldClassName={styles.narrowField} />
            <TextField label="To" type="date" value={state.to} max={today} onValueChange={(value) => changeCustomDate("to", value)} fieldClassName={styles.narrowField} />
          </>
        ) : null}
        <SelectField label="Break down by" value={state.breakdown} onValueChange={(breakdown: ReportBreakdown) => onStateChange({ ...state, breakdown })} options={breakdownOptions.map((option) => ({ value: option.breakdown, label: option.label }))} fieldClassName={styles.narrowField} />
        <SelectField label="Click attribution" value={String(state.clickWindowDays) as "1" | "7" | "28"} onValueChange={(value) => onStateChange({ ...state, clickWindowDays: Number(value) as 1 | 7 | 28 })} options={clickWindowOptions} fieldClassName={styles.narrowField} />
        <SelectField label="View attribution" value={String(state.viewWindowDays) as "0" | "1"} onValueChange={(value) => onStateChange({ ...state, viewWindowDays: Number(value) as 0 | 1 })} options={viewWindowOptions} fieldClassName={styles.narrowField} />
      </div>
      <div className={styles.filterRow}>
        <div className={styles.campaignFilter}>
          <SearchableMultiSelect
            label="Campaigns"
            placeholder={state.campaignIds.length === 0 ? "All campaigns" : "Add a campaign"}
            options={campaignOptions}
            selectedOptions={selectedCampaignOptions}
            onSelectedOptionsChange={(options) => onStateChange({ ...state, campaignIds: options.map((option) => option.value) })}
            isLoading={campaignsQuery.isLoading}
          />
        </div>
        <div className={styles.compareToggle}>
          <SwitchToggle label="Compare with previous period" checked={state.isComparing} onCheckedChange={(isComparing) => onStateChange({ ...state, isComparing })} />
          {state.isComparing ? <span className={styles.compareRange}>{formatDateRangeForDisplay(buildPreviousPeriodForComparison(state))}</span> : null}
        </div>
      </div>
    </div>
  );
}
