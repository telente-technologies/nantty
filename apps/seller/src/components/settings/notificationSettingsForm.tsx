"use client";

import { useState } from "react";

import { SettingsFormFrame, StoreSettingsLoadedGate } from "@/components/settings/settingsFormFrame";
import { ToggleSwitch } from "@/components/ui/formFields";
import { useSettingsPatch } from "@/hooks/useSettingsPatch.hook";
import type { NotificationPreferences, StoreSettings } from "@/types/store.type";

const notificationDescriptions: Record<keyof NotificationPreferences, { label: string; description: string }> = {
  newOrderEmail: { label: "New order emails", description: "An email when a buyer pays for an online order." },
  newOrderSms: { label: "New order texts", description: "An SMS to the store phone for each paid online order." },
  lowStockEmail: { label: "Low stock alerts", description: "A daily email listing items at or below their low-stock level." },
  payoutEmail: { label: "Payout updates", description: "An email when a withdrawal is paid or fails." },
  disputeEmail: { label: "Disputes", description: "An email as soon as a buyer opens a dispute, with the reply deadline." },
  dailySummaryEmail: { label: "Daily summary", description: "An evening email with sales, orders and cash variance." },
};

function NotificationPreferencesForm({ settings }: { readonly settings: StoreSettings }) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(settings.notifications);
  const { isSaving, serverFieldErrors, saveStoreSettingsPatch } = useSettingsPatch();
  return (
    <SettingsFormFrame title="Notifications" description={`Sent to ${settings.email} and ${settings.phone}.`} errorMessages={Object.values(serverFieldErrors)} isSaving={isSaving} onSubmit={() => void saveStoreSettingsPatch({ notifications: preferences }, "Notification preferences saved.")}>
      {(Object.keys(notificationDescriptions) as (keyof NotificationPreferences)[]).map((key) => (
        <ToggleSwitch key={key} label={notificationDescriptions[key].label} description={notificationDescriptions[key].description} checked={preferences[key]} onCheckedChange={(checked) => setPreferences((current) => ({ ...current, [key]: checked }))} />
      ))}
    </SettingsFormFrame>
  );
}

export function NotificationSettingsView() {
  return <StoreSettingsLoadedGate>{(settings) => <NotificationPreferencesForm key={JSON.stringify(settings.notifications)} settings={settings} />}</StoreSettingsLoadedGate>;
}
