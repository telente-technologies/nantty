import { CheckboxField, TextAreaField, TextField } from "@/components/ui/formFields";
import type { ClientPlatform, FeatureFlagContent } from "@/types/featureFlags.type";

import { EditableTextList } from "../shared/configurationFields";
import styles from "./featureFlags.module.css";

const platforms: readonly { key: ClientPlatform; label: string }[] = [
  { key: "IOS", label: "iOS app" },
  { key: "ANDROID", label: "Android app" },
  { key: "WEB", label: "Web" },
];

export const blankFeatureFlagContent: FeatureFlagContent = { description: "", owner: "", isEnabled: false, isKillSwitch: false, rolloutPercent: 0, targeting: { countries: [], platforms: ["IOS", "ANDROID", "WEB"], minimumAppVersion: null } };

export function FeatureFlagEditor({ flag, canWrite, onChange }: { readonly flag: FeatureFlagContent; readonly canWrite: boolean; readonly onChange: (updater: (current: FeatureFlagContent) => FeatureFlagContent) => void }) {
  const isDisabled = !canWrite;
  const updateTargeting = (changes: Partial<FeatureFlagContent["targeting"]>) => onChange((current) => ({ ...current, targeting: { ...current.targeting, ...changes } }));
  return (
    <div className={styles.editor}>
      <TextAreaField label="What this flag controls" value={flag.description} rows={2} maxLength={300} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))} />
      <TextField label="Owning team" value={flag.owner} maxLength={60} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, owner: event.target.value }))} />
      <div className={styles.toggles}>
        <CheckboxField label="Enabled" description="When off, nobody gets the feature regardless of rollout." checked={flag.isEnabled} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, isEnabled: event.target.checked }))} />
        <CheckboxField label="Kill switch" description="Marks this flag as an emergency stop. Turning it on stops the feature everywhere." checked={flag.isKillSwitch} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, isKillSwitch: event.target.checked }))} />
      </div>
      <label className={styles.rollout}>
        <span className={styles.rolloutLabel}>
          Rollout <strong>{flag.rolloutPercent}%</strong> of matching people
        </span>
        <input type="range" min={0} max={100} step={5} value={flag.rolloutPercent} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, rolloutPercent: Number(event.target.value) }))} />
      </label>
      <fieldset className={styles.platforms}>
        <legend>Platforms</legend>
        {platforms.map((platform) => (
          <CheckboxField
            key={platform.key}
            label={platform.label}
            checked={flag.targeting.platforms.includes(platform.key)}
            disabled={isDisabled}
            onChange={(event) => updateTargeting({ platforms: event.target.checked ? [...flag.targeting.platforms, platform.key] : flag.targeting.platforms.filter((candidate) => candidate !== platform.key) })}
          />
        ))}
      </fieldset>
      <TextField label="Minimum app version" hint="Leave empty for every version. Format 3.4.0." value={flag.targeting.minimumAppVersion ?? ""} disabled={isDisabled} onChange={(event) => updateTargeting({ minimumAppVersion: event.target.value.trim() === "" ? null : event.target.value.trim() })} />
      <EditableTextList label="Countries (empty means everywhere)" items={flag.targeting.countries} placeholder="Two-letter code, e.g. GH" maximumLength={2} isDisabled={isDisabled} onChange={(countries) => updateTargeting({ countries: countries.map((country) => country.toUpperCase().replace(/[^A-Z]/g, "")) })} />
    </div>
  );
}

export function findFeatureFlagDraftProblem(flag: FeatureFlagContent): string | null {
  if (flag.description.trim().length < 5) return "Describe what the flag controls (at least 5 characters).";
  if (flag.owner.trim().length < 2) return "Name the owning team.";
  if (flag.targeting.platforms.length === 0) return "Choose at least one platform.";
  if (flag.targeting.minimumAppVersion && !/^\d+\.\d+\.\d+$/.test(flag.targeting.minimumAppVersion)) return "Use a version like 3.4.0.";
  return null;
}
