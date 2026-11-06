CREATE TYPE "ChannelInvitationStatus" AS ENUM ('pending', 'accepted', 'declined', 'expired');

CREATE TABLE "channel_invitations" (
  "id" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "inviterId" UUID NOT NULL,
  "inviteeId" UUID NOT NULL,
  "status" "ChannelInvitationStatus" NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "respondedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "channel_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "channel_invitations_conversationId_inviteeId_key" UNIQUE ("conversationId", "inviteeId"),
  CONSTRAINT "channel_invitations_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "channel_invitations_inviteeId_status_createdAt_id_idx"
  ON "channel_invitations"("inviteeId", "status", "createdAt", "id");
CREATE INDEX "channel_invitations_conversationId_inviteeId_status_idx"
  ON "channel_invitations"("conversationId", "inviteeId", "status");

CREATE TABLE "channel_invitation_links" (
  "id" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),

  CONSTRAINT "channel_invitation_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "channel_invitation_links_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "channel_invitation_links_tokenHash_key" ON "channel_invitation_links"("tokenHash");
CREATE INDEX "channel_invitation_links_conversationId_revokedAt_expiresAt_idx"
  ON "channel_invitation_links"("conversationId", "revokedAt", "expiresAt");
CREATE INDEX "channel_invitation_links_createdById_createdAt_idx"
  ON "channel_invitation_links"("createdById", "createdAt");
