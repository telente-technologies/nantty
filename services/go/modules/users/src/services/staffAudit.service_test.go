package services

import (
	"context"
	"testing"

	"nantty/modules/users/src/types"
	"nantty/platform/identityports"
)

type recordingAuditRecorder struct{ events []identityports.AuditEvent }

func (recorder *recordingAuditRecorder) RecordAuditEvent(_ context.Context, event identityports.AuditEvent) error {
	recorder.events = append(recorder.events, event)
	return nil
}

func TestStaffActionsAreRefusedWhenNoAuditRecorderIsRegistered(t *testing.T) {
	previous, _ := identityports.Default.AuditRecorder()
	t.Cleanup(func() { identityports.Default.RegisterAuditRecorder(previous) })
	identityports.Default.RegisterAuditRecorder(nil)
	actor := types.StaffActor{Id: "staff-1"}
	if err := RecordStaffAuditEvent(context.Background(), actor, "user.suspended", "user", "user-1", "spam", nil, nil); err == nil {
		t.Fatal("an unaudited staff action must fail closed")
	}
	recorder := &recordingAuditRecorder{}
	identityports.Default.RegisterAuditRecorder(recorder)
	if err := RecordStaffAuditEvent(context.Background(), actor, "user.suspended", "user", "user-1", "spam", nil, nil); err != nil || len(recorder.events) != 1 {
		t.Fatalf("err=%v events=%d, want the event recorded", err, len(recorder.events))
	}
}
