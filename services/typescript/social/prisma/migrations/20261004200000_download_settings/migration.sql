-- CreateTable
CREATE TABLE "download_settings" (
    "accountId" UUID NOT NULL,
    "allowDownloads" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "download_settings_pkey" PRIMARY KEY ("accountId")
);

