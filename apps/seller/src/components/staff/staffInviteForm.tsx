"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PlanGate } from "@/components/billing/planGate";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { StaffLocationChecklist } from "@/components/staff/staffLocationChecklist";
import { NanttyUserPicker } from "@/components/staff/nanttyUserPicker";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormErrorSummary, SelectField } from "@/components/ui/formFields";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { staffRoleDescriptions, staffRoleLabels } from "@/constants/roles.constant";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import type { StaffRole } from "@/types/sellerAccess.type";
import type { NanttyUserCandidate } from "@/types/staff.type";
import { convertIssuesToFieldErrorMap, fieldChecks, validateObjectAgainstChecks } from "@/utils/formValidation.util";
import { listRolesActorMayAssign } from "@/utils/staffEditingRules.util";

import styles from "./staff.module.css";


export function StaffInviteForm() {
  const router = useRouter();
  const { sessionView } = useSellerSession();
  const { locations, selectedLocationId } = useStoreContext();
  const { showToast } = useToast();
  const assignableRoles = listRolesActorMayAssign(sessionView?.effectiveRole ?? null);
  const [role, setRole] = useState<StaffRole>("sales");
  const [selectedUser, setSelectedUser] = useState<NanttyUserCandidate | null>(null);
  const [locationIds, setLocationIds] = useState<string[]>(selectedLocationId ? [selectedLocationId] : []);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function addNanttyUserToTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issues = validateObjectAgainstChecks({ role }, { role: fieldChecks.oneOf("Role", assignableRoles) });
    if (!selectedUser) issues.push({ path: "userId", message: "Search for the person's Nantty username and select them." });
    if (locationIds.length === 0) issues.push({ path: "locationIds", message: "Pick at least one location." });
    setFieldErrors(convertIssuesToFieldErrorMap(issues));
    if (issues.length > 0 || !selectedUser) return;
    setIsSubmitting(true);
    try {
      await sendSellerApiRequest("/seller/staff", { method: "POST", body: { userId: selectedUser.userId, role, locationIds } });
      showToast(`Team request sent to @${selectedUser.username}. They accept it in the Nantty app.`);
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
        title="Add team member"
        description="Team members are people who already use the Nantty app. Search their username, pick a role, and they accept your request in the app. They sign in here with their own Nantty account — no new passwords."
        actions={<ButtonLink href="/staff">Back to team</ButtonLink>}
      />
      <PlanGate feature="team">
      <form onSubmit={addNanttyUserToTeam} noValidate>
        <Panel title="New team member" actions={<Button type="submit" variant="primary" isBusy={isSubmitting}>Send team request</Button>}>
          <div className={styles.stack}>
            <FormErrorSummary messages={Object.values(fieldErrors)} />
            <NanttyUserPicker selectedUser={selectedUser} onSelectUser={setSelectedUser} searchApiPath="/seller/staff/candidates" />
            <SelectField label="Role" value={role} onChange={(event) => setRole(event.target.value as StaffRole)} options={assignableRoles.map((assignableRole) => ({ value: assignableRole, label: staffRoleLabels[assignableRole] }))} errorMessage={fieldErrors.role} hint={staffRoleDescriptions[role]} />
            <StaffLocationChecklist locations={locations} selectedLocationIds={locationIds} onChange={setLocationIds} errorMessage={fieldErrors.locationIds} />
          </div>
        </Panel>
      </form>
      </PlanGate>
    </PageStack>
  );
}
