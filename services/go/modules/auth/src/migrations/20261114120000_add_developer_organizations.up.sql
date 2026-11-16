CREATE TABLE "developer_organizations" (
  "id" uuid NOT NULL,
  "name" character varying(80) NOT NULL,
  "slug" character varying(48) NOT NULL,
  "created_by_account_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "developer_organizations_creator_accounts" FOREIGN KEY ("created_by_account_id") REFERENCES "accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "developer_organizations_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
CREATE UNIQUE INDEX "developer_organizations_slug" ON "developer_organizations" ("slug");

CREATE TABLE "developer_organization_memberships" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "role" character varying(24) NOT NULL,
  "created_at" timestamptz NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "developer_organization_memberships_organization" FOREIGN KEY ("organization_id") REFERENCES "developer_organizations" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "developer_organization_memberships_account" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "developer_organization_memberships_role" CHECK ("role" IN ('owner', 'admin', 'developer', 'analyst', 'billing'))
);
CREATE UNIQUE INDEX "developer_organization_memberships_org_account" ON "developer_organization_memberships" ("organization_id", "account_id");
CREATE INDEX "developer_organization_memberships_account" ON "developer_organization_memberships" ("account_id", "created_at");

CREATE TABLE "developer_organization_idempotency" (
  "account_id" uuid NOT NULL,
  "idempotency_key" character varying(128) NOT NULL,
  "organization_id" uuid NULL,
  "created_at" timestamptz NOT NULL,
  "expires_at" timestamptz NOT NULL,
  PRIMARY KEY ("account_id", "idempotency_key"),
  CONSTRAINT "developer_organization_idempotency_account" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "developer_organization_idempotency_organization" FOREIGN KEY ("organization_id") REFERENCES "developer_organizations" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
