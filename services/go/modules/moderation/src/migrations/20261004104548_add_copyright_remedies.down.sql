-- reverse: create "copyright_policy_settings" table
DROP TABLE "copyright_policy_settings";
-- reverse: create index "strike_expiry_announced_at_expires_at" to table: "strikes"
DROP INDEX "strike_expiry_announced_at_expires_at";
-- reverse: create index "strike_appeal_status_appealed_at" to table: "strikes"
DROP INDEX "strike_appeal_status_appealed_at";
-- reverse: modify "strikes" table
ALTER TABLE "strikes" DROP COLUMN "expiry_announced_at", DROP COLUMN "appealed_at", DROP COLUMN "appeal_message", DROP COLUMN "appeal_status";
-- reverse: create index "copyrightclaim_remedy_state_takedown_deadline_at" to table: "copyright_claims"
DROP INDEX "copyrightclaim_remedy_state_takedown_deadline_at";
-- reverse: modify "copyright_claims" table
ALTER TABLE "copyright_claims" DROP COLUMN "warning_id", DROP COLUMN "takedown_deadline_at", DROP COLUMN "remedy_state", DROP COLUMN "remedy", DROP COLUMN "signed_at", DROP COLUMN "signature_name", DROP COLUMN "accuracy_declared", DROP COLUMN "infringing_segments", DROP COLUMN "proof_media_ids", DROP COLUMN "proof_urls", DROP COLUMN "original_work_media_id", DROP COLUMN "original_work_url", DROP COLUMN "claimant_address", DROP COLUMN "claimant_phone", DROP COLUMN "claim_scope";
