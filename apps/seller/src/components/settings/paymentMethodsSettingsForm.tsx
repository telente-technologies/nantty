"use client";

import { useState } from "react";

import { SettingsFormFrame, StoreSettingsLoadedGate } from "@/components/settings/settingsFormFrame";
import { TextAreaField, TextField, ToggleSwitch } from "@/components/ui/formFields";
import { useSettingsPatch } from "@/hooks/useSettingsPatch.hook";
import type { PaymentMethod, PaymentMethodSetting, StoreSettings } from "@/types/store.type";

import styles from "./settings.module.css";

const paymentMethodExplanations: Record<PaymentMethod, string> = {
  cash: "Cash at the counter. The register works out change and tracks the cash drawer.",
  card: "Card payments on your own POS terminal. Cashiers type the approval code.",
  bank_transfer: "Customers transfer to your bank account. Put the account details in the instructions.",
  zudomart_wallet: "Customers pay from their Zudomart wallet by scanning or opening a link.",
  pay_link: "Send a Zudomart pay link by WhatsApp or SMS for card or transfer payment.",
};

function PaymentMethodsForm({ settings }: { readonly settings: StoreSettings }) {
  const [methods, setMethods] = useState<PaymentMethodSetting[]>(settings.paymentMethods);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const { isSaving, serverFieldErrors, saveStoreSettingsPatch } = useSettingsPatch();

  function updateMethod(method: PaymentMethod, changes: Partial<PaymentMethodSetting>) {
    setMethods((current) => current.map((setting) => (setting.method === method ? { ...setting, ...changes } : setting)));
  }

  async function savePaymentMethods() {
    const messages: string[] = [];
    if (!methods.some((setting) => setting.enabled)) messages.push("Keep at least one payment method switched on.");
    for (const setting of methods) {
      if (!setting.label.trim() || setting.label.trim().length > 40) messages.push(`Give ${setting.method.replace(/_/g, " ")} a label of up to 40 characters.`);
      if ((setting.instructions ?? "").length > 300) messages.push(`Keep the ${setting.label} instructions under 300 characters.`);
    }
    if (methods.some((setting) => setting.method === "bank_transfer" && setting.enabled && !(setting.instructions ?? "").trim())) messages.push("Add your bank name and account number to the bank transfer instructions.");
    setErrorMessages(messages);
    if (messages.length > 0) return;
    await saveStoreSettingsPatch({ paymentMethods: methods.map((setting) => ({ ...setting, label: setting.label.trim(), instructions: setting.instructions?.trim() ? setting.instructions.trim() : null })) }, "Payment methods saved.");
  }

  return (
    <SettingsFormFrame title="Payment methods" description="What the register offers at checkout. Split payments can mix any of these." errorMessages={[...errorMessages, ...Object.values(serverFieldErrors)]} isSaving={isSaving} onSubmit={() => void savePaymentMethods()}>
      <ul className={styles.listReset}>
        {methods.map((setting) => (
          <li key={setting.method} className={styles.rowCard}>
            <ToggleSwitch label={setting.label || setting.method} description={paymentMethodExplanations[setting.method]} checked={setting.enabled} onCheckedChange={(enabled) => updateMethod(setting.method, { enabled })} />
            {setting.enabled ? (
              <div className={styles.twoColumns}>
                <TextField label="Label on the register" value={setting.label} maxLength={40} onChange={(event) => updateMethod(setting.method, { label: event.target.value })} />
                <TextAreaField label="Instructions for cashiers and customers" value={setting.instructions ?? ""} maxLength={300} rows={2} onChange={(event) => updateMethod(setting.method, { instructions: event.target.value })} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </SettingsFormFrame>
  );
}

export function PaymentMethodsSettingsView() {
  return <StoreSettingsLoadedGate>{(settings) => <PaymentMethodsForm key={JSON.stringify(settings.paymentMethods)} settings={settings} />}</StoreSettingsLoadedGate>;
}
