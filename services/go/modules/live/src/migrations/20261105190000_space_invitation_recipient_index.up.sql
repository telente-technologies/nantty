-- Recipient reads inspect invitation objects inside the existing JSONB array.
-- This expression index lets the accountId + pending-status containment
-- predicate narrow candidates without scanning the spaces table.
CREATE INDEX "space_invitation_recipient_pending"
  ON "spaces" USING gin (("metadata"->'spaceInvitations') jsonb_path_ops);
