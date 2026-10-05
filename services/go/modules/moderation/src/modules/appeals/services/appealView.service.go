package services

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/contentreport"
	"zudomart/modules/moderation/src/integrations"
	reportservices "zudomart/modules/moderation/src/modules/contentReports/services"
)

type Summary struct {
	Id               string                    `json:"id"`
	Appellant        integrations.UserSummary  `json:"appellant"`
	DecisionType     string                    `json:"decisionType"`
	OriginalDecision OriginalDecision          `json:"originalDecision"`
	Target           reportservices.TargetView `json:"target"`
	UserStatement    string                    `json:"userStatement"`
	EvidenceNotes    []string                  `json:"evidenceNotes"`
	Status           string                    `json:"status"`
	SubmittedAt      string                    `json:"submittedAt"`
	SlaDueAt         string                    `json:"slaDueAt"`
}

type Decision struct {
	Outcome          string `json:"outcome"`
	Reason           string `json:"reason"`
	DecidedByName    string `json:"decidedByName"`
	DecidedByStaffId string `json:"decidedByStaffId"`
	DecidedAt        string `json:"decidedAt"`
}

type Detail struct {
	Summary
	Decision *Decision         `json:"decision"`
	History  []json.RawMessage `json:"history"`
}

func format(moment time.Time) string { return moment.UTC().Format(time.RFC3339) }

func ReadOriginal(row *ent.Appeal) OriginalDecision {
	var original OriginalDecision
	_ = json.Unmarshal(row.OriginalDecision, &original)
	return original
}

func BuildSummaries(ctx context.Context, c *container.Container, rows []*ent.Appeal) ([]Summary, error) {
	appellantIds, reportIds := []uuid.UUID{}, []uuid.UUID{}
	for _, row := range rows {
		appellantIds = append(appellantIds, row.AppellantID)
		if row.ReportID != nil {
			reportIds = append(reportIds, *row.ReportID)
		}
	}
	appellants := map[string]integrations.UserSummary{}
	if len(appellantIds) > 0 {
		found, err := c.Users.Summaries(ctx, appellantIds)
		if err != nil {
			return nil, err
		}
		appellants = found
	}
	reports := map[uuid.UUID]*ent.ContentReport{}
	if len(reportIds) > 0 {
		found, err := c.Client.ContentReport.Query().Where(contentreport.IDIn(reportIds...)).All(ctx)
		if err != nil {
			return nil, err
		}
		for _, report := range found {
			reports[report.ID] = report
		}
	}
	summaries := make([]Summary, 0, len(rows))
	for _, row := range rows {
		summary := Summary{
			Id: row.ID.String(), DecisionType: strings.ToUpper(string(row.DecisionType)), OriginalDecision: ReadOriginal(row), UserStatement: row.Statement, EvidenceNotes: row.EvidenceNotes,
			Status: strings.ToUpper(string(row.Status)), SubmittedAt: format(row.SubmittedAt), SlaDueAt: format(row.SLADueAt),
		}
		if summary.EvidenceNotes == nil {
			summary.EvidenceNotes = []string{}
		}
		_ = json.Unmarshal(row.Target, &summary.Target)
		if summary.Target.MediaUrls == nil {
			summary.Target.MediaUrls = []string{}
		}
		if row.ReportID != nil && reports[*row.ReportID] != nil {
			summary.Target = reportservices.BuildTarget(reports[*row.ReportID])
		}
		summary.Appellant = appellants[row.AppellantID.String()]
		if summary.Appellant == nil {
			summary.Appellant = integrations.UserSummary{"id": row.AppellantID.String()}
		}
		summaries = append(summaries, summary)
	}
	return summaries, nil
}

func BuildDetail(ctx context.Context, c *container.Container, row *ent.Appeal) (Detail, error) {
	summaries, err := BuildSummaries(ctx, c, []*ent.Appeal{row})
	if err != nil {
		return Detail{}, err
	}
	detail := Detail{Summary: summaries[0]}
	if row.Decision != nil {
		var decision Decision
		if json.Unmarshal(row.Decision, &decision) == nil {
			detail.Decision = &decision
		}
	}
	if detail.History, err = c.Audit.History(ctx, "appeal", row.ID.String()); err != nil {
		return Detail{}, err
	}
	return detail, nil
}
