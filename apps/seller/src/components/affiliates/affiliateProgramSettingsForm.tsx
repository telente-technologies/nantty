"use client";

import { useEffect, useState, type FormEvent } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button } from "@/components/ui/button";
import { FormErrorSummary, TextField, ToggleSwitch } from "@/components/ui/formFields";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { AffiliateProgramSettings } from "@/types/affiliate.type";
import { convertBasisPointsToPercentText, convertPercentTextToBasisPoints, maximumAffiliateCommissionPercent } from "@/utils/affiliateFormatting.util";

import styles from "./affiliateViews.module.css";

interface ProgramSettingsDraft {
  enabled: boolean;
  commissionPercentText: string;
  autoApproveFollowersText: string;
  cookieWindowDaysText: string;
}

function convertSettingsToDraft(settings: AffiliateProgramSettings): ProgramSettingsDraft {
  return {
    enabled: settings.enabled,
    commissionPercentText: convertBasisPointsToPercentText(settings.defaultCommissionBasisPoints),
    autoApproveFollowersText: settings.autoApproveCreatorsWithFollowersAbove === null ? "" : String(settings.autoApproveCreatorsWithFollowersAbove),
    cookieWindowDaysText: String(settings.cookieWindowDays),
  };
}

function validateProgramSettingsDraft(draft: ProgramSettingsDraft): { errors: Record<string, string>; settings: AffiliateProgramSettings | null } {
  const errors: Record<string, string> = {};
  const defaultCommissionBasisPoints = convertPercentTextToBasisPoints(draft.commissionPercentText);
  if (defaultCommissionBasisPoints === null) errors.commission = `Enter a commission from 0 to ${maximumAffiliateCommissionPercent}%, up to 2 decimal places.`;
  const followersText = draft.autoApproveFollowersText.replace(/[\s,]/g, "");
  const autoApproveCreatorsWithFollowersAbove = followersText === "" ? null : /^\d{1,9}$/.test(followersText) ? Number(followersText) : Number.NaN;
  if (Number.isNaN(autoApproveCreatorsWithFollowersAbove)) errors.followers = "Enter a whole number of followers, or leave it empty to review every request.";
  const cookieWindowDays = /^\d{1,2}$/.test(draft.cookieWindowDaysText) ? Number(draft.cookieWindowDaysText) : Number.NaN;
  if (!(cookieWindowDays >= 1 && cookieWindowDays <= 90)) errors.cookieWindow = "Choose 1 to 90 days.";
  if (Object.keys(errors).length > 0 || defaultCommissionBasisPoints === null) return { errors, settings: null };
  return { errors, settings: { enabled: draft.enabled, defaultCommissionBasisPoints, autoApproveCreatorsWithFollowersAbove, cookieWindowDays } };
}

export function AffiliateProgramSettingsForm({ settings, onSaved }: { readonly settings: AffiliateProgramSettings; readonly onSaved: (settings: AffiliateProgramSettings) => void }) {
  const { can } = useSellerSession();
  const { showToast } = useToast();
  const [draft, setDraft] = useState(() => convertSettingsToDraft(settings));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const canEdit = can("affiliates:manage");

  useEffect(() => setDraft(convertSettingsToDraft(settings)), [settings]);

  async function saveProgramSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { errors, settings: validatedSettings } = validateProgramSettingsDraft(draft);
    setFieldErrors(errors);
    if (!validatedSettings) return;
    setIsSaving(true);
    try {
      const savedSettings = await sendSellerApiRequest<AffiliateProgramSettings>("/seller/affiliates/settings", { method: "PATCH", body: validatedSettings });
      onSaved(savedSettings);
      showToast("Affiliate settings saved.");
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className={styles.formStack} onSubmit={saveProgramSettings} noValidate>
      <FormErrorSummary messages={Object.values(fieldErrors)} />
      <ToggleSwitch label="Affiliate program" description={draft.enabled ? "Creators can request to sell your products." : "Paused: no new requests, links stop earning."} checked={draft.enabled} onCheckedChange={(enabled) => setDraft({ ...draft, enabled })} disabled={!canEdit} />
      <TextField label="Default commission" hint="Share of each item's sale price a creator earns. You can override it per product." prefix="%" inputMode="decimal" value={draft.commissionPercentText} errorMessage={fieldErrors.commission} onChange={(event) => setDraft({ ...draft, commissionPercentText: event.target.value })} disabled={!canEdit} maxLength={5} />
      <TextField label="Auto-approve creators with more followers than" hint="Leave empty to review every request yourself." inputMode="numeric" value={draft.autoApproveFollowersText} errorMessage={fieldErrors.followers} onChange={(event) => setDraft({ ...draft, autoApproveFollowersText: event.target.value })} disabled={!canEdit} maxLength={11} />
      <TextField label="Attribution window (days)" hint="A buyer who taps a creator's link and orders within this many days counts as that creator's sale." inputMode="numeric" value={draft.cookieWindowDaysText} errorMessage={fieldErrors.cookieWindow} onChange={(event) => setDraft({ ...draft, cookieWindowDaysText: event.target.value })} disabled={!canEdit} maxLength={2} />
      {canEdit ? (
        <div>
          <Button type="submit" variant="primary" isBusy={isSaving}>
            Save settings
          </Button>
        </div>
      ) : null}
    </form>
  );
}
