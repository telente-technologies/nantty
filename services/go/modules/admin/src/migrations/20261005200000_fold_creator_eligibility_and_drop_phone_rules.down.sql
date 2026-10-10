-- the folded creator eligibility document is served from "creator-thresholds"; restore only the removed phone fields
UPDATE "platform_settings" SET "value" = jsonb_set("value", '{autoApprove,requiresVerifiedPhone}', 'false'::jsonb) WHERE "key" = 'creator-thresholds';
UPDATE "platform_settings" SET "value" = "value" || '{"onePerPhone": false}'::jsonb WHERE "key" = 'trial-rules';
