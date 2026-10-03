package services

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/integrations"
)

type SpamScore struct {
	Score   int      `json:"score"`
	Signals []string `json:"signals"`
	Source  string   `json:"source"`
}

type Summary struct {
	Id                string                   `json:"id"`
	TargetType        string                   `json:"targetType"`
	Reason            string                   `json:"reason"`
	Priority          string                   `json:"priority"`
	Status            string                   `json:"status"`
	Reporter          integrations.UserSummary `json:"reporter"`
	ReportedUser      integrations.UserSummary `json:"reportedUser"`
	ConversationLabel string                   `json:"conversationLabel"`
	CreatedAt         string                   `json:"createdAt"`
	SlaDueAt          string                   `json:"slaDueAt"`
	EvidenceCount     int                      `json:"evidenceCount"`
	SpamScore         *SpamScore               `json:"spamScore"`
	IsLegalReview     bool                     `json:"isLegalReview"`
}

type Decision struct {
	ChatAction       string `json:"chatAction"`
	Reason           string `json:"reason"`
	DecidedByName    string `json:"decidedByName"`
	DecidedByStaffId string `json:"decidedByStaffId"`
	DecidedAt        string `json:"decidedAt"`
	SuspensionDays   *int   `json:"suspensionDays"`
}

type TranscriptMessage struct {
	EvidenceMessage
	IsReportedUser bool `json:"isReportedUser"`
}

type Detail struct {
	Summary
	Details                     string              `json:"details"`
	EvidenceSelection           *string             `json:"evidenceSelection"`
	EvidenceHash                *string             `json:"evidenceHash"`
	IsEvidenceHashVerified      bool                `json:"isEvidenceHashVerified"`
	EvidenceRetainedUntil       *string             `json:"evidenceRetainedUntil"`
	ReporterBlockedReportedUser bool                `json:"reporterBlockedReportedUser"`
	Transcript                  []TranscriptMessage `json:"transcript"`
	Decision                    *Decision           `json:"decision"`
	ReporterOutcome             *string             `json:"reporterOutcome"`
	History                     []json.RawMessage   `json:"history"`
}

var reporterOutcomeLabels = map[string]string{"action_taken": "TOOK_ACTION", "no_violation": "NO_VIOLATION"}

func BuildSummaries(ctx context.Context, application *container.Container, rows []*ent.ChatReport) ([]Summary, error) {
	identifiers := []uuid.UUID{}
	for _, row := range rows {
		identifiers = append(identifiers, row.ReporterID)
		if row.ReportedUserID != nil {
			identifiers = append(identifiers, *row.ReportedUserID)
		}
	}
	summaries := map[string]integrations.UserSummary{}
	if len(identifiers) > 0 {
		fetched, err := application.Users.Summaries(ctx, identifiers)
		if err != nil {
			return nil, err
		}
		summaries = fetched
	}
	views := make([]Summary, 0, len(rows))
	for _, row := range rows {
		views = append(views, summaryOf(row, summaries))
	}
	return views, nil
}

func summaryOf(row *ent.ChatReport, users map[string]integrations.UserSummary) Summary {
	count := 0
	if messages, err := ParseEvidence(row.Evidence); err == nil {
		count = len(messages)
	}
	view := Summary{
		Id: row.ID.String(), TargetType: strings.ToUpper(string(row.TargetType)), Reason: strings.ToUpper(row.Reason), Priority: strings.ToUpper(string(row.Priority)), Status: strings.ToUpper(string(row.Status)),
		Reporter: users[row.ReporterID.String()], ConversationLabel: conversationLabel(row), CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339), SlaDueAt: row.SLADueAt.UTC().Format(time.RFC3339),
		EvidenceCount: count, IsLegalReview: row.LegalHold || row.Status == "escalated_legal",
	}
	if row.ReportedUserID != nil {
		view.ReportedUser = users[row.ReportedUserID.String()]
	}
	if row.SpamScore != nil {
		view.SpamScore = &SpamScore{Score: *row.SpamScore, Signals: row.SpamSignals, Source: row.SpamSource}
	}
	return view
}

func conversationLabel(row *ent.ChatReport) string {
	switch row.TargetType {
	case "group":
		return "Group chat " + shortId(row.ConversationID)
	case "user":
		return "Direct report"
	}
	return "Conversation " + shortId(row.ConversationID)
}

func shortId(identifier string) string {
	if len(identifier) > 8 {
		return identifier[len(identifier)-8:]
	}
	return identifier
}

func BuildDetail(ctx context.Context, application *container.Container, row *ent.ChatReport) (Detail, error) {
	summaries, err := BuildSummaries(ctx, application, []*ent.ChatReport{row})
	if err != nil {
		return Detail{}, err
	}
	detail := Detail{Summary: summaries[0], Details: row.Details, IsEvidenceHashVerified: row.EvidenceHashVerified, ReporterBlockedReportedUser: row.BlockReportedUser, Transcript: []TranscriptMessage{}, History: []json.RawMessage{}}
	if row.EvidenceSelection != "" {
		detail.EvidenceSelection = &row.EvidenceSelection
	}
	if row.EvidenceHash != "" {
		detail.EvidenceHash = &row.EvidenceHash
	}
	if row.EvidencePurgedAt == nil {
		retained := row.EvidenceRetainedUntil.UTC().Format(time.RFC3339)
		detail.EvidenceRetainedUntil = &retained
	}
	messages, _ := ParseEvidence(row.Evidence)
	for _, message := range messages {
		detail.Transcript = append(detail.Transcript, TranscriptMessage{EvidenceMessage: message, IsReportedUser: row.ReportedUserID != nil && message.SenderId == row.ReportedUserID.String()})
	}
	if len(row.Decision) > 0 {
		var decision Decision
		if json.Unmarshal(row.Decision, &decision) == nil {
			detail.Decision = &decision
		}
	}
	if label, decided := reporterOutcomeLabels[string(row.ReporterOutcome)]; decided {
		detail.ReporterOutcome = &label
	}
	if history, err := application.Audit.History(ctx, "chat_report", row.ID.String()); err == nil {
		detail.History = history
	}
	return detail, nil
}
