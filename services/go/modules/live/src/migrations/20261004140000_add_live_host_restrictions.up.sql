-- create "live_host_restrictions" table
CREATE TABLE "live_host_restrictions" ("id" character varying NOT NULL, "can_go_live" boolean NOT NULL DEFAULT true, "health_changed_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
