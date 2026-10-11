"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { CheckboxField } from "@/components/ui/formFields";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchStaffSettings, saveStaffSettings } from "@/services/platformApi.service";

export function StaffSettingsBar() {
  const { isSuperadmin } = useAdminPermissions();
  const { showToast } = useToast();
  const settings = useAdminQuery((signal) => fetchStaffSettings(signal), "staff-settings");
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);
  const mutation = useAdminMutation((input: { value: boolean; reason: string }) => saveStaffSettings({ requireSecondSuperadminApproval: input.value, reason: input.reason }));
  if (!settings.data) return null;

  async function confirm(reason: string) {
    if (pendingValue === null) return;
    if (await mutation.run({ value: pendingValue, reason })) {
      showToast("Staff setting saved. Logged to the audit trail.");
      setPendingValue(null);
      settings.reload();
    }
  }

  return (
    <>
      <CheckboxField label="A second superadmin must approve new superadmins" description={isSuperadmin ? "On by default. The creator cannot approve their own invitation." : "Only a superadmin can change this."} checked={settings.data.requireSecondSuperadminApproval} disabled={!isSuperadmin} onChange={(event) => setPendingValue(event.target.checked)} />
      {pendingValue !== null ? <ConfirmActionDialog intent="security" isOpen title="Change superadmin approval" confirmLabel="Save setting" requiresStepUp isBusy={mutation.isRunning} errorMessage={mutation.errorMessage} onConfirm={confirm} onClose={() => { mutation.clearError(); setPendingValue(null); }} /> : null}
    </>
  );
}
