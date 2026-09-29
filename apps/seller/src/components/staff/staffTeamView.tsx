"use client";

import { useMemo, useState } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { StaffMemberDialog } from "@/components/staff/staffMemberDialog";
import { StaffSeatMeter } from "@/components/staff/staffSeatMeter";
import { ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { Callout } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/filterControls";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { staffRoleLabels } from "@/constants/roles.constant";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { CursorPage } from "@/types/pagination.type";
import type { StaffMember } from "@/types/staff.type";
import { formatRelativeTimeFromNow } from "@/utils/dateFormatting.util";
import { countStaffSeatsInUse, isPinCurrentlyLocked } from "@/utils/staffEditingRules.util";

import styles from "./staff.module.css";

export function StaffTeamView() {
  const { sessionView, can } = useSellerSession();
  const { locations } = useStoreContext();
  const [searchText, setSearchText] = useState("");
  const [openMember, setOpenMember] = useState<StaffMember | null>(null);
  const staffQuery = useSellerQuery<CursorPage<StaffMember>>("/seller/staff", { q: searchText, limit: 200 });
  const members = staffQuery.data?.data ?? [];
  const entitlements = sessionView?.access.entitlements ?? null;
  const maximumSeats = entitlements ? entitlements.maxStaffSeats : 0;
  const seatsInUse = countStaffSeatsInUse(members);
  const hasFreeSeat = maximumSeats === null || seatsInUse < maximumSeats;
  const locationNameById = useMemo(() => new Map(locations.map((location) => [location.id, location.name])), [locations]);

  return (
    <PageStack>
      <PageHeader
        title="Staff"
        description="Who can sign in, what they can do, and their register PINs."
        actions={
          <>
            {can("audit:view") ? <ButtonLink href="/staff/activity" iconName="textIndent24">Activity log</ButtonLink> : null}
            {hasFreeSeat ? <ButtonLink href="/staff/invite" variant="primary" iconName="plus16">Invite staff</ButtonLink> : null}
          </>
        }
      />
      {!searchText && staffQuery.data ? <StaffSeatMeter seatsInUse={seatsInUse} maximumSeats={maximumSeats} /> : null}
      {!hasFreeSeat && staffQuery.data ? (
        <Callout tone="caution" title="Every staff seat on your Gold plan is in use" action={can("billing:manage") ? <ButtonLink href="/settings/billing" size="small">See plans</ButtonLink> : null}>
          Suspend or remove someone, or move to a bigger plan, to invite more people.
        </Callout>
      ) : null}
      {staffQuery.errorMessage ? <Callout tone="error">{staffQuery.errorMessage}</Callout> : null}
      <Panel padded={false} title={<SearchInput label="Search staff" placeholder="Search by name, email or phone" value={searchText} onValueChange={setSearchText} />}>
        <DataTable<StaffMember>
          caption="Team members"
          rows={staffQuery.data ? members : null}
          isLoading={staffQuery.isLoading}
          readRowKey={(member) => member.id}
          onRowActivate={setOpenMember}
          emptyState={searchText ? `No one matches “${searchText}”.` : "Invite your first team member."}
          columns={[
            {
              key: "name",
              header: "Name",
              render: (member) => (
                <span className={styles.memberName}>
                  <strong>{member.name}</strong>
                  <span className={styles.memberContact}>{member.email ?? member.phone ?? "—"}</span>
                </span>
              ),
            },
            { key: "role", header: "Role", render: (member) => staffRoleLabels[member.role] },
            {
              key: "status",
              header: "Status",
              render: (member) => <StatusBadge tone={member.status === "active" ? "success" : member.status === "invited" ? "info" : "neutral"}>{member.status === "active" ? "Active" : member.status === "invited" ? "Invited" : "Suspended"}</StatusBadge>,
            },
            { key: "locations", header: "Locations", hideBelowTablet: true, render: (member) => member.locationIds.map((locationId) => locationNameById.get(locationId) ?? locationId).join(", ") },
            {
              key: "pin",
              header: "Register PIN",
              render: (member) => (isPinCurrentlyLocked(member) ? <StatusBadge tone="error">Locked</StatusBadge> : member.hasPosPin ? <StatusBadge tone="success">Set</StatusBadge> : <StatusBadge>Not set</StatusBadge>),
            },
            { key: "lastActive", header: "Last active", hideBelowTablet: true, render: (member) => (member.lastActiveAt ? formatRelativeTimeFromNow(member.lastActiveAt) : "Never") },
          ]}
        />
      </Panel>
      {openMember ? <StaffMemberDialog key={openMember.id} member={openMember} hasFreeSeat={hasFreeSeat} onClose={() => setOpenMember(null)} onMemberChanged={staffQuery.reload} /> : null}
    </PageStack>
  );
}
