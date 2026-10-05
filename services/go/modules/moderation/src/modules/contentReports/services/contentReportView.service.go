package services

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/contentreport"
	"zudomart/modules/moderation/src/generated/ent/contentreportentry"
	"zudomart/modules/moderation/src/generated/ent/strike"
	"zudomart/modules/moderation/src/integrations"
)

type TargetView struct {
	Type       string   `json:"type"`
	Id         string   `json:"id"`
	Title      *string  `json:"title"`
	Text       *string  `json:"text"`
	MediaUrls  []string `json:"mediaUrls"`
	SoundTitle *string  `json:"soundTitle"`
	Visibility string   `json:"visibility"`
	CreatedAt  string   `json:"createdAt"`
}

type ReasonCount struct {
	Reason string `json:"reason"`
	Count  int    `json:"count"`
}

type Summary struct {
	Id               string                   `json:"id"`
	Target           TargetView               `json:"target"`
	Author           integrations.UserSummary `json:"author"`
	PrimaryReason    string                   `json:"primaryReason"`
	ReasonCounts     []ReasonCount            `json:"reasonCounts"`
	ReportCount      int                      `json:"reportCount"`
	Priority         string                   `json:"priority"`
	Status           string                   `json:"status"`
	Source           string                   `json:"source"`
	ClassifierAction string                   `json:"classifierAction"`
	FirstReportedAt  string                   `json:"firstReportedAt"`
	LastReportedAt   string                   `json:"lastReportedAt"`
	SlaDueAt         string                   `json:"slaDueAt"`
}

type ReporterNote struct {
	ReporterUsername string `json:"reporterUsername"`
	Note             string `json:"note"`
	ReportedAt       string `json:"reportedAt"`
}

type PriorAction struct {
	Action     string `json:"action"`
	Reason     string `json:"reason"`
	OccurredAt string `json:"occurredAt"`
}

type Decision struct {
	Action           string `json:"action"`
	Reason           string `json:"reason"`
	DecidedByName    string `json:"decidedByName"`
	DecidedByStaffId string `json:"decidedByStaffId"`
	DecidedAt        string `json:"decidedAt"`
	SuspensionDays   *int   `json:"suspensionDays"`
}

type Detail struct {
	Summary
	ReporterNotes        []ReporterNote    `json:"reporterNotes"`
	ClassifierScores     []json.RawMessage `json:"classifierScores"`
	PriorActionsOnAuthor []PriorAction     `json:"priorActionsOnAuthor"`
	Decision             *Decision         `json:"decision"`
	History              []json.RawMessage `json:"history"`
}

func format(moment time.Time) string { return moment.UTC().Format(time.RFC3339) }

func BuildTarget(row *ent.ContentReport) TargetView { return buildTarget(row) }

func buildTarget(row *ent.ContentReport) TargetView {
	view := TargetView{Type: strings.ToUpper(string(row.TargetType)), Id: row.TargetID, MediaUrls: []string{}, Visibility: strings.ToUpper(string(row.Visibility)), CreatedAt: format(row.CreatedAt)}
	var preview integrations.TargetPreview
	if row.TargetPreview != nil && json.Unmarshal(row.TargetPreview, &preview) == nil {
		view.Title, view.Text, view.SoundTitle = preview.Title, preview.Text, preview.SoundTitle
		if preview.MediaUrls != nil {
			view.MediaUrls = preview.MediaUrls
		}
		if preview.CreatedAt != "" {
			view.CreatedAt = preview.CreatedAt
		}
	}
	return view
}

func BuildSummaries(ctx context.Context, c *container.Container, rows []*ent.ContentReport) ([]Summary, error) {
	authorIds := []uuid.UUID{}
	for _, row := range rows {
		if row.AuthorID != nil {
			authorIds = append(authorIds, *row.AuthorID)
		}
	}
	authors := map[string]integrations.UserSummary{}
	if len(authorIds) > 0 {
		found, err := c.Users.Summaries(ctx, authorIds)
		if err != nil {
			return nil, err
		}
		authors = found
	}
	summaries := make([]Summary, 0, len(rows))
	for _, row := range rows {
		counts := map[string]int{}
		_ = json.Unmarshal(row.ReasonCounts, &counts)
		reasonCounts := make([]ReasonCount, 0, len(counts))
		for reason, count := range counts {
			reasonCounts = append(reasonCounts, ReasonCount{Reason: strings.ToUpper(reason), Count: count})
		}
		sort.Slice(reasonCounts, func(left, right int) bool {
			return reasonCounts[left].Count > reasonCounts[right].Count || (reasonCounts[left].Count == reasonCounts[right].Count && reasonCounts[left].Reason < reasonCounts[right].Reason)
		})
		summary := Summary{
			Id: row.ID.String(), Target: buildTarget(row), PrimaryReason: strings.ToUpper(row.PrimaryReason), ReasonCounts: reasonCounts, ReportCount: row.ReportCount, Priority: strings.ToUpper(string(row.Priority)),
			Status: strings.ToUpper(string(row.Status)), Source: string(row.Source), ClassifierAction: string(row.ClassifierAction), FirstReportedAt: format(row.FirstReportedAt), LastReportedAt: format(row.LastReportedAt), SlaDueAt: format(row.SLADueAt),
		}
		if row.AuthorID != nil {
			summary.Author = authors[row.AuthorID.String()]
		}
		summaries = append(summaries, summary)
	}
	return summaries, nil
}

func BuildDetail(ctx context.Context, c *container.Container, row *ent.ContentReport) (Detail, error) {
	summaries, err := BuildSummaries(ctx, c, []*ent.ContentReport{row})
	if err != nil {
		return Detail{}, err
	}
	detail := Detail{Summary: summaries[0], ReporterNotes: []ReporterNote{}, ClassifierScores: []json.RawMessage{}, PriorActionsOnAuthor: []PriorAction{}}
	if row.ClassifierScores != nil {
		_ = json.Unmarshal(row.ClassifierScores, &detail.ClassifierScores)
	}
	if row.Decision != nil {
		var decision Decision
		if json.Unmarshal(row.Decision, &decision) == nil {
			detail.Decision = &decision
		}
	}
	entries, err := c.Client.ContentReportEntry.Query().Where(contentreportentry.ReportID(row.ID)).Order(ent.Asc(contentreportentry.FieldCreatedAt)).Limit(200).All(ctx)
	if err != nil {
		return Detail{}, err
	}
	reporterIds := []uuid.UUID{}
	for _, entry := range entries {
		if entry.ReporterID != nil {
			reporterIds = append(reporterIds, *entry.ReporterID)
		}
	}
	reporters := map[string]integrations.UserSummary{}
	if len(reporterIds) > 0 {
		if reporters, err = c.Users.Summaries(ctx, reporterIds); err != nil {
			return Detail{}, err
		}
	}
	for _, entry := range entries {
		if entry.Details == "" || entry.ReporterID == nil {
			continue
		}
		username, _ := reporters[entry.ReporterID.String()]["username"].(string)
		detail.ReporterNotes = append(detail.ReporterNotes, ReporterNote{ReporterUsername: username, Note: entry.Details, ReportedAt: format(entry.CreatedAt)})
	}
	if row.AuthorID != nil {
		prior, err := c.Client.Strike.Query().Where(strike.AccountID(*row.AuthorID), strike.RevokedAtIsNil()).Order(ent.Desc(strike.FieldCreatedAt)).Limit(20).All(ctx)
		if err != nil {
			return Detail{}, err
		}
		for _, item := range prior {
			detail.PriorActionsOnAuthor = append(detail.PriorActionsOnAuthor, PriorAction{Action: strings.ToUpper(string(item.Kind)), Reason: item.Reason, OccurredAt: format(item.CreatedAt)})
		}
	}
	history, err := c.Audit.History(ctx, "content_report", row.ID.String())
	if err != nil {
		return Detail{}, err
	}
	detail.History = history
	return detail, nil
}

func IsDecided(status contentreport.Status) bool {
	return status == contentreport.StatusResolved || status == contentreport.StatusDismissed
}
