package services

import (
	"context"
	"encoding/json"
	"fmt"

	"nantty/modules/users/src/types"
	"nantty/platform/identityports"
)

type StaffAuditEntry struct {
	Action       string
	SubjectType  string
	SubjectId    string
	SubjectLabel string
	Reason       string
	Before       any
	After        any
}

func RecordStaffAuditEvent(ctx context.Context, actor types.StaffActor, action, subjectType, subjectId, reason string, before, after any) error {
	return RecordStaffAuditEntry(ctx, actor, StaffAuditEntry{Action: action, SubjectType: subjectType, SubjectId: subjectId, Reason: reason, Before: before, After: after})
}

func RecordStaffAuditEntry(ctx context.Context, actor types.StaffActor, entry StaffAuditEntry) error {
	recorder, err := identityports.Default.AuditRecorder()
	if err != nil {
		return fmt.Errorf("staff audit recorder unavailable, refusing an unaudited staff action: %w", err)
	}
	beforeJson, _ := json.Marshal(entry.Before)
	afterJson, _ := json.Marshal(entry.After)
	return recorder.RecordAuditEvent(ctx, identityports.AuditEvent{
		ActorId: actor.Id, ActorName: actor.Name, ActorRole: actor.Role, Action: entry.Action, SubjectType: entry.SubjectType, SubjectId: entry.SubjectId, SubjectLabel: entry.SubjectLabel,
		Reason: entry.Reason, Before: beforeJson, After: afterJson, IpAddress: actor.IpAddress, UserAgent: actor.UserAgent, RequestId: actor.RequestId, StepUpVerified: actor.StepUp,
	})
}
