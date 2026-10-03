-- reverse: create index "staffrole_name" to table: "staff_roles"
DROP INDEX "staffrole_name";
-- reverse: create "staff_roles" table
DROP TABLE "staff_roles";
-- reverse: modify "staff_accounts" table
ALTER TABLE "staff_accounts" DROP COLUMN "approved_at", DROP COLUMN "approved_by", DROP COLUMN "role_ids";
-- reverse: modify "audit_events" table
ALTER TABLE "audit_events" DROP COLUMN "subject_label", DROP COLUMN "step_up_verified", DROP COLUMN "actor_departments", DROP COLUMN "actor_name";
