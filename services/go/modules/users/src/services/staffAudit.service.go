package services

import (
	"context"
	"encoding/json"

	"zudomart/modules/users/src/types"
	"zudomart/platform/identityports"
)

func RecordStaffAuditEvent(ctx context.Context, actor types.StaffActor, action, subjectType, subjectId, reason string, before, after any) error {
	recorder, err := identityports.Default.AuditRecorder()
	if err != nil {
		return nil
	}
	beforeJson, _ := json.Marshal(before)
	afterJson, _ := json.Marshal(after)
	return recorder.RecordAuditEvent(ctx, identityports.AuditEvent{
		ActorId: actor.Id, ActorRole: actor.Role, Action: action, SubjectType: subjectType, SubjectId: subjectId, Reason: reason,
		Before: beforeJson, After: afterJson, IpAddress: actor.IpAddress, UserAgent: actor.UserAgent, RequestId: actor.RequestId,
	})
}
