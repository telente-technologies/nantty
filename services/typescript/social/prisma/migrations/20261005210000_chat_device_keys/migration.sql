-- CreateTable
CREATE TABLE "chat_device_keys" (
    "accountId" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "identityKey" TEXT NOT NULL,
    "signedPreKeyId" INTEGER NOT NULL,
    "signedPreKey" TEXT NOT NULL,
    "signedPreKeySignature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_device_keys_pkey" PRIMARY KEY ("accountId","deviceId")
);

-- CreateTable
CREATE TABLE "chat_one_time_prekeys" (
    "accountId" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "keyId" INTEGER NOT NULL,
    "publicKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_one_time_prekeys_pkey" PRIMARY KEY ("accountId","deviceId","keyId")
);

-- AddForeignKey
ALTER TABLE "chat_one_time_prekeys" ADD CONSTRAINT "chat_one_time_prekeys_accountId_deviceId_fkey" FOREIGN KEY ("accountId", "deviceId") REFERENCES "chat_device_keys"("accountId", "deviceId") ON DELETE CASCADE ON UPDATE CASCADE;
