package models

import (
	"encoding/json"
	"strings"
	"time"

	"zudomart/modules/admin/src/generated/ent"
)

type AuditActorView struct {
	Id          string   `json:"id"`
	Name        string   `json:"name"`
	Kind        string   `json:"kind"`
	Role        string   `json:"role"`
	Departments []string `json:"departments"`
}

type AuditTargetView struct {
	Type  string `json:"type"`
	Id    string `json:"id"`
	Label string `json:"label"`
}

type AuditEventView struct {
	Id             string          `json:"id"`
	OccurredAt     string          `json:"occurredAt"`
	Actor          AuditActorView  `json:"actor"`
	Area           string          `json:"area"`
	Target         AuditTargetView `json:"target"`
	StepUpVerified bool            `json:"stepUpVerified"`
	ActorId        string          `json:"actorId"`
	ActorRole      string          `json:"actorRole"`
	Action         string          `json:"action"`
	SubjectType    string          `json:"subjectType"`
	SubjectId      string          `json:"subjectId"`
	Before         json.RawMessage `json:"before,omitempty"`
	After          json.RawMessage `json:"after,omitempty"`
	Reason         string          `json:"reason"`
	IpAddress      string          `json:"ipAddress"`
	UserAgent      string          `json:"userAgent"`
	RequestId      string          `json:"requestId"`
	CreatedAt      string          `json:"createdAt"`
}

type AuditFilter struct {
	Cursor      string
	Action      string
	ActorId     string
	SubjectType string
	SubjectId   string
	Area        string
	Search      string
	RequestId   string
	StepUpOnly  bool
	From        *time.Time
	To          *time.Time
}

func AuditAreaOfAction(action string) string {
	prefix, _, _ := strings.Cut(action, ".")
	prefix, _, _ = strings.Cut(prefix, "_")
	return prefix
}

func ConvertAuditEventToView(row *ent.AuditEvent) AuditEventView {
	occurredAt := row.CreatedAt.UTC().Format(time.RFC3339Nano)
	kind := "ADMIN"
	if row.ActorID == "system" {
		kind = "SYSTEM"
	}
	departments := row.ActorDepartments
	if departments == nil {
		departments = []string{}
	}
	return AuditEventView{
		Id: row.ID.String(), OccurredAt: occurredAt, Area: AuditAreaOfAction(row.Action), StepUpVerified: row.StepUpVerified,
		Actor:   AuditActorView{Id: row.ActorID, Name: row.ActorName, Kind: kind, Role: strings.ToUpper(row.ActorRole), Departments: departments},
		Target:  AuditTargetView{Type: row.SubjectType, Id: row.SubjectID, Label: row.SubjectLabel},
		ActorId: row.ActorID, ActorRole: row.ActorRole, Action: row.Action, SubjectType: row.SubjectType, SubjectId: row.SubjectID,
		Before: row.Before, After: row.After, Reason: row.Reason, IpAddress: row.IPAddress, UserAgent: row.UserAgent, RequestId: row.RequestID,
		CreatedAt: occurredAt,
	}
}
