import { staffRoles } from "@/constants/roles.constant";
import type { SellerSessionView, StaffRole } from "@/types/sellerAccess.type";
import type { StaffMember } from "@/types/staff.type";

export function isStaffMemberTheSignedInActor(member: StaffMember, sessionView: SellerSessionView | null): boolean {
  if (!sessionView) return false;
  if (sessionView.operator) return sessionView.operator.staffId === member.id;
  return member.userId !== null && member.userId === sessionView.user.id;
}

export function listRolesActorMayAssign(actorRole: StaffRole | null): StaffRole[] {
  return staffRoles.filter((role) => role !== "owner" && (role !== "admin" || actorRole === "owner"));
}

export function canActorManageStaffMember(member: StaffMember, sessionView: SellerSessionView | null): boolean {
  const actorRole = sessionView?.effectiveRole ?? null;
  if (member.role === "owner") return false;
  if (member.role === "admin" && actorRole !== "owner") return false;
  return !isStaffMemberTheSignedInActor(member, sessionView);
}

export function countStaffSeatsInUse(members: readonly StaffMember[]): number {
  return members.filter((member) => member.status !== "suspended").length;
}

export function isPinCurrentlyLocked(member: StaffMember): boolean {
  return member.pinLockedUntil !== null && new Date(member.pinLockedUntil).getTime() > Date.now();
}

export function validatePosPinPair(pin: string, confirmation: string): string | null {
  if (!/^\d{4,6}$/.test(pin)) return "The PIN must be 4 to 6 digits.";
  if (/^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) return "Pick a PIN that is harder to guess than a repeated digit or a straight run.";
  if (pin !== confirmation) return "The two PINs do not match.";
  return null;
}
