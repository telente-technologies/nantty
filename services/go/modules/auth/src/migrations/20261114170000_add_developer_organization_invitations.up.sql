CREATE TABLE "developer_organization_invitations" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "inviter_account_id" uuid NOT NULL,
  "invitee_account_id" uuid NOT NULL,
  "role" character varying(24) NOT NULL,
  "status" character varying(16) NOT NULL,
  "created_at" timestamptz NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "developer_organization_invitations_organization" FOREIGN KEY ("organization_id") REFERENCES "developer_organizations" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "developer_organization_invitations_inviter" FOREIGN KEY ("inviter_account_id") REFERENCES "accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "developer_organization_invitations_invitee" FOREIGN KEY ("invitee_account_id") REFERENCES "accounts" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "developer_organization_invitations_role" CHECK ("role" IN ('admin', 'developer', 'analyst', 'billing')),
  CONSTRAINT "developer_organization_invitations_status" CHECK ("status" IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  CONSTRAINT "developer_organization_invitations_expiry" CHECK ("expires_at" > "created_at")
);
CREATE UNIQUE INDEX "developer_organization_invitations_pending_target" ON "developer_organization_invitations" ("organization_id", "invitee_account_id") WHERE "status" = 'pending';
CREATE INDEX "developer_organization_invitations_recipient_pending" ON "developer_organization_invitations" ("invitee_account_id", "expires_at") WHERE "status" = 'pending';
CREATE INDEX "developer_organization_invitations_org_pending" ON "developer_organization_invitations" ("organization_id", "created_at" DESC) WHERE "status" = 'pending';
