-- fold "creator-eligibility" into "creator-thresholds" and drop the phone-based rule fields
UPDATE "platform_settings" AS "thresholds" SET "value" = jsonb_set("thresholds"."value" #- '{autoApprove,requiresVerifiedPhone}', '{autoApprove}', (("thresholds"."value" -> 'autoApprove') - 'requiresVerifiedPhone') || jsonb_build_object(
  'maximumActiveStrikes', COALESCE("eligibility"."value" -> 'maximumActiveStrikes', '0'::jsonb),
  'requiresIdentityVerification', COALESCE("eligibility"."value" -> 'requiresIdentityVerification', 'false'::jsonb),
  'allowedCountries', COALESCE("eligibility"."value" -> 'allowedCountries', '[]'::jsonb))),
  "version" = "thresholds"."version" + 1, "updated_by" = 'system', "updated_at" = now()
FROM (SELECT (SELECT "value" FROM "platform_settings" WHERE "key" = 'creator-eligibility') AS "value") AS "eligibility"
WHERE "thresholds"."key" = 'creator-thresholds';
UPDATE "platform_settings" SET "value" = "value" - 'onePerPhone', "version" = "version" + 1, "updated_by" = 'system', "updated_at" = now() WHERE "key" = 'trial-rules' AND "value" ? 'onePerPhone';
INSERT INTO "platform_setting_revisions" ("id", "created_at", "key", "version", "value", "reason", "actor")
SELECT gen_random_uuid(), now(), "key", "version", "value", 'Creator eligibility folded into the thresholds; phone rules removed', 'system' FROM "platform_settings" AS "setting"
WHERE "key" IN ('creator-thresholds', 'trial-rules') AND NOT EXISTS (SELECT 1 FROM "platform_setting_revisions" AS "revision" WHERE "revision"."key" = "setting"."key" AND "revision"."version" = "setting"."version");
DELETE FROM "platform_settings" WHERE "key" = 'creator-eligibility';
