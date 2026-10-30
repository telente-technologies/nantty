package services

import (
	"testing"

	"github.com/google/uuid"
	"nantty/modules/live/src/generated/ent"
)

func TestSpaceInvitePolicy(t *testing.T) {
	hostID, invitedID, strangerID := uuid.New(), uuid.New(), uuid.New()
	row := &ent.Space{
		HostID: hostID,
		Metadata: map[string]any{
			spaceAudienceMetadataKey: inviteOnlySpacePolicy,
			"invitedAccountIds":      []any{invitedID.String()},
		},
	}
	if !IsInviteOnlySpace(row) {
		t.Fatal("expected invite-only policy")
	}
	if !SpaceHasInvite(row, hostID) || !SpaceHasInvite(row, invitedID) {
		t.Fatal("host and invited listener must be authorized")
	}
	if SpaceHasInvite(row, strangerID) {
		t.Fatal("uninvited account must not be authorized")
	}

	updated := AddSpaceInvite(row, strangerID)
	if len(row.Metadata["invitedAccountIds"].([]any)) != 1 {
		t.Fatal("adding an invite must not mutate the existing row metadata")
	}
	updatedRow := &ent.Space{HostID: hostID, Metadata: updated}
	if !SpaceHasInvite(updatedRow, strangerID) {
		t.Fatal("new invite was not persisted in metadata")
	}
	updatedAgain := AddSpaceInvite(updatedRow, strangerID)
	if len(updatedAgain["invitedAccountIds"].([]string)) != 2 {
		t.Fatal("repeated invitation must not duplicate an account")
	}
}
