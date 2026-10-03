import { AppIcon } from "@/components/ui/appIcon";

import stepStyles from "../authSteps.module.css";

import { calculatePasswordStrength, checkPasswordRequirements } from "./signupRules.util";

export function PasswordRequirements({ password }: { readonly password: string }) {
  const requirements = checkPasswordRequirements(password);
  const strength = calculatePasswordStrength(password);
  const strengthWidth: Record<string, string> = { none: "0%", weak: "17%", medium: "52%", strong: "100%" };
  const strengthColour: Record<string, string> = {
    none: "var(--surface-sunken)",
    weak: "var(--error)",
    medium: "var(--caution)",
    strong: "var(--success)",
  };
  const strengthLabel: Record<string, string> = { none: "", weak: "Weak", medium: "Medium", strong: "Strong" };

  return (
    <div className={stepStyles.passwordRules}>
      <p className={stepStyles.passwordRulesHeading}>Your password must have at least:</p>
      <div className={stepStyles.ruleList}>
        <PasswordRule met={requirements.hasLengthBetweenEightAndTwenty} label="8 characters (20 max)" />
        <PasswordRule met={requirements.hasLetterAndNumber} label="1 letter and 1 number" />
        <PasswordRule met={requirements.hasSpecialCharacter} label="1 special character (Example: # $ % ! @)" />
      </div>
      <div className={stepStyles.strengthTrack} role="progressbar" aria-label={`Password strength ${strengthLabel[strength] || "not set"}`}>
        <div className={stepStyles.strengthFill} style={{ width: strengthWidth[strength], background: strengthColour[strength] }} />
      </div>
      <p className={stepStyles.strengthRow}>
        Password strength:
        {strength !== "none" ? <span className={stepStyles.strengthLabel}>{strengthLabel[strength]}</span> : null}
      </p>
    </div>
  );
}

function PasswordRule({ met, label }: { readonly met: boolean; readonly label: string }) {
  return (
    <p className={met ? `${stepStyles.rule} ${stepStyles.ruleMet}` : stepStyles.rule} aria-label={`${label}${met ? ", met" : ", not met"}`}>
      <AppIcon name="check16" size={16} />
      {label}
    </p>
  );
}
