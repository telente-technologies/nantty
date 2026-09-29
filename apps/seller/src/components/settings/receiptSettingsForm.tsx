"use client";

import { useState } from "react";

import { ReceiptTemplatePreview } from "@/components/settings/receiptTemplatePreview";
import { SettingsFormFrame, StoreSettingsLoadedGate } from "@/components/settings/settingsFormFrame";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { TextAreaField, TextField, ToggleSwitch } from "@/components/ui/formFields";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { useSettingsPatch } from "@/hooks/useSettingsPatch.hook";
import type { ReceiptPaperWidth, ReceiptTemplate, StoreSettings } from "@/types/store.type";

import styles from "./settings.module.css";

const receiptTextLimits = { headerText: 120, footerText: 200, returnPolicy: 400 } as const;

function ReceiptTemplateForm({ settings }: { readonly settings: StoreSettings }) {
  const { sessionView } = useSellerSession();
  const [template, setTemplate] = useState<ReceiptTemplate>(settings.receipt);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const { isSaving, serverFieldErrors, saveStoreSettingsPatch } = useSettingsPatch();

  function updateTemplate(changes: Partial<ReceiptTemplate>) {
    setTemplate((current) => ({ ...current, ...changes }));
  }

  async function saveReceiptTemplate() {
    const messages = (Object.keys(receiptTextLimits) as (keyof typeof receiptTextLimits)[])
      .filter((field) => template[field].trim().length > receiptTextLimits[field])
      .map((field) => `Keep the ${field === "headerText" ? "header" : field === "footerText" ? "footer" : "return policy"} under ${receiptTextLimits[field]} characters.`);
    setErrorMessages(messages);
    if (messages.length > 0) return;
    await saveStoreSettingsPatch({ receipt: { ...template, headerText: template.headerText.trim(), footerText: template.footerText.trim(), returnPolicy: template.returnPolicy.trim() } }, "Receipt template saved.");
  }

  return (
    <SettingsFormFrame title="Receipt" description="Printed and shared receipts from the register use this template." errorMessages={[...errorMessages, ...Object.values(serverFieldErrors)]} isSaving={isSaving} onSubmit={() => void saveReceiptTemplate()}>
      <div className={styles.previewLayout}>
        <div className={styles.fieldset}>
          <div>
            <p className={styles.readOnlyLabel}>Paper width</p>
            <SegmentedControl<ReceiptPaperWidth> label="Paper width" value={template.paperWidth} onValueChange={(paperWidth) => updateTemplate({ paperWidth })} options={[{ value: "58mm", label: "58 mm" }, { value: "80mm", label: "80 mm" }]} />
          </div>
          <TextField label="Header message" value={template.headerText} maxLength={receiptTextLimits.headerText} onChange={(event) => updateTemplate({ headerText: event.target.value })} />
          <TextField label="Footer message" value={template.footerText} maxLength={receiptTextLimits.footerText} onChange={(event) => updateTemplate({ footerText: event.target.value })} />
          <TextAreaField label="Return policy" value={template.returnPolicy} maxLength={receiptTextLimits.returnPolicy} onChange={(event) => updateTemplate({ returnPolicy: event.target.value })} hint={`${template.returnPolicy.length}/${receiptTextLimits.returnPolicy}`} />
          <ToggleSwitch label="Print store logo" checked={template.showLogo} onCheckedChange={(showLogo) => updateTemplate({ showLogo })} />
          <ToggleSwitch label="Print cashier name" checked={template.showCashierName} onCheckedChange={(showCashierName) => updateTemplate({ showCashierName })} />
        </div>
        <ReceiptTemplatePreview settings={settings} template={template} cashierName={sessionView?.operator?.name ?? sessionView?.user.name ?? "Cashier"} />
      </div>
    </SettingsFormFrame>
  );
}

export function ReceiptSettingsView() {
  return <StoreSettingsLoadedGate>{(settings) => <ReceiptTemplateForm key={JSON.stringify(settings.receipt)} settings={settings} />}</StoreSettingsLoadedGate>;
}
