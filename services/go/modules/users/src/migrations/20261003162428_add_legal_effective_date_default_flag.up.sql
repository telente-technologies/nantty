-- drop index "legalversion_one_open_per_document" from table: "legal_versions"
DROP INDEX "legalversion_one_open_per_document";
-- modify "legal_versions" table
ALTER TABLE "legal_versions" ADD COLUMN "effective_at_is_default" boolean NOT NULL DEFAULT false;
-- create index "legalversion_one_open_per_document" to table: "legal_versions"
CREATE UNIQUE INDEX "legalversion_one_open_per_document" ON "legal_versions" ("document_key") WHERE ((status)::text = ANY ((ARRAY['draft'::character varying, 'in_review'::character varying])::text[]));
