-- reverse: create index "legalversion_one_open_per_document" to table: "legal_versions"
DROP INDEX "legalversion_one_open_per_document";
-- reverse: modify "legal_versions" table
ALTER TABLE "legal_versions" DROP COLUMN "effective_at_is_default";
-- reverse: drop index "legalversion_one_open_per_document" from table: "legal_versions"
CREATE UNIQUE INDEX "legalversion_one_open_per_document" ON "legal_versions" ("document_key") WHERE ((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('in_review'::character varying)::text]));
