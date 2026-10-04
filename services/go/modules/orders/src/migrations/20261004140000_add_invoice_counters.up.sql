-- create "invoice_counters" table
CREATE TABLE "invoice_counters" ("id" uuid NOT NULL, "last_number" bigint NOT NULL DEFAULT 0, PRIMARY KEY ("id"));
