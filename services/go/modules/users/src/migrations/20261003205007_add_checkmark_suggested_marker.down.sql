-- reverse: modify "profile_signals" table
ALTER TABLE "profile_signals" DROP COLUMN "checkmark_suggested_at";
-- reverse: create index "legalversion_one_open_per_document" to table: "legal_versions"
DROP INDEX "legalversion_one_open_per_document";
-- reverse: drop index "legalversion_one_open_per_document" from table: "legal_versions"
CREATE UNIQUE INDEX "legalversion_one_open_per_document" ON "legal_versions" ("document_key") WHERE ((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('in_review'::character varying)::text]));
