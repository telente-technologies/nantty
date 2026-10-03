-- modify "audit_events" table
ALTER TABLE "audit_events" ADD COLUMN "actor_name" character varying NOT NULL DEFAULT '', ADD COLUMN "actor_departments" jsonb NOT NULL DEFAULT '[]', ADD COLUMN "step_up_verified" boolean NOT NULL DEFAULT false, ADD COLUMN "subject_label" character varying NOT NULL DEFAULT '';
-- modify "staff_accounts" table
ALTER TABLE "staff_accounts" ADD COLUMN "role_ids" jsonb NOT NULL DEFAULT '[]', ADD COLUMN "approved_by" uuid NULL, ADD COLUMN "approved_at" timestamptz NULL;
-- create "staff_roles" table
CREATE TABLE "staff_roles" ("id" uuid NOT NULL, "created_at" timestamptz NOT NULL, "name" character varying NOT NULL, "department" character varying NOT NULL DEFAULT '', "permissions" jsonb NOT NULL, "is_template" boolean NOT NULL DEFAULT false, "created_by" uuid NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
-- create index "staffrole_name" to table: "staff_roles"
CREATE UNIQUE INDEX "staffrole_name" ON "staff_roles" ("name");
