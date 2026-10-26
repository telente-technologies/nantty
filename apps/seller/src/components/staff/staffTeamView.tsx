"use client";

import { useState } from "react";

import { PlanLockedNotice } from "@/components/billing/planGate";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { StaffMemberDialog } from "@/components/staff/staffMemberDialog";
import { StaffSeatMeter } from "@/components/staff/staffSeatMeter";
import { StaffTeamTable } from "@/components/staff/staffTeamTable";
import { ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/filterControls";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { CursorPage } from "@/types/pagination.type";
import type { StaffMember } from "@/types/staff.type";
import { countStaffSeatsInUse } from "@/utils/staffEditingRules.util";

export function StaffTeamView() {
  const { can } = useSellerSession();
  const { hasFeature, limits } = usePlanFeatures();
  const [searchText, setSearchText] = useState("");
  const [openMember, setOpenMember] = useState<StaffMember | null>(null);
  const staffQuery = useSellerQuery<CursorPage<StaffMember>>("/seller/staff", { q: searchText, limit: 200 });
  const canUseTeam = hasFeature("team");
  const everyMember = staffQuery.data?.data ?? null;
  const visibleMembers = everyMember && !canUseTeam ? everyMember.filter((member) => member.role === "owner") : everyMember;
  const seatsInUse = countStaffSeatsInUse(everyMember ?? []);
  const hasFreeSeat = canUseTeam && seatsInUse < limits.maxStaffSeats;

  return (
    <PageStack>
      <PageHeader
        title="Team"
        description="People who help run your store. Each one is an existing Nantty app user who accepts your request in the app and signs in here with their own account."
        actions={
          <>
            <ButtonLink href="/staff/roles" iconName="shield24">Roles & permissions</ButtonLink>
            {can("audit:view") ? <ButtonLink href="/staff/activity" iconName="textIndent24">Activity log</ButtonLink> : null}
            {hasFreeSeat ? <ButtonLink href="/staff/invite" variant="primary" iconName="plus16">Add team member</ButtonLink> : null}
          </>
        }
      />
      {canUseTeam ? null : <PlanLockedNotice feature="team" description="On Free, only the owner signs in. Upgrade to Pro to add up to 5 Nantty users as Managers, Inventory staff, Sales staff or Accountants." />}
      {canUseTeam && !searchText && staffQuery.data ? <StaffSeatMeter seatsInUse={seatsInUse} maximumSeats={limits.maxStaffSeats} /> : null}
      {canUseTeam && !hasFreeSeat && staffQuery.data ? (
        <Callout tone="caution" title="Every team seat on your plan is in use" action={can("billing:manage") ? <ButtonLink href="/settings/billing" size="small">See plans</ButtonLink> : null}>
          Suspend or remove someone, or move to a bigger plan, to add more people.
        </Callout>
      ) : null}
      <Panel padded={false} title={<SearchInput label="Search team" placeholder="Search by name or @username" value={searchText} onValueChange={setSearchText} />}>
        <StaffTeamTable
          members={visibleMembers}
          isLoading={staffQuery.isLoading}
          errorMessage={staffQuery.errorMessage}
          onRetry={staffQuery.reload}
          onOpenMember={setOpenMember}
          emptyText={searchText ? `No one matches “${searchText}”.` : "Add your first team member by their Nantty username."}
        />
      </Panel>
      {openMember ? <StaffMemberDialog key={openMember.id} member={openMember} hasFreeSeat={hasFreeSeat} onClose={() => setOpenMember(null)} onMemberChanged={staffQuery.reload} /> : null}
    </PageStack>
  );
}
