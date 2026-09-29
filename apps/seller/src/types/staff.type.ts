import type { StaffRole } from "@/types/sellerAccess.type";

export interface StaffMember {
  readonly id: string;
  readonly userId: string | null;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly role: StaffRole;
  readonly status: "invited" | "active" | "suspended";
  readonly hasPosPin: boolean;
  readonly pinLockedUntil: string | null;
  readonly locationIds: string[];
  readonly lastActiveAt: string | null;
  readonly invitedAt: string;
}

export interface AuditLogEntry {
  readonly id: string;
  readonly actor: { readonly id: string; readonly name: string; readonly role: StaffRole };
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string | null;
  readonly summary: string;
  readonly ipAddress: string | null;
  readonly createdAt: string;
}
