package services

import (
	"testing"
	"time"

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

func TestSpaceInvitationAcceptanceControlsPrivateAccessAndRole(t *testing.T) {
	hostID, invitedID := uuid.New(), uuid.New()
	row := &ent.Space{HostID: hostID, Metadata: map[string]any{spaceAudienceMetadataKey: inviteOnlySpacePolicy}}
	now := time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
	metadata, invitation, created := AddSpaceInvitation(row, invitedID, "moderator", "Community co-host", now)
	if !created || invitation.ID == "" {
		t.Fatal("expected a persisted invitation")
	}
	if metadata[spaceAudienceMetadataKey] != inviteOnlySpacePolicy {
		t.Fatal("inviting must not alter the Space audience policy")
	}
	pending := &ent.Space{HostID: hostID, Metadata: metadata}
	if SpaceHasInvite(pending, invitedID) {
		t.Fatal("pending invite must not grant private Space access")
	}

	metadata, invitation, changed, err := RespondToSpaceInvitation(pending, uuid.MustParse(invitation.ID), invitedID, true, now.Add(time.Minute))
	if err != nil || !changed {
		t.Fatalf("accept invite: changed=%v err=%v", changed, err)
	}
	accepted := &ent.Space{HostID: hostID, Metadata: metadata}
	if !SpaceHasInvite(accepted, invitedID) {
		t.Fatal("accepted invite must grant private Space access")
	}
	acceptedInvitation, ok := AcceptedSpaceInvitation(accepted, invitedID)
	if !ok || acceptedInvitation.Role != "moderator" || acceptedInvitation.Title != "Community co-host" {
		t.Fatalf("accepted invite = %#v, %v", acceptedInvitation, ok)
	}

	_, _, changed, err = RespondToSpaceInvitation(accepted, uuid.MustParse(invitation.ID), invitedID, true, now.Add(2*time.Minute))
	if err != nil || changed {
		t.Fatalf("same accept retry should be idempotent: changed=%v err=%v", changed, err)
	}
}

func TestSpaceInvitationDeclineDoesNotGrantAccess(t *testing.T) {
	hostID, invitedID := uuid.New(), uuid.New()
	row := &ent.Space{HostID: hostID, Metadata: map[string]any{spaceAudienceMetadataKey: inviteOnlySpacePolicy}}
	now := time.Now().UTC()
	metadata, invitation, _ := AddSpaceInvitation(row, invitedID, "speaker", "Guest", now)
	pending := &ent.Space{HostID: hostID, Metadata: metadata}
	metadata, _, changed, err := RespondToSpaceInvitation(pending, uuid.MustParse(invitation.ID), invitedID, false, now.Add(time.Minute))
	if err != nil || !changed {
		t.Fatalf("decline invite: changed=%v err=%v", changed, err)
	}
	if SpaceHasInvite(&ent.Space{HostID: hostID, Metadata: metadata}, invitedID) {
		t.Fatal("declined invite must not grant private Space access")
	}
}
