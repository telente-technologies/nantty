"use client";

import { PlanLockedNotice } from "@/components/billing/planGate";
import { StaffSeatMeter } from "@/components/staff/staffSeatMeter";
import { ButtonLink } from "@/components/ui/button";
import { ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { KeyValueList, Panel } from "@/components/ui/panel";
import { staffRoleLabels, staffRoles } from "@/constants/roles.constant";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { CursorPage } from "@/types/pagination.type";
import type { StaffMember } from "@/types/staff.type";
import { countStaffSeatsInUse } from "@/utils/staffEditingRules.util";

import styles from "./settings.module.css";

export function TeamSettingsSummary() {
  const { hasFeature, limits } = usePlanFeatures();
  const staffQuery = useSellerQuery<CursorPage<StaffMember>>("/seller/staff", { limit: 200 });
  const members = staffQuery.data?.data;
  return (
    <Panel
      title="Team"
      description="Team members are Nantty app users you add by username. They sign in with their own Nantty account."
      actions={
        <>
          <ButtonLink href="/staff/roles" size="small">Roles & permissions</ButtonLink>
          <ButtonLink href="/staff" size="small" variant="primary">Manage team</ButtonLink>
        </>
      }
    >
      <div className={styles.formStack}>
        {hasFeature("team") ? null : <PlanLockedNotice feature="team" compact />}
        {staffQuery.isLoading && !members ? <LoadingBlock label="Loading team" /> : null}
        {staffQuery.errorMessage ? <ErrorCallout error={staffQuery.error} message={staffQuery.errorMessage} onRetry={staffQuery.reload} /> : null}
        {members ? (
          <>
            {hasFeature("team") ? <StaffSeatMeter seatsInUse={countStaffSeatsInUse(members)} maximumSeats={limits.maxStaffSeats} /> : null}
            <KeyValueList
              items={staffRoles.map((role) => ({
                label: staffRoleLabels[role],
                value: `${members.filter((member) => member.role === role && member.status !== "suspended").length} active`,
              }))}
            />
            <p className={styles.mutedText}>
              {members.filter((member) => member.status === "invited").length} waiting to accept · {members.filter((member) => member.permissions !== null).length} with custom permissions
            </p>
          </>
        ) : null}
      </div>
    </Panel>
  );
}
