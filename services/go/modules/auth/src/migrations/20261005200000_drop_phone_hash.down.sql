ALTER TABLE "accounts" ADD COLUMN "phone_hash" character varying NULL;
GRANT SELECT ("phone_hash") ON "accounts" TO zudomart_readers;
