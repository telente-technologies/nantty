CREATE TABLE "group_invitation_links" (
  "id" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),

  CONSTRAINT "group_invitation_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "group_invitation_links_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "group_invitation_links_tokenHash_key" ON "group_invitation_links"("tokenHash");
CREATE INDEX "group_invitation_links_conversationId_revokedAt_expiresAt_idx" ON "group_invitation_links"("conversationId", "revokedAt", "expiresAt");
CREATE INDEX "group_invitation_links_createdById_createdAt_idx" ON "group_invitation_links"("createdById", "createdAt");
