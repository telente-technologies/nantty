"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { StaffLocationChecklist } from "@/components/staff/staffLocationChecklist";
import { ZudomartUserPicker } from "@/components/staff/zudomartUserPicker";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { FormErrorSummary, SelectField } from "@/components/ui/formFields";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { staffRoleLabels } from "@/constants/roles.constant";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import type { StaffRole } from "@/types/sellerAccess.type";
import type { ZudomartUserCandidate } from "@/types/staff.type";
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
  const [role, setRole] = useState<StaffRole>("cashier");
  const [selectedUser, setSelectedUser] = useState<ZudomartUserCandidate | null>(null);
  const [locationIds, setLocationIds] = useState<string[]>(selectedLocationId ? [selectedLocationId] : []);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function addZudomartUserToTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issues = validateObjectAgainstChecks({ role }, { role: fieldChecks.oneOf("Role", assignableRoles) });
    if (!selectedUser) issues.push({ path: "userId", message: "Search for the person's Zudomart username and select them." });
    if (locationIds.length === 0) issues.push({ path: "locationIds", message: "Pick at least one location." });
    setFieldErrors(convertIssuesToFieldErrorMap(issues));
    if (issues.length > 0 || !selectedUser) return;
    setIsSubmitting(true);
    try {
      await sendSellerApiRequest("/seller/staff", { method: "POST", body: { userId: selectedUser.userId, role, locationIds } });
      showToast(`Team request sent to @${selectedUser.username}. They accept it in the Zudomart app.`);
      router.push("/staff");
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues?.length) setFieldErrors(convertIssuesToFieldErrorMap(error.issues));
      showToast(readErrorMessageForDisplay(error), "error");
      setIsSubmitting(false);
    }
  }

  return (
    <PageStack>
      <PageHeader
        title="Add staff"
        description="Staff are people who already use the Zudomart app. They accept your request in the app and sign in here with their own Zudomart account."
        actions={<ButtonLink href="/staff">Back to staff</ButtonLink>}
      />
      <form onSubmit={addZudomartUserToTeam} noValidate>
        <Panel title="New team member" actions={<Button type="submit" variant="primary" isBusy={isSubmitting}>Send team request</Button>}>
          <div className={styles.stack}>
            <FormErrorSummary messages={Object.values(fieldErrors)} />
            <ZudomartUserPicker selectedUser={selectedUser} onSelectUser={setSelectedUser} searchApiPath="/seller/staff/candidates" />
            <SelectField label="Role" value={role} onChange={(event) => setRole(event.target.value as StaffRole)} options={assignableRoles.map((assignableRole) => ({ value: assignableRole, label: staffRoleLabels[assignableRole] }))} errorMessage={fieldErrors.role} hint={roleDescriptions[role]} />
            <StaffLocationChecklist locations={locations} selectedLocationIds={locationIds} onChange={setLocationIds} errorMessage={fieldErrors.locationIds} />
            {role === "cashier" ? <Callout tone="info">After they accept, set a register PIN for them from the staff list so they can unlock shared tills.</Callout> : null}
          </div>
        </Panel>
      </form>
    </PageStack>
  );
}
