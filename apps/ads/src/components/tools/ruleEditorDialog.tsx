"use client";

import { useState } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { InlineNotice, LoadingBlock } from "@/components/ui/feedback";
import { CheckboxField, SegmentedControl, SelectField, TextField } from "@/components/ui/formFields";
import { OverlayDialog } from "@/components/ui/overlayDialog";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { campaignsApi } from "@/services/campaignsApi.service";
import { toolsApi } from "@/services/toolsApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { AutomatedRule, RuleActionType, RuleCondition, RuleLevel } from "@/types/tools.type";

import { convertEditableToRuleCondition, convertRuleConditionToEditable, RuleConditionEditor, type EditableRuleCondition } from "./ruleConditionEditor";
import { ruleActionLabels, ruleCheckFrequencyOptions, ruleLevelLabels } from "./toolLabels.constant";
import styles from "./toolsPage.module.css";

const maximumConditions = 5;
const defaultCondition: EditableRuleCondition = { metric: "cpc", operator: "greater_than", typedValue: "", window: "last_3_days" };

async function loadTargetsForLevel(accountId: string, level: RuleLevel): Promise<{ id: string; name: string }[]> {
  if (level === "campaign") return (await campaignsApi.listCampaigns(accountId)).items.map((item) => ({ id: item.id, name: item.name }));
  if (level === "ad_set") return (await campaignsApi.listAdSets(accountId)).items.map((item) => ({ id: item.id, name: item.name }));
  return (await campaignsApi.listAds(accountId)).items.map((item) => ({ id: item.id, name: item.name }));
}

export function RuleEditorDialog({ existingRule, onClose, onSaved }: { readonly existingRule: AutomatedRule | null; readonly onClose: () => void; readonly onSaved: () => void }) {
  const { accountId, currency } = useAdAccount();
  const [name, setName] = useState(existingRule?.name ?? "");
  const [level, setLevel] = useState<RuleLevel>(existingRule?.level ?? "ad");
  const [targetIds, setTargetIds] = useState<string[]>([...(existingRule?.targetIds ?? [])]);
  const [conditions, setConditions] = useState<EditableRuleCondition[]>(existingRule ? existingRule.conditions.map(convertRuleConditionToEditable) : [defaultCondition]);
  const [actionType, setActionType] = useState<RuleActionType>(existingRule?.action.type ?? "pause");
  const [percentText, setPercentText] = useState(String(existingRule?.action.percent ?? 15));
  const [checkEvery, setCheckEvery] = useState<"30" | "60" | "1440">(String(existingRule?.checkEveryMinutes ?? 60) as "30" | "60" | "1440");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const targetsQuery = useAdsQuery(() => loadTargetsForLevel(accountId, level), `${accountId}:${level}`);
  const isBudgetAction = actionType === "increase_budget" || actionType === "decrease_budget";

  function changeLevel(nextLevel: RuleLevel) {
    setLevel(nextLevel);
    setTargetIds([]);
    if (nextLevel === "ad" && isBudgetAction) setActionType("pause");
  }

  async function saveRule() {
    const parsedConditions = conditions.map(convertEditableToRuleCondition);
    const percent = Number(percentText);
    if (!name.trim()) return setErrorMessage("Name the rule.");
    if (parsedConditions.some((condition) => condition === null)) return setErrorMessage("Enter a number for every condition.");
    if (isBudgetAction && (!Number.isInteger(percent) || percent < 1 || percent > 100)) return setErrorMessage("Choose a budget change between 1% and 100%.");
    setIsSaving(true);
    setErrorMessage(null);
    const input = {
      name: name.trim().slice(0, 100),
      level,
      targetIds,
      conditions: parsedConditions as RuleCondition[],
      action: { type: actionType, percent: isBudgetAction ? percent : null },
      checkEveryMinutes: Number(checkEvery) as 30 | 60 | 1440,
    };
    try {
      if (existingRule) await toolsApi.updateRule(accountId, existingRule.id, input);
      else await toolsApi.createRule(accountId, input);
      onSaved();
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
      setIsSaving(false);
    }
  }

  const actionOptions = (Object.keys(ruleActionLabels) as RuleActionType[]).filter((type) => level !== "ad" || (type !== "increase_budget" && type !== "decrease_budget"));

  return (
    <OverlayDialog intent="rule"
      isOpen
      onClose={onClose}
      layout="sidePanel"
      title={existingRule ? "Edit rule" : "New automated rule"}
      description="Rules check your results on a schedule and act for you."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" isLoading={isSaving} onClick={saveRule}>{existingRule ? "Save rule" : "Create rule"}</Button>
        </>
      }
    >
      <TextField label="Rule name" value={name} onValueChange={setName} maxLength={100} placeholder="e.g. Pause ads when CPC is too high" />
      <div>
        <p style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Apply to</p>
        <SegmentedControl label="Apply to" value={level} onValueChange={changeLevel} options={(Object.keys(ruleLevelLabels) as RuleLevel[]).map((value) => ({ value, label: ruleLevelLabels[value] }))} />
      </div>
      <div className={styles.targetList} aria-label={`Choose ${ruleLevelLabels[level].toLowerCase()}`}>
        <p className={styles.muted}>{targetIds.length === 0 ? `All active ${ruleLevelLabels[level].toLowerCase()} (choose some to narrow it down)` : `${targetIds.length} selected`}</p>
        {targetsQuery.isLoading ? <LoadingBlock height={40} /> : null}
        {(targetsQuery.data ?? []).map((target) => (
          <CheckboxField key={target.id} label={target.name} checked={targetIds.includes(target.id)} onCheckedChange={(checked) => setTargetIds((current) => (checked ? [...current, target.id] : current.filter((id) => id !== target.id)))} />
        ))}
      </div>
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <legend style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>When all of these are true</legend>
        {conditions.map((condition, index) => (
          <RuleConditionEditor
            key={index}
            index={index}
            condition={condition}
            currency={currency}
            canRemove={conditions.length > 1}
            onChange={(next) => setConditions((current) => current.map((existing, existingIndex) => (existingIndex === index ? next : existing)))}
            onRemove={() => setConditions((current) => current.filter((_, existingIndex) => existingIndex !== index))}
          />
        ))}
        {conditions.length < maximumConditions ? (
          <div>
            <Button size="small" iconName="plus16" onClick={() => setConditions((current) => [...current, defaultCondition])}>Add condition</Button>
          </div>
        ) : null}
      </fieldset>
      <div className={styles.formGrid}>
        <SelectField label="Then" value={actionType} onValueChange={setActionType} options={actionOptions.map((value) => ({ value, label: ruleActionLabels[value] }))} />
        {isBudgetAction ? <TextField label="By" suffix="%" inputMode="numeric" value={percentText} onValueChange={(value) => setPercentText(value.replace(/\D/g, "").slice(0, 3))} /> : null}
      </div>
      <SelectField label="Check" value={checkEvery} onValueChange={setCheckEvery} options={ruleCheckFrequencyOptions} />
      <InlineNotice tone="info">You get a notification every time a rule acts, and each action is written to the activity log.</InlineNotice>
      {errorMessage ? <InlineNotice tone="error">{errorMessage}</InlineNotice> : null}
    </OverlayDialog>
  );
}
