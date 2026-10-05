-- phone_hash stays until go-money subscriptions stops reading it (identityDirectory.repository.go); nothing writes it any more
ALTER TABLE "accounts" DROP COLUMN "phone_verified_at";
DELETE FROM "registration_blocks" WHERE "kind" = 'phone';
