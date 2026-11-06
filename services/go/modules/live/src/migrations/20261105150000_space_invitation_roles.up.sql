ALTER TABLE "space_participants" ADD COLUMN "stage_title" character varying NOT NULL DEFAULT '';

-- Existing invite-only entries predate accept/decline. Treat them as accepted
-- so this migration does not revoke access that older clients already granted.
UPDATE "spaces"
SET "metadata" = jsonb_set(
  COALESCE("metadata", '{}'::jsonb),
  '{acceptedSpaceInviteAccountIds}',
  COALESCE("metadata"->'invitedAccountIds', '[]'::jsonb),
  true
)
WHERE "metadata" ? 'invitedAccountIds'
  AND NOT ("metadata" ? 'acceptedSpaceInviteAccountIds');
