DO $$
DECLARE
  current_setting record;
  prior_value jsonb;
BEGIN
  SELECT * INTO current_setting FROM "platform_settings" WHERE "key" = 'creator-thresholds' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT "value" INTO prior_value FROM "platform_setting_revisions"
    WHERE "key" = 'creator-thresholds' AND "version" = current_setting."version" - 1;
  IF prior_value IS NULL THEN
    RAISE EXCEPTION 'Cannot restore the prior Creator Program policy revision';
  END IF;
  INSERT INTO "platform_setting_revisions" ("id", "created_at", "key", "version", "value", "reason", "actor")
    VALUES (gen_random_uuid(), now(), current_setting."key", current_setting."version", current_setting."value", 'Snapshot before Creator Program policy rollback', 'system')
    ON CONFLICT ("key", "version") DO NOTHING;
  UPDATE "platform_settings" SET "value" = prior_value, "version" = "version" + 1, "updated_by" = 'system', "updated_at" = now()
    WHERE "key" = 'creator-thresholds';
  INSERT INTO "platform_setting_revisions" ("id", "created_at", "key", "version", "value", "reason", "actor")
    SELECT gen_random_uuid(), now(), "key", "version", "value", 'Restore Creator Program policy from prior recorded revision', 'system'
    FROM "platform_settings" WHERE "key" = 'creator-thresholds'
    ON CONFLICT ("key", "version") DO NOTHING;
END $$;
