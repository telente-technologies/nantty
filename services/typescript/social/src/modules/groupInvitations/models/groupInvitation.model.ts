import type { GroupInvitationStatus } from "../../../generated/prisma/client.js";
import type { UserSummary } from "../../../interfaces/identityDirectory.interface.js";

export interface GroupInvitationView {
  readonly id: string;
  readonly conversationId: string;
  readonly inviterId: string;
  readonly inviteeId: string;
  readonly status: GroupInvitationStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly counterpart: UserSummary | null;
  /** Consent is persisted, but membership is withheld until a future secure key handoff is available. */
  readonly membershipStatus: "not_joined" | "awaiting_secure_key_handoff";
}
