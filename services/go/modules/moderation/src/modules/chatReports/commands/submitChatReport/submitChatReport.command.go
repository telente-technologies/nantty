package submitchatreport

import "encoding/json"

type Command struct {
	ReporterId        string
	IdempotencyKey    string
	TargetType        string
	TargetId          string
	ConversationId    string
	ReportedUserId    string
	Reason            string
	Details           string
	BlockReportedUser bool
	Evidence          json.RawMessage
	EvidenceSelection string
	EvidenceHash      string
}

type Result struct {
	Id       string `json:"id"`
	Status   string `json:"status"`
	Priority string `json:"priority"`
	Replayed bool   `json:"-"`
}
