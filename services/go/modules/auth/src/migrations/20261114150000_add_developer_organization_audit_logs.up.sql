CREATE TABLE "developer_organization_audit_logs" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "actor_account_id" uuid NOT NULL,
  "actor_role" character varying(24) NOT NULL,
  "action" character varying(80) NOT NULL,
  "subject_type" character varying(48) NOT NULL,
  "subject_id" character varying(80) NOT NULL,
  "before_state" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "after_state" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "developer_organization_audit_logs_organization" FOREIGN KEY ("organization_id") REFERENCES "developer_organizations" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "developer_organization_audit_logs_actor" FOREIGN KEY ("actor_account_id") REFERENCES "accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
CREATE INDEX "developer_organization_audit_logs_org_created" ON "developer_organization_audit_logs" ("organization_id", "created_at" DESC, "id" DESC);
