"use client";

import { useState } from "react";

import { useBrandWorkspace } from "@/components/brand/brandWorkspace";
import { StepUpCancelledError, useStepUpPrompt } from "@/components/wallet/stepUpDialog";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import { stepUpHeaders } from "@/services/stepUp.service";
import type { Brand } from "@/types/brand.type";

const TURN_ON_COPY = "Your brand storefront and products will show in Mart. Selling uses your wallet, escrow in Nigeria, and identity verification before selling outside Nigeria.";
const TURN_OFF_COPY = "Your products and storefront will be hidden and you can't add new listings. Open orders and payouts carry on until they're complete.";

export function BrandSellingSwitch() {
  const { brand, myRole, replaceBrand } = useBrandWorkspace();
  const { showToast } = useToast();
  const { withStepUp, stepUpDialog } = useStepUpPrompt();
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  if (myRole !== "owner") return null;
  const enabled = brand.sellingEnabled === true;

  async function confirmChange() {
    if (pendingValue === null) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const updated = await withStepUp((token) => sendSellerApiRequest<Brand>(`/brands/${encodeURIComponent(brand.id)}`, { method: "PATCH", body: { sellingEnabled: pendingValue }, headers: stepUpHeaders(token) }));
      replaceBrand({ ...brand, sellingEnabled: updated.sellingEnabled ?? pendingValue });
      showToast(pendingValue ? "Selling is on for this brand." : "Selling is off. Open orders carry on.");
      setPendingValue(null);
    } catch (error) {
      if (!(error instanceof StepUpCancelledError)) setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Panel title="Selling" description="A brand storefront is a sales channel of this brand. It doesn't use your account's Store slot.">
      <ToggleSwitch label="Sell products with this brand" description={enabled ? "Selling is on. The Mart icon and products tab are visible." : "Selling is off. This brand is a showcase only."} checked={enabled} disabled={isSaving} onCheckedChange={(next) => setPendingValue(next)} />
      <ModalDialog
        isOpen={pendingValue !== null}
        title={pendingValue ? "Sell products with this brand?" : "Stop selling with this brand?"}
        description={pendingValue ? TURN_ON_COPY : TURN_OFF_COPY}
        tone={pendingValue ? "brand" : "danger"}
        isBusy={isSaving}
        errorMessage={errorMessage}
        onClose={() => { setPendingValue(null); setErrorMessage(null); }}
        footer={
          <>
            <Button onClick={() => setPendingValue(null)} disabled={isSaving}>Cancel</Button>
            <Button variant={pendingValue ? "primary" : "danger"} isBusy={isSaving} onClick={() => void confirmChange()}>{pendingValue ? "Turn on" : "Turn off"}</Button>
          </>
        }
      >
        <p>You&apos;ll confirm it&apos;s you before the change is saved.</p>
      </ModalDialog>
      {stepUpDialog}
    </Panel>
  );
}
