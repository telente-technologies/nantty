package models

import (
	"encoding/json"
	"time"

	"zudomart/modules/admin/src/generated/ent"
)

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

type AuditFilter struct {
	Cursor      string
	Action      string
	ActorId     string
	SubjectType string
	From        *time.Time
	To          *time.Time
}

func ConvertAuditEventToView(row *ent.AuditEvent) AuditEventView {
	return AuditEventView{
		Id: row.ID.String(), ActorId: row.ActorID, ActorRole: row.ActorRole, Action: row.Action, SubjectType: row.SubjectType, SubjectId: row.SubjectID,
		Before: row.Before, After: row.After, Reason: row.Reason, IpAddress: row.IPAddress, UserAgent: row.UserAgent, RequestId: row.RequestID,
		CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339Nano),
	}
}
