package useraudit

import (
	"context"
	"encoding/json"

	"nantty/platform/identityports"
)

type UserAuditEntry struct {
	AccountId    string
	AccountName  string
	Action       string
	SubjectType  string
	SubjectId    string
	SubjectLabel string
	Reason       string
	Before       any
	After        any
}

func RecordUserAuditEntry(ctx context.Context, entry UserAuditEntry) error {
	recorder, err := identityports.Default.AuditRecorder()
	if err != nil {
		return err
	}
	beforeJson, _ := json.Marshal(entry.Before)
	afterJson, _ := json.Marshal(entry.After)
	return recorder.RecordAuditEvent(ctx, identityports.AuditEvent{
		ActorId: entry.AccountId, ActorName: entry.AccountName, ActorRole: "user", Action: entry.Action, SubjectType: entry.SubjectType, SubjectId: entry.SubjectId,
		SubjectLabel: entry.SubjectLabel, Reason: entry.Reason, Before: beforeJson, After: afterJson,
	})
}
