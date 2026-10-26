"use client";

import { useState } from "react";

import { FeaturePlanBadge, PlanLockedNotice } from "@/components/billing/planGate";
import { SettingsFormFrame, StoreSettingsLoadedGate } from "@/components/settings/settingsFormFrame";
import { ToggleSwitch } from "@/components/ui/formFields";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSettingsPatch } from "@/hooks/useSettingsPatch.hook";
import type { NotificationPreferences, StoreSettings } from "@/types/store.type";

import styles from "./settings.module.css";

type NotificationKey = keyof NotificationPreferences;

const everydayNotificationDescriptions: Partial<Record<NotificationKey, { label: string; description: string }>> = {
  newOrderEmail: { label: "New order emails", description: "An email when a customer pays for an order in the Nantty app." },
  newOrderSms: { label: "New order texts", description: "An SMS to the store phone for each paid order." },
  payoutEmail: { label: "Payout updates", description: "An email when a withdrawal is paid or fails." },
  disputeEmail: { label: "Disputes", description: "An email as soon as a buyer opens a dispute, with the reply deadline." },
  reviewEmail: { label: "New reviews", description: "An email when a customer reviews a product or your store." },
  messageDigestEmail: { label: "Unread messages", description: "An email when customer messages have waited more than an hour." },
};

const automatedAlertDescriptions: Partial<Record<NotificationKey, { label: string; description: string }>> = {
  lowStockEmail: { label: "Low-stock email alerts", description: "An email listing items at or below their reorder level." },
  lowStockSms: { label: "Low-stock text alerts", description: "An SMS the moment a best-seller drops below its reorder level." },
  dailySummaryEmail: { label: "Daily summary", description: "An evening email with sales, orders and payouts." },
  weeklyPerformanceEmail: { label: "Weekly performance", description: "A Monday email with revenue, conversion and top products." },
};

function NotificationToggleList({ descriptions, preferences, disabled, onToggle }: { readonly descriptions: Partial<Record<NotificationKey, { label: string; description: string }>>; readonly preferences: NotificationPreferences; readonly disabled?: boolean; readonly onToggle: (key: NotificationKey, checked: boolean) => void }) {
  return (
    <>
      {(Object.keys(descriptions) as NotificationKey[]).map((key) => (
        <ToggleSwitch key={key} label={descriptions[key]?.label ?? key} description={descriptions[key]?.description} checked={preferences[key]} disabled={disabled} onCheckedChange={(checked) => onToggle(key, checked)} />
      ))}
    </>
  );
}

function NotificationPreferencesForm({ settings }: { readonly settings: StoreSettings }) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(settings.notifications);
  const { isSaving, serverFieldErrors, saveStoreSettingsPatch } = useSettingsPatch();
  const { hasFeature } = usePlanFeatures();
  const canUseAutomatedAlerts = hasFeature("automated_alerts");
  const toggleNotificationPreference = (key: NotificationKey, checked: boolean) => setPreferences((current) => ({ ...current, [key]: checked }));
  return (
    <SettingsFormFrame title="Notifications" description={`Sent to ${settings.email} and ${settings.phone}.`} errorMessages={Object.values(serverFieldErrors)} isSaving={isSaving} onSubmit={() => void saveStoreSettingsPatch({ notifications: preferences }, "Notification preferences saved.")}>
      <NotificationToggleList descriptions={everydayNotificationDescriptions} preferences={preferences} onToggle={toggleNotificationPreference} />
      <p className={styles.sectionHeading}>
        Automated alerts <FeaturePlanBadge feature="automated_alerts" />
      </p>
      {canUseAutomatedAlerts ? null : <PlanLockedNotice feature="automated_alerts" compact />}
      <NotificationToggleList descriptions={automatedAlertDescriptions} preferences={preferences} disabled={!canUseAutomatedAlerts} onToggle={toggleNotificationPreference} />
    </SettingsFormFrame>
  );
}

export function NotificationSettingsView() {
  return <StoreSettingsLoadedGate>{(settings) => <NotificationPreferencesForm key={JSON.stringify(settings.notifications)} settings={settings} />}</StoreSettingsLoadedGate>;
}
