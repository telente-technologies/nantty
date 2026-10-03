package events

const (
	ChatReportReceivedType       = "chatReport.received"
	ChatReportDecidedType        = "chatReport.decided"
	ChatReportEscalatedType      = "chatReport.escalatedToLegal"
	ChatEvidencePurgedType       = "chatReport.evidencePurged"
	EvidenceRetentionChangedType = "chatReport.retentionChanged"
)

type ReceivedData struct {
	ReportId          string  `json:"reportId"`
	ReporterId        string  `json:"reporterId"`
	TargetType        string  `json:"targetType"`
	ReportedUserId    *string `json:"reportedUserId"`
	ConversationId    string  `json:"conversationId"`
	Reason            string  `json:"reason"`
	Priority          string  `json:"priority"`
	BlockReportedUser bool    `json:"blockReportedUser"`
}

type DecidedData struct {
	ReportId        string `json:"reportId"`
	ReporterId      string `json:"reporterId"`
	Action          string `json:"action"`
	ReporterOutcome string `json:"reporterOutcome"`
	NotifyReporter  bool   `json:"notifyReporter"`
	ReportedUserId  string `json:"reportedUserId,omitempty"`
	ConversationId  string `json:"conversationId,omitempty"`
}

type RetentionChangedData struct {
	RetentionDays int `json:"retentionDays"`
	LegalHoldDays int `json:"legalHoldDays"`
}
