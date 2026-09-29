import { CheckboxField } from "@/components/ui/formFields";
import type { UsernameCharacterClass, UsernameRules } from "@/types/platformConfiguration.type";

import { WholeNumberField } from "../shared/configurationFields";
import styles from "./platformRules.module.css";

const characterClassLabels: Record<UsernameCharacterClass, string> = { LOWERCASE_LETTERS: "Letters a–z", DIGITS: "Digits 0–9", DOT: "Dot (.)", UNDERSCORE: "Underscore (_)" };

function buildExamplePattern(rules: UsernameRules): string {
  const parts = rules.allowedCharacterClasses.map((characterClass) => ({ LOWERCASE_LETTERS: "a-z", DIGITS: "0-9", DOT: ".", UNDERSCORE: "_" })[characterClass]).join("");
  const first = rules.mustStartWithLetter ? "[a-z]" : `[${parts}]`;
  return `^${first}[${parts}]{${Math.max(0, rules.minimumLength - 1)},${Math.max(0, rules.maximumLength - 1)}}$`;
}

export function UsernameRulesEditor({ rules, canWrite, onChange }: { readonly rules: UsernameRules; readonly canWrite: boolean; readonly onChange: (updater: (current: UsernameRules) => UsernameRules) => void }) {
  const isDisabled = !canWrite;
  const setField = <Key extends keyof UsernameRules>(key: Key, value: UsernameRules[Key]) => onChange((current) => ({ ...current, [key]: value }));
  function toggleCharacterClass(characterClass: UsernameCharacterClass, isAllowed: boolean) {
    onChange((current) => ({ ...current, allowedCharacterClasses: isAllowed ? [...current.allowedCharacterClasses, characterClass] : current.allowedCharacterClasses.filter((candidate) => candidate !== characterClass) }));
  }
  return (
    <div className={styles.editor}>
      <div className={styles.grid}>
        <WholeNumberField label="Changes allowed" value={rules.changesAllowedPerWindow} maximum={10} isDisabled={isDisabled} onChange={(value) => setField("changesAllowedPerWindow", value)} />
        <WholeNumberField label="Per window of (days)" value={rules.changeWindowDays} minimum={1} maximum={365} isDisabled={isDisabled} onChange={(value) => setField("changeWindowDays", value)} />
        <WholeNumberField label="Minimum length" value={rules.minimumLength} minimum={1} maximum={30} isDisabled={isDisabled} onChange={(value) => setField("minimumLength", value)} />
        <WholeNumberField label="Maximum length" value={rules.maximumLength} minimum={rules.minimumLength} maximum={50} isDisabled={isDisabled} onChange={(value) => setField("maximumLength", value)} />
        <WholeNumberField label="Released usernames free up after (days)" value={rules.releasedUsernameCooldownDays} maximum={365} isDisabled={isDisabled} onChange={(value) => setField("releasedUsernameCooldownDays", value)} />
      </div>
      <fieldset className={styles.checks}>
        <legend>Allowed characters</legend>
        {(Object.keys(characterClassLabels) as UsernameCharacterClass[]).map((characterClass) => (
          <CheckboxField key={characterClass} label={characterClassLabels[characterClass]} checked={rules.allowedCharacterClasses.includes(characterClass)} disabled={isDisabled || characterClass === "LOWERCASE_LETTERS"} onChange={(event) => toggleCharacterClass(characterClass, event.target.checked)} />
        ))}
        <CheckboxField label="Must start with a letter" checked={rules.mustStartWithLetter} disabled={isDisabled} onChange={(event) => setField("mustStartWithLetter", event.target.checked)} />
      </fieldset>
      <p className={styles.summary}>
        People can change their username {rules.changesAllowedPerWindow} time{rules.changesAllowedPerWindow === 1 ? "" : "s"} every {rules.changeWindowDays} days. Pattern: <code>{buildExamplePattern(rules)}</code>. Withheld usernames follow the reserved-usernames list, not this cooldown.
      </p>
    </div>
  );
}
