"use client";

import { useState } from "react";

import { ConsentToggleRow } from "@/components/settings/consentToggleRow";
import { SelectField } from "@/components/ui/field";
import { replyPolicyOptions, sensitiveLabelOptions } from "@/config/postAudience.config";
import type { ReplyPolicy, SensitiveLabel } from "@/types/postAudience.type";
import type { ComposerDraft } from "@/utils/composerDraft.util";

import styles from "./composer.module.css";
import { PlacePicker } from "./placePicker";
import { TagPeoplePicker, TagProductsPicker } from "./composerTagPickers";

interface ComposerSettingsProps {
  readonly draft: ComposerDraft;
  readonly onChange: (draft: ComposerDraft) => void;
  readonly isApprovedCreator: boolean;
  readonly isAdult: boolean;
}

export function ComposerSettings({ draft, onChange, isApprovedCreator, isAdult }: ComposerSettingsProps) {
  const [isMarkedSensitive, setIsMarkedSensitive] = useState(draft.sensitiveLabels.length > 0);
  const availableLabels = sensitiveLabelOptions.filter((option) => isAdult || !option.adultsOnly);
  const toggleLabel = (label: SensitiveLabel) =>
    onChange({ ...draft, sensitiveLabels: draft.sensitiveLabels.includes(label) ? draft.sensitiveLabels.filter((item) => item !== label) : [...draft.sensitiveLabels, label] });
  const selectedReply = replyPolicyOptions.find((option) => option.value === draft.replyPolicy);

  return (
    <section className={styles.settings} aria-labelledby="composer-settings-title">
      <PlacePicker selected={draft.location} onChange={(location) => onChange({ ...draft, location })} />
      <TagPeoplePicker tagged={draft.tagged} onChange={(tagged) => onChange({ ...draft, tagged })} />
      <TagProductsPicker products={draft.products} onChange={(products) => onChange({ ...draft, products })} />
      <h2 id="composer-settings-title" className={styles.settingsTitle}>Advanced settings</h2>
      <SelectField label="Who can reply" hint={selectedReply?.detail} value={draft.replyPolicy} onChange={(event) => onChange({ ...draft, replyPolicy: event.target.value as ReplyPolicy })}>
        {replyPolicyOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </SelectField>
      {isApprovedCreator ? (
        <ConsentToggleRow
          label="Subscribers only"
          description="Only your subscribers can see this post. Others see a locked preview with a Subscribe button."
          enabled={draft.visibility === "subscribers"}
          onChange={(isOn) => onChange({ ...draft, visibility: isOn ? "subscribers" : "public" })}
        />
      ) : null}
      <ConsentToggleRow
        label="Mark as sensitive"
        description="Viewers see a warning first and choose whether to view. Under-18s never see adult categories."
        enabled={isMarkedSensitive}
        onChange={(isOn) => {
          setIsMarkedSensitive(isOn);
          if (!isOn) onChange({ ...draft, sensitiveLabels: [] });
        }}
      />
      {isMarkedSensitive ? (
        <div className={styles.labelChips} role="group" aria-label="What could viewers find sensitive?">
          {availableLabels.map((option) => (
            <button key={option.value} type="button" className={styles.labelChip} aria-pressed={draft.sensitiveLabels.includes(option.value)} onClick={() => toggleLabel(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      <ConsentToggleRow
        label="AI generated"
        description="Turn on if this was made or heavily edited with AI. Viewers will see a label."
        enabled={draft.isAiGenerated}
        onChange={(isAiGenerated) => onChange({ ...draft, isAiGenerated })}
      />
    </section>
  );
}
