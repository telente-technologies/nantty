package services_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/services"
)

func TestSpaceInvitePolicy(t *testing.T) {
	hostID, invitedID, strangerID := uuid.New(), uuid.New(), uuid.New()
	row := &ent.Space{HostID: hostID}
	row.Metadata = services.AddSpaceInvite(row, invitedID)
	if !services.IsInviteOnlySpace(row) {
		t.Fatal("expected invite-only policy")
	}
	if !services.SpaceHasInvite(row, hostID) || !services.SpaceHasInvite(row, invitedID) {
		t.Fatal("host and invited listener must be authorized")
	}
	if services.SpaceHasInvite(row, strangerID) {
		t.Fatal("uninvited account must not be authorized")
	}

	updated := services.AddSpaceInvite(row, strangerID)
	if len(row.Metadata["invitedAccountIds"].([]string)) != 1 {
		t.Fatal("adding an invite must not mutate the existing row metadata")
	}
	updatedRow := &ent.Space{HostID: hostID, Metadata: updated}
	if !services.SpaceHasInvite(updatedRow, strangerID) {
		t.Fatal("new invite was not persisted in metadata")
	}
	updatedAgain := services.AddSpaceInvite(updatedRow, strangerID)
	if len(updatedAgain["invitedAccountIds"].([]string)) != 2 {
		t.Fatal("repeated invitation must not duplicate an account")
	}
}

func TestSpaceInvitationAcceptanceControlsPrivateAccessAndRole(t *testing.T) {
	hostID, invitedID := uuid.New(), uuid.New()
	row := &ent.Space{HostID: hostID}
	row.Metadata = services.AddSpaceInvite(row, uuid.New())
	now := time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
	metadata, invitation, created := services.AddSpaceInvitation(row, invitedID, "moderator", "Community co-host", now)
	if !created || invitation.ID == "" {
		t.Fatal("expected a persisted invitation")
	}
	if !services.IsInviteOnlySpace(&ent.Space{Metadata: metadata}) {
		t.Fatal("inviting must not alter the Space audience policy")
	}
	pending := &ent.Space{HostID: hostID, Metadata: metadata}
	if services.SpaceHasInvite(pending, invitedID) {
		t.Fatal("pending invite must not grant private Space access")
	}

	metadata, invitation, changed, err := services.RespondToSpaceInvitation(pending, uuid.MustParse(invitation.ID), invitedID, true, now.Add(time.Minute))
	if err != nil || !changed {
		t.Fatalf("accept invite: changed=%v err=%v", changed, err)
	}
	accepted := &ent.Space{HostID: hostID, Metadata: metadata}
	if !services.SpaceHasInvite(accepted, invitedID) {
		t.Fatal("accepted invite must grant private Space access")
	}
	acceptedInvitation, ok := services.AcceptedSpaceInvitation(accepted, invitedID)
	if !ok || acceptedInvitation.Role != "moderator" || acceptedInvitation.Title != "Community co-host" {
		t.Fatalf("accepted invite = %#v, %v", acceptedInvitation, ok)
	}

	_, _, changed, err = services.RespondToSpaceInvitation(accepted, uuid.MustParse(invitation.ID), invitedID, true, now.Add(2*time.Minute))
	if err != nil || changed {
		t.Fatalf("same accept retry should be idempotent: changed=%v err=%v", changed, err)
	}
}

func TestSpaceInvitationDeclineDoesNotGrantAccess(t *testing.T) {
	hostID, invitedID := uuid.New(), uuid.New()
	row := &ent.Space{HostID: hostID}
	row.Metadata = services.AddSpaceInvite(row, uuid.New())
	now := time.Now().UTC()
	metadata, invitation, _ := services.AddSpaceInvitation(row, invitedID, "speaker", "Guest", now)
	pending := &ent.Space{HostID: hostID, Metadata: metadata}
	metadata, _, changed, err := services.RespondToSpaceInvitation(pending, uuid.MustParse(invitation.ID), invitedID, false, now.Add(time.Minute))
	if err != nil || !changed {
		t.Fatalf("decline invite: changed=%v err=%v", changed, err)
	}
	if services.SpaceHasInvite(&ent.Space{HostID: hostID, Metadata: metadata}, invitedID) {
		t.Fatal("declined invite must not grant private Space access")
	}
}
