ALTER TABLE "space_participants" DROP COLUMN IF EXISTS "stage_title";

-- Keep acceptedSpaceInviteAccountIds: removing it would make already-accepted
-- invitations ambiguous and could accidentally restore pending invite access.
