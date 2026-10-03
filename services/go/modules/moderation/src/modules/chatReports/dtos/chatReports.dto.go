package dtos

import "encoding/json"

type SubmitRequest struct {
	TargetType        string          `json:"targetType"`
	TargetId          string          `json:"targetId"`
	ConversationId    string          `json:"conversationId"`
	ReportedUserId    *string         `json:"reportedUserId"`
	Reason            string          `json:"reason"`
	Details           string          `json:"details"`
	BlockReportedUser bool            `json:"blockReportedUser"`
	Evidence          json.RawMessage `json:"evidence"`
	EvidenceSelection *string         `json:"evidenceSelection"`
	EvidenceHash      *string         `json:"evidenceHash"`
}

type ActionRequest struct {
	Action       string `json:"action"`
	Reason       string `json:"reason"`
	DurationDays *int   `json:"durationDays"`
}

type RetentionRequest struct {
	RetentionDays int    `json:"retentionDays"`
	Reason        string `json:"reason"`
}
