INSERT INTO "platform_setting_revisions" ("id", "created_at", "key", "version", "value", "reason", "actor")
SELECT gen_random_uuid(), now(), "key", "version", "value", 'Snapshot before enforcing updated Creator Program minimum eligibility', 'system'
FROM "platform_settings"
WHERE "key" = 'creator-thresholds'
ON CONFLICT ("key", "version") DO NOTHING;

UPDATE "platform_settings" AS "setting"
SET "value" = jsonb_set(
  "setting"."value",
  '{autoApprove}',
  (COALESCE("setting"."value" -> 'autoApprove', '{}'::jsonb) - 'allowedCountries' - 'maximumActiveStrikes') || jsonb_build_object(
    'minimumAccountAgeDays', GREATEST(COALESCE(NULLIF("setting"."value" #>> '{autoApprove,minimumAccountAgeDays}', '')::integer, 0), 30),
    'requiresVerifiedEmail', true,
    'minimumRealFollowers', GREATEST(COALESCE(NULLIF("setting"."value" #>> '{autoApprove,minimumRealFollowers}', '')::integer, 0), 10000),
    'minimumVerifiedFollowers', GREATEST(COALESCE(NULLIF("setting"."value" #>> '{autoApprove,minimumVerifiedFollowers}', '')::integer, 0), 500),
    'minimumQualifyingImpressionsLast30Days', GREATEST(COALESCE(NULLIF("setting"."value" #>> '{autoApprove,minimumQualifyingImpressionsLast30Days}', '')::integer, 0), 100000),
    'minimumOriginalPostsInLast60Days', GREATEST(COALESCE(NULLIF("setting"."value" #>> '{autoApprove,minimumOriginalPostsInLast60Days}', '')::integer, 0), 10),
    'noViolationsInDays', GREATEST(COALESCE(NULLIF("setting"."value" #>> '{autoApprove,noViolationsInDays}', '')::integer, 0), 90)
  ),
  true
) || jsonb_build_object(
  'manualReview', COALESCE("setting"."value" -> 'manualReview', '{}'::jsonb) - 'minimumRealFollowers'
),
"version" = "version" + 1,
"updated_by" = 'system',
"updated_at" = now()
WHERE "key" = 'creator-thresholds';

INSERT INTO "platform_setting_revisions" ("id", "created_at", "key", "version", "value", "reason", "actor")
SELECT gen_random_uuid(), now(), "key", "version", "value", 'Enforce 10000 real followers, 500 verified followers, 100000 qualifying 30-day impressions and existing account/content minimums', 'system'
FROM "platform_settings"
WHERE "key" = 'creator-thresholds'
ON CONFLICT ("key", "version") DO NOTHING;
