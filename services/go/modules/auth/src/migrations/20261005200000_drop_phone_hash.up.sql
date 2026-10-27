-- nothing reads or writes phone_hash any more: subscriptions now claims trials by email
REVOKE SELECT ("phone_hash") ON "accounts" FROM nantty_readers;
ALTER TABLE "accounts" DROP COLUMN "phone_hash";
