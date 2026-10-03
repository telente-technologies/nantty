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

type CaseSummary struct {
	Id          string                   `json:"id"`
	User        integrations.UserSummary `json:"user"`
	Source      string                   `json:"source"`
	Status      string                   `json:"status"`
	RiskScore   int                      `json:"riskScore"`
	TopSignals  []string                 `json:"topSignals"`
	ReportCount int                      `json:"reportCount"`
	CreatedAt   string                   `json:"createdAt"`
}

type CaseDecision struct {
	Outcome       string `json:"outcome"`
	Reason        string `json:"reason"`
	ReasonCode    string `json:"reasonCode,omitempty"`
	DecidedByName string `json:"decidedByName"`
	DecidedAt     string `json:"decidedAt"`
}

type CaseDetail struct {
	CaseSummary
	Signals      []json.RawMessage `json:"signals"`
	Evidence     []json.RawMessage `json:"evidence"`
	Reports      []json.RawMessage `json:"reports"`
	ModelVersion string            `json:"modelVersion"`
	Decision     *CaseDecision     `json:"decision"`
	Escalated    bool              `json:"escalated"`
	History      []json.RawMessage `json:"history"`
}

func BuildCaseSummaries(ctx context.Context, application *container.Container, rows []*ent.SuspensionCase) ([]CaseSummary, error) {
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifiers = append(identifiers, row.AccountID)
	}
	users := map[string]integrations.UserSummary{}
	if len(identifiers) > 0 {
		fetched, err := application.Users.Summaries(ctx, identifiers)
		if err != nil {
			return nil, err
		}
		users = fetched
	}
	views := make([]CaseSummary, 0, len(rows))
	for _, row := range rows {
		views = append(views, CaseSummary{
			Id: row.ID.String(), User: users[row.AccountID.String()], Source: strings.ToUpper(string(row.Source)), Status: strings.ToUpper(string(row.Status)), RiskScore: row.RiskScore,
			TopSignals: row.TopSignals, ReportCount: row.ReportCount, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339),
		})
	}
	return views, nil
}

func listOf(raw []byte) []json.RawMessage {
	items := []json.RawMessage{}
	_ = json.Unmarshal(raw, &items)
	return items
}

func BuildCaseDetail(ctx context.Context, application *container.Container, row *ent.SuspensionCase) (CaseDetail, error) {
	summaries, err := BuildCaseSummaries(ctx, application, []*ent.SuspensionCase{row})
	if err != nil {
		return CaseDetail{}, err
	}
	detail := CaseDetail{CaseSummary: summaries[0], Signals: listOf(row.Signals), Evidence: listOf(row.Evidence), Reports: listOf(row.Reports), ModelVersion: row.ModelVersion, Escalated: row.Escalated, History: []json.RawMessage{}}
	if len(row.Decision) > 0 {
		var decision CaseDecision
		if json.Unmarshal(row.Decision, &decision) == nil {
			detail.Decision = &decision
		}
	}
	if history, err := application.Audit.History(ctx, "suspension_case", row.ID.String()); err == nil {
		detail.History = history
	}
	return detail, nil
}
