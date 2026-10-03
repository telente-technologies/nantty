-- creator accounts are personal accounts with an approved creator status
UPDATE "profiles" AS "personal" SET "creator_status" = 'approved' FROM "profiles" AS "creator" WHERE "creator"."kind" = 'creator' AND "creator"."status" = 'active' AND "personal"."account_id" = "creator"."account_id" AND "personal"."kind" = 'personal';
UPDATE "acting_profiles" SET "profile_id" = "personal"."id" FROM "profiles" AS "creator", "profiles" AS "personal" WHERE "acting_profiles"."profile_id" = "creator"."id" AND "creator"."kind" = 'creator' AND "personal"."account_id" = "creator"."account_id" AND "personal"."kind" = 'personal';
DELETE FROM "profiles" WHERE "kind" = 'creator';
