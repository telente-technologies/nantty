ALTER TABLE "verification_cases" ADD COLUMN "smile_user_id" character varying NULL;
CREATE UNIQUE INDEX "verification_cases_smile_user_id_key" ON "verification_cases" ("smile_user_id");
