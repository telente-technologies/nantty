package services

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/integrations"
)

type CaseSummary struct {
	Id                   string                   `json:"id"`
	AccountId            string                   `json:"accountId"`
	Account              integrations.UserSummary `json:"account"`
	Trigger              string                   `json:"trigger"`
	Status               string                   `json:"status"`
	Severity             string                   `json:"severity"`
	ViolationCount       int                      `json:"violationCount"`
	FailedChallengeCount int                      `json:"failedChallengeCount"`
	PassedChallengeCount int                      `json:"passedChallengeCount"`
	AutoSuspended        bool                     `json:"autoSuspended"`
	OpenedAt             string                   `json:"openedAt"`
	LastActivityAt       string                   `json:"lastActivityAt"`
	DecidedAt            *string                  `json:"decidedAt"`
	Decision             json.RawMessage          `json:"decision"`
}

type TimelineEntry struct {
	Id       string          `json:"id"`
	Kind     string          `json:"kind"`
	At       string          `json:"at"`
	DeviceId string          `json:"deviceId"`
	IpPrefix string          `json:"ipPrefix"`
	Source   string          `json:"source"`
	Detail   json.RawMessage `json:"detail"`
}

func BuildCaseSummaries(ctx context.Context, application *container.Container, rows []*ent.SecurityCase) ([]CaseSummary, error) {
	ids := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.AccountID)
	}
	accounts := map[string]integrations.UserSummary{}
	if len(ids) > 0 {
		if resolved, err := application.Users.Summaries(ctx, ids); err == nil {
			accounts = resolved
		}
	}
	summaries := make([]CaseSummary, 0, len(rows))
	for _, row := range rows {
		summary := CaseSummary{
			Id: row.ID.String(), AccountId: row.AccountID.String(), Account: accounts[row.AccountID.String()], Trigger: string(row.Trigger), Status: string(row.Status),
			Severity: string(row.Severity), ViolationCount: row.ViolationCount, FailedChallengeCount: row.FailedChallengeCount, PassedChallengeCount: row.PassedChallengeCount,
			AutoSuspended: row.AutoSuspended, OpenedAt: formatTime(row.CreatedAt), LastActivityAt: formatTime(row.LastActivityAt), Decision: row.Decision,
		}
		if summary.Account == nil {
			summary.Account = integrations.UserSummary{"id": row.AccountID.String()}
		}
		if row.DecidedAt != nil {
			decided := formatTime(*row.DecidedAt)
			summary.DecidedAt = &decided
		}
		summaries = append(summaries, summary)
	}
	return summaries, nil
}

func BuildTimeline(rows []*ent.SecurityEvent) []TimelineEntry {
	entries := make([]TimelineEntry, 0, len(rows))
	for _, row := range rows {
		entries = append(entries, TimelineEntry{Id: row.ID.String(), Kind: string(row.Kind), At: formatTime(row.CreatedAt), DeviceId: row.DeviceID, IpPrefix: row.IPPrefix, Source: row.Source, Detail: row.Detail})
	}
	return entries
}

func formatTime(value time.Time) string { return value.UTC().Format(time.RFC3339) }
