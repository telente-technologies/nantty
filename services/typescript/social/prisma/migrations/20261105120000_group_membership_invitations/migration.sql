CREATE TYPE "GroupInvitationStatus" AS ENUM ('pending', 'accepted', 'declined', 'revoked', 'expired');

ALTER TABLE "chat_settings"
  ADD COLUMN "preventDirectGroupAdds" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "group_membership_invitations" (
  "id" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "inviterId" UUID NOT NULL,
  "inviteeId" UUID NOT NULL,
  "status" "GroupInvitationStatus" NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "respondedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "group_membership_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "group_membership_invitations_conversationId_inviteeId_key" UNIQUE ("conversationId", "inviteeId"),
  CONSTRAINT "group_membership_invitations_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "group_membership_invitations_inviteeId_status_createdAt_id_idx"
  ON "group_membership_invitations"("inviteeId", "status", "createdAt", "id");
CREATE INDEX "group_membership_invitations_inviterId_status_createdAt_id_idx"
  ON "group_membership_invitations"("inviterId", "status", "createdAt", "id");
CREATE INDEX "group_membership_invitations_conversationId_inviteeId_status_idx"
  ON "group_membership_invitations"("conversationId", "inviteeId", "status");
