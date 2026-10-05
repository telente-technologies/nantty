-- CreateTable
CREATE TABLE "chat_key_mailbox" (
    "id" UUID NOT NULL,
    "recipientAccountId" UUID NOT NULL,
    "recipientDeviceId" TEXT NOT NULL,
    "senderAccountId" UUID NOT NULL,
    "senderDeviceId" TEXT NOT NULL,
    "conversationId" UUID NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_key_mailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_prekey_claims" (
    "id" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_prekey_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_key_mailbox_recipientAccountId_recipientDeviceId_id_idx" ON "chat_key_mailbox"("recipientAccountId", "recipientDeviceId", "id");

-- CreateIndex
CREATE INDEX "chat_key_mailbox_createdAt_idx" ON "chat_key_mailbox"("createdAt");

-- CreateIndex
CREATE INDEX "chat_prekey_claims_requesterId_targetId_claimedAt_idx" ON "chat_prekey_claims"("requesterId", "targetId", "claimedAt");

-- CreateIndex
CREATE INDEX "chat_prekey_claims_requesterId_claimedAt_idx" ON "chat_prekey_claims"("requesterId", "claimedAt");

-- AddForeignKey
ALTER TABLE "chat_key_mailbox" ADD CONSTRAINT "chat_key_mailbox_recipientAccountId_recipientDeviceId_fkey" FOREIGN KEY ("recipientAccountId", "recipientDeviceId") REFERENCES "chat_device_keys"("accountId", "deviceId") ON DELETE CASCADE ON UPDATE CASCADE;
