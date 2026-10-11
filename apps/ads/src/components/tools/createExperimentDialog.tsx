"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineNotice, LoadingBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { OverlayDialog } from "@/components/ui/overlayDialog";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { campaignsApi } from "@/services/campaignsApi.service";
import { toolsApi } from "@/services/toolsApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { ExperimentMetric, ExperimentVariable } from "@/types/tools.type";
import { addDaysToIsoDate, countDaysInRangeInclusive, readTodayIsoDate } from "@/utils/dateRange.util";

import { experimentMetricLabels, experimentVariableLabels } from "./toolLabels.constant";
import styles from "./toolsPage.module.css";

const minimumExperimentDays = 4;

function splitTrafficEvenly(adSetIds: readonly string[]): Record<string, number> {
  const share = Math.floor(100 / Math.max(adSetIds.length, 1));
  return Object.fromEntries(adSetIds.map((adSetId, index) => [adSetId, index === 0 ? 100 - share * (adSetIds.length - 1) : share]));
}

export function CreateExperimentDialog({ accountId, onClose, onCreated }: { readonly accountId: string; readonly onClose: () => void; readonly onCreated: () => void }) {
  const campaignsQuery = useAdsQuery(() => campaignsApi.listCampaigns(accountId), accountId);
  const eligibleCampaigns = (campaignsQuery.data?.items ?? []).filter((campaign) => campaign.adSetCount >= 2 && campaign.status !== "completed" && campaign.status !== "rejected");
  const [campaignId, setCampaignId] = useState("");
  const effectiveCampaignId = campaignId || eligibleCampaigns[0]?.id || "";
  const adSetsQuery = useAdsQuery(() => campaignsApi.listAdSets(accountId, { campaignId: effectiveCampaignId }), `${accountId}:${effectiveCampaignId}`, Boolean(effectiveCampaignId));
  const [trafficByAdSetId, setTrafficByAdSetId] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [variable, setVariable] = useState<ExperimentVariable>("audience");
  const [metric, setMetric] = useState<ExperimentMetric>("cost_per_result");
  const [startDate, setStartDate] = useState(readTodayIsoDate());
  const [endDate, setEndDate] = useState(addDaysToIsoDate(readTodayIsoDate(), 14));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const selectedAdSetIds = Object.keys(trafficByAdSetId);
  const trafficTotal = Object.values(trafficByAdSetId).reduce((total, share) => total + share, 0);

  function toggleAdSetInTest(adSetId: string) {
    const nextIds = selectedAdSetIds.includes(adSetId) ? selectedAdSetIds.filter((id) => id !== adSetId) : [...selectedAdSetIds, adSetId];
    setTrafficByAdSetId(splitTrafficEvenly(nextIds));
  }

  function findProblemWithExperimentForm(): string | null {
    if (!name.trim()) return "Name the test.";
    if (selectedAdSetIds.length < 2) return "Choose at least two ad sets to compare.";
    if (trafficTotal !== 100) return "The traffic split must add up to 100%.";
    if (endDate <= startDate || countDaysInRangeInclusive({ from: startDate, to: endDate }) < minimumExperimentDays) return `Run the test for at least ${minimumExperimentDays} days.`;
    return null;
  }

  async function createExperiment() {
    const problem = findProblemWithExperimentForm();
    if (problem) {
      setErrorMessage(problem);
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await toolsApi.createExperiment(accountId, {
        name: name.trim().slice(0, 100),
        campaignId: effectiveCampaignId,
        variable,
        metric,
        arms: selectedAdSetIds.map((adSetId) => ({ adSetId, trafficPercent: trafficByAdSetId[adSetId] ?? 0 })),
        startAt: startDate === readTodayIsoDate() ? new Date().toISOString() : `${startDate}T00:00:00.000Z`,
        endAt: `${endDate}T23:59:00.000Z`,
      });
      onCreated();
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
      setIsSaving(false);
    }
  }

  return (
    <OverlayDialog intent="experiment"
      isOpen
      onClose={onClose}
      layout="sidePanel"
      title="New A/B test"
      description="Split one campaign's audience between ad sets that differ in one thing, then compare."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" isLoading={isSaving} onClick={createExperiment}>Start test</Button>
        </>
      }
    >
      <TextField label="Test name" value={name} onValueChange={setName} maxLength={100} placeholder="e.g. Interests vs lookalike" />
      {campaignsQuery.isLoading ? <LoadingBlock height={60} /> : null}
      {!campaignsQuery.isLoading && eligibleCampaigns.length === 0 ? <InlineNotice tone="caution">You need a campaign with at least two ad sets. Duplicate an ad set and change one thing, then come back.</InlineNotice> : null}
      {eligibleCampaigns.length > 0 ? (
        <SelectField
          label="Campaign"
          value={effectiveCampaignId}
          onValueChange={(value) => {
            setCampaignId(value);
            setTrafficByAdSetId({});
          }}
          options={eligibleCampaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))}
        />
      ) : null}
      <div className={styles.formGrid}>
        <SelectField label="What differs" value={variable} onValueChange={setVariable} options={Object.entries(experimentVariableLabels).map(([value, label]) => ({ value: value as ExperimentVariable, label }))} />
        <SelectField label="Winner has" value={metric} onValueChange={setMetric} options={Object.entries(experimentMetricLabels).map(([value, label]) => ({ value: value as ExperimentMetric, label }))} />
      </div>
      {effectiveCampaignId ? (
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <legend style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Ad sets to compare · traffic split {trafficTotal}%</legend>
          {adSetsQuery.isLoading ? <LoadingBlock height={60} /> : null}
          {(adSetsQuery.data?.items ?? []).map((adSet) => {
            const isInAnotherTest = Boolean(adSet.experimentId);
            const isSelected = selectedAdSetIds.includes(adSet.id);
            return (
              <div key={adSet.id} className={styles.armEditor}>
                <input type="checkbox" id={`arm-${adSet.id}`} checked={isSelected} disabled={isInAnotherTest} onChange={() => toggleAdSetInTest(adSet.id)} />
                <label htmlFor={`arm-${adSet.id}`}>
                  {adSet.name}
                  {isInAnotherTest ? <span className={styles.muted}> · already in a test</span> : null}
                </label>
                {isSelected ? (
                  <TextField label={`Traffic for ${adSet.name}`} hideLabel suffix="%" inputMode="numeric" value={String(trafficByAdSetId[adSet.id] ?? 0)} onValueChange={(value) => setTrafficByAdSetId((current) => ({ ...current, [adSet.id]: Math.min(100, Number(value.replace(/\D/g, "")) || 0) }))} />
                ) : (
                  <span />
                )}
              </div>
            );
          })}
        </fieldset>
      ) : null}
      <div className={styles.formGrid}>
        <TextField label="Start" type="date" value={startDate} min={readTodayIsoDate()} onValueChange={setStartDate} />
        <TextField label="End" type="date" value={endDate} min={addDaysToIsoDate(startDate, minimumExperimentDays - 1)} onValueChange={setEndDate} hint={`At least ${minimumExperimentDays} days.`} />
      </div>
      {errorMessage ? <InlineNotice tone="error">{errorMessage}</InlineNotice> : null}
    </OverlayDialog>
  );
}
