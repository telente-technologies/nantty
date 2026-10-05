-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "orderId" UUID,
ADD COLUMN     "orderNumber" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "senderLabel" TEXT;

-- CreateIndex
CREATE INDEX "conversations_storeId_lastMessageAt_idx" ON "conversations"("storeId", "lastMessageAt");

