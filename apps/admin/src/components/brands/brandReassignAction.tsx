"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { TextField } from "@/components/ui/formFields";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { reassignBrandOwner } from "@/services/linkedProfilesApi.service";

export function BrandReassignAction({ brandId, brandName, onReassigned }: { readonly brandId: string; readonly brandName: string; readonly onReassigned: () => void }) {
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [toAccountId, setToAccountId] = useState("");
  const mutation = useAdminMutation((reason: string) => reassignBrandOwner(brandId, { toAccountId: toAccountId.trim(), reason }));
  if (!can("brands:revoke")) return null;

  async function reassign(reason: string) {
    const result = await mutation.run(reason);
    if (!result) return;
    setIsOpen(false);
    setToAccountId("");
    showToast(`${brandName} now belongs to ${result.ownerAccountId}.`);
    onReassigned();
  }

  return (
    <>
      <Button size="small" variant="quietDanger" iconName="shield24" onClick={() => setIsOpen(true)}>Reassign brand</Button>
      {isOpen ? (
        <ConfirmActionDialog
          intent="transfer"
          isOpen
          title={`Reassign ${brandName}`}
          consequences={["The receiving account must not already have a Brand.", "The brand keeps its followers, posts and storefront.", "The change is saved to the audit log."]}
          confirmLabel="Reassign brand"
          tone="danger"
          requiresStepUp
          isConfirmDisabled={toAccountId.trim().length < 4}
          isBusy={mutation.isRunning}
          errorMessage={mutation.errorMessage}
          onConfirm={reassign}
          onClose={() => { mutation.clearError(); setIsOpen(false); }}
        >
          <TextField label="Receiving account ID" value={toAccountId} onChange={(event) => setToAccountId(event.target.value)} autoComplete="off" />
        </ConfirmActionDialog>
      ) : null}
    </>
  );
}
