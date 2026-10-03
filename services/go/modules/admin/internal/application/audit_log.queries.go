package application

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/admin/internal/ent"
	"zudomart/modules/admin/internal/ent/auditevent"
	"zudomart/modules/admin/internal/ent/predicate"
)

const (
	auditPageSize       = 50
	auditExportRowLimit = 10000
)

type AuditFilter struct {
	Cursor      string
	Action      string
	ActorId     string
	SubjectType string
	From        *time.Time
	To          *time.Time
}

type AuditEventView struct {
	Id          string          `json:"id"`
	ActorId     string          `json:"actorId"`
	ActorRole   string          `json:"actorRole"`
	Action      string          `json:"action"`
	SubjectType string          `json:"subjectType"`
	SubjectId   string          `json:"subjectId"`
	Before      json.RawMessage `json:"before,omitempty"`
	After       json.RawMessage `json:"after,omitempty"`
	Reason      string          `json:"reason"`
	IpAddress   string          `json:"ipAddress"`
	UserAgent   string          `json:"userAgent"`
	RequestId   string          `json:"requestId"`
	CreatedAt   string          `json:"createdAt"`
}

type AuditPage struct {
	Data       []AuditEventView `json:"data"`
	NextCursor *string          `json:"nextCursor"`
}

func convertAuditEventToView(row *ent.AuditEvent) AuditEventView {
	return AuditEventView{
		Id: row.ID.String(), ActorId: row.ActorID, ActorRole: row.ActorRole, Action: row.Action, SubjectType: row.SubjectType, SubjectId: row.SubjectID,
		Before: row.Before, After: row.After, Reason: row.Reason, IpAddress: row.IPAddress, UserAgent: row.UserAgent, RequestId: row.RequestID,
		CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339Nano),
	}
}

func predicatesForAuditFilter(filter AuditFilter) ([]predicate.AuditEvent, error) {
	var predicates []predicate.AuditEvent
	if filter.Action != "" {
		predicates = append(predicates, auditevent.Action(filter.Action))
	}
	if filter.ActorId != "" {
		predicates = append(predicates, auditevent.ActorID(filter.ActorId))
	}
	if filter.SubjectType != "" {
		predicates = append(predicates, auditevent.SubjectType(filter.SubjectType))
	}
	if filter.From != nil {
		predicates = append(predicates, auditevent.CreatedAtGTE(*filter.From))
	}
	if filter.To != nil {
		predicates = append(predicates, auditevent.CreatedAtLT(*filter.To))
	}
	if filter.Cursor != "" {
		cursorId, err := uuid.Parse(filter.Cursor)
		if err != nil {
			return nil, unprocessable("The cursor is invalid.")
		}
		predicates = append(predicates, auditevent.IDLT(cursorId))
	}
	return predicates, nil
}

func (application *AdminApplication) SearchAuditLog(ctx context.Context, filter AuditFilter) (AuditPage, error) {
	predicates, err := predicatesForAuditFilter(filter)
	if err != nil {
		return AuditPage{}, err
	}
	rows, err := application.Client.AuditEvent.Query().Where(predicates...).Order(ent.Desc(auditevent.FieldID)).Limit(auditPageSize + 1).All(ctx)
	if err != nil {
		return AuditPage{}, err
	}
	page := AuditPage{Data: make([]AuditEventView, 0, len(rows))}
	if len(rows) > auditPageSize {
		rows = rows[:auditPageSize]
		next := rows[len(rows)-1].ID.String()
		page.NextCursor = &next
	}
	for _, row := range rows {
		page.Data = append(page.Data, convertAuditEventToView(row))
	}
	return page, nil
}

func (application *AdminApplication) ExportAuditLog(ctx context.Context, filter AuditFilter) ([]AuditEventView, error) {
	filter.Cursor = ""
	predicates, err := predicatesForAuditFilter(filter)
	if err != nil {
		return nil, err
	}
	rows, err := application.Client.AuditEvent.Query().Where(predicates...).Order(ent.Desc(auditevent.FieldID)).Limit(auditExportRowLimit).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]AuditEventView, 0, len(rows))
	for _, row := range rows {
		views = append(views, convertAuditEventToView(row))
	}
	return views, nil
}
