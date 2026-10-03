import { staffRoles } from "@/constants/roles.constant";
import type { SellerSessionView, StaffRole } from "@/types/sellerAccess.type";
import type { StaffMember } from "@/types/staff.type";

export function isStaffMemberTheSignedInActor(member: StaffMember, sessionView: SellerSessionView | null): boolean {
  if (!sessionView) return false;
  return member.userId !== null && member.userId === sessionView.user.id;
}

export function listRolesActorMayAssign(actorRole: StaffRole | null): StaffRole[] {
  return staffRoles.filter((role) => role !== "owner" && (role !== "manager" || actorRole === "owner"));
}

export function canActorManageStaffMember(member: StaffMember, sessionView: SellerSessionView | null): boolean {
  const actorRole = sessionView?.effectiveRole ?? null;
  if (member.role === "owner") return false;
  if (member.role === "manager" && actorRole !== "owner") return false;
  return !isStaffMemberTheSignedInActor(member, sessionView);
}

export function countStaffSeatsInUse(members: readonly StaffMember[]): number {
  return members.filter((member) => member.status !== "suspended" && member.role !== "owner").length;
}
