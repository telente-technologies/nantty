ALTER TABLE developer_applications
  ADD CONSTRAINT developer_applications_id_organization_unique UNIQUE (id, organization_id);

ALTER TABLE developer_organization_memberships
  ADD CONSTRAINT developer_organization_memberships_id_org_unique UNIQUE (id, organization_id);

CREATE TABLE developer_application_member_grants (
  organization_id uuid NOT NULL,
  application_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  capability varchar(48) NOT NULL CHECK (capability IN (
    'applications.read',
    'credentials.manage',
    'webhooks.manage',
    'request_logs.read',
    'usage.read'
  )),
  granted_by_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE NO ACTION,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (application_id, membership_id, capability),
  CONSTRAINT developer_application_member_grants_application_org
    FOREIGN KEY (application_id, organization_id)
    REFERENCES developer_applications(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT developer_application_member_grants_membership_org
    FOREIGN KEY (membership_id, organization_id)
    REFERENCES developer_organization_memberships(id, organization_id) ON DELETE CASCADE
);

CREATE INDEX developer_application_member_grants_membership
  ON developer_application_member_grants (organization_id, membership_id, application_id);
