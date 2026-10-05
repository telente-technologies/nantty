package services

import (
	"context"
	"encoding/json"
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffaudit"
	"zudomart/platform/staffauth"
)

var errAuditUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "AUDIT_UNAVAILABLE", "The change could not be audited. Try again.")

type StaffActor struct {
	Staff     staffauth.Staff
	IpAddress string
	RequestId string
}

func StaffActorFrom(request *http.Request) StaffActor {
	staff, _ := staffauth.StaffFromContext(request.Context())
	return StaffActor{Staff: staff, IpAddress: ClientAddressOf(request), RequestId: request.Header.Get("X-Request-Id")}
}

type StaffChange struct {
	Action       string
	SubjectType  string
	SubjectId    string
	SubjectLabel string
	Reason       string
	Before       any
	After        any
}

func RecordStaffChange(ctx context.Context, deployed *container.Container, actor StaffActor, change StaffChange) error {
	if deployed.Audit == nil {
		return errAuditUnavailable
	}
	label := change.SubjectLabel
	if label == "" {
		label = change.SubjectId
	}
	err := deployed.Audit.Record(ctx, staffaudit.Record{
		ActorId: actor.Staff.Id, ActorName: actor.Staff.Name, ActorRole: actor.Staff.Role, Action: change.Action, SubjectType: change.SubjectType,
		SubjectId: change.SubjectId, SubjectLabel: label, Before: staffaudit.Snapshot(change.Before), After: staffaudit.Snapshot(change.After),
		Reason: change.Reason, IpAddress: actor.IpAddress, RequestId: actor.RequestId, StepUpVerified: actor.Staff.SteppedUp,
	})
	if err != nil {
		deployed.Logger.WarnContext(ctx, "staff audit failed", "action", change.Action, "error", err)
		return errAuditUnavailable
	}
	return nil
}

func StaffHistory(ctx context.Context, deployed *container.Container, subjectType, subjectId string) []json.RawMessage {
	if deployed.Audit == nil {
		return []json.RawMessage{}
	}
	history, err := deployed.Audit.History(ctx, subjectType, subjectId)
	if err != nil || history == nil {
		return []json.RawMessage{}
	}
	return history
}
