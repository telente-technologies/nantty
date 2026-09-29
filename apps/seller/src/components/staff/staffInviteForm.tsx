"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { StaffLocationChecklist } from "@/components/staff/staffLocationChecklist";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { FormErrorSummary, SelectField, TextField } from "@/components/ui/formFields";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { staffRoleLabels } from "@/constants/roles.constant";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import type { StaffRole } from "@/types/sellerAccess.type";
import { convertIssuesToFieldErrorMap, fieldChecks, validateObjectAgainstChecks } from "@/utils/formValidation.util";
import { listRolesActorMayAssign } from "@/utils/staffEditingRules.util";

import styles from "./staff.module.css";

const roleDescriptions: Record<StaffRole, string> = {
  owner: "",
  admin: "Everything except billing and withdrawals.",
  manager: "Runs the shop floor: register, refunds, discounts, stock, orders, customers, reports.",
  cashier: "Register and their own shift only.",
  inventory: "Products, stock counts and transfers.",
  support: "Online orders, returns, disputes and customers.",
};

export function StaffInviteForm() {
  const router = useRouter();
  const { sessionView } = useSellerSession();
  const { locations, selectedLocationId } = useStoreContext();
  const { showToast } = useToast();
  const assignableRoles = listRolesActorMayAssign(sessionView?.effectiveRole ?? null);
  const [draft, setDraft] = useState({ name: "", email: "", phone: "", role: "cashier" as StaffRole });
  const [locationIds, setLocationIds] = useState<string[]>(selectedLocationId ? [selectedLocationId] : []);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function sendStaffInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issues = validateObjectAgainstChecks(draft, {
      name: fieldChecks.text({ label: "Name", min: 2, max: 80 }),
      email: fieldChecks.optional(fieldChecks.email()),
      phone: fieldChecks.optional(fieldChecks.phone()),
      role: fieldChecks.oneOf("Role", assignableRoles),
    });
    if (!draft.email.trim() && !draft.phone.trim()) issues.push({ path: "email", message: "Add an email or a phone number to send the invite to." });
    if (locationIds.length === 0) issues.push({ path: "locationIds", message: "Pick at least one location." });
    setFieldErrors(convertIssuesToFieldErrorMap(issues));
    if (issues.length > 0) return;
    setIsSubmitting(true);
    try {
      await sendSellerApiRequest("/seller/staff", { method: "POST", body: { name: draft.name.trim(), email: draft.email.trim() || null, phone: draft.phone.trim() || null, role: draft.role, locationIds } });
      showToast(`Invite sent to ${draft.name.trim()}.`);
      router.push("/staff");
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues?.length) setFieldErrors(convertIssuesToFieldErrorMap(error.issues));
      showToast(readErrorMessageForDisplay(error), "error");
      setIsSubmitting(false);
    }
  }

  return (
    <PageStack>
      <PageHeader title="Invite staff" description="They sign in with their own Zudomart account. Invites go to the email or phone you enter." actions={<ButtonLink href="/staff">Back to staff</ButtonLink>} />
      <form onSubmit={sendStaffInvite} noValidate>
        <Panel title="New team member" actions={<Button type="submit" variant="primary" isBusy={isSubmitting}>Send invite</Button>}>
          <div className={styles.stack}>
            <FormErrorSummary messages={Object.values(fieldErrors)} />
            <div className={styles.twoColumns}>
              <TextField label="Full name" value={draft.name} maxLength={80} onChange={(event) => setDraft({ ...draft, name: event.target.value })} errorMessage={fieldErrors.name} />
              <TextField label="Email" type="email" value={draft.email} maxLength={254} onChange={(event) => setDraft({ ...draft, email: event.target.value })} errorMessage={fieldErrors.email} />
              <TextField label="Phone" type="tel" value={draft.phone} maxLength={20} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} errorMessage={fieldErrors.phone} hint="Either email or phone is enough." />
              <SelectField label="Role" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as StaffRole })} options={assignableRoles.map((role) => ({ value: role, label: staffRoleLabels[role] }))} errorMessage={fieldErrors.role} hint={roleDescriptions[draft.role]} />
            </div>
            <StaffLocationChecklist locations={locations} selectedLocationIds={locationIds} onChange={setLocationIds} errorMessage={fieldErrors.locationIds} />
            {draft.role === "cashier" ? <Callout tone="info">After they accept, set a register PIN for them from the staff list so they can unlock shared tills.</Callout> : null}
          </div>
        </Panel>
      </form>
    </PageStack>
  );
}
