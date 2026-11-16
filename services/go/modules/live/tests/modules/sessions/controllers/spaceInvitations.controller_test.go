package controllers_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"nantty/modules/live/src/modules/sessions/controllers"
)

func TestSpaceInvitationCursorIsBoundToAuthenticatedAccount(t *testing.T) {
	accountID, spaceID, invitationID := uuid.New(), uuid.New(), uuid.New()
	want := controllers.SpaceInvitationCursor{
		AccountID: accountID.String(), InvitedAt: time.Date(2026, 11, 5, 12, 30, 0, 123, time.UTC),
		SpaceID: spaceID.String(), InvitationID: invitationID.String(),
	}
	token, err := controllers.EncodeSpaceInvitationCursor(want)
	if err != nil {
		t.Fatal(err)
	}
	got, err := controllers.DecodeSpaceInvitationCursor(token, accountID)
	if err != nil {
		t.Fatal(err)
	}
	if got.AccountID != want.AccountID || !got.InvitedAt.Equal(want.InvitedAt) || got.SpaceID != want.SpaceID || got.InvitationID != want.InvitationID {
		t.Fatalf("decoded cursor = %#v, want %#v", got, want)
	}
	if _, err := controllers.DecodeSpaceInvitationCursor(token, uuid.New()); err == nil {
		t.Fatal("a cursor issued for another account must be rejected")
	}
	if _, err := controllers.DecodeSpaceInvitationCursor("not-a-cursor", accountID); err == nil {
		t.Fatal("malformed cursors must be rejected")
	}
	nonCanonical := want
	nonCanonical.InvitationID = "{" + invitationID.String() + "}"
	nonCanonicalToken, err := controllers.EncodeSpaceInvitationCursor(nonCanonical)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := controllers.DecodeSpaceInvitationCursor(nonCanonicalToken, accountID); err == nil {
		t.Fatal("non-canonical UUID cursor identifiers must be rejected before SQL casts")
	}
}
