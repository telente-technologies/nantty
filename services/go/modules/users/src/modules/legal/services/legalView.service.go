package services

import (
	"encoding/json"
	"time"

	"nantty/modules/users/src/generated/ent"
)

type VersionView struct {
	Id                          string  `json:"id"`
	DocumentKey                 string  `json:"documentKey"`
	VersionNumber               int     `json:"versionNumber"`
	Status                      string  `json:"status"`
	BodyMarkdown                string  `json:"bodyMarkdown"`
	ChangeSummary               string  `json:"changeSummary"`
	EffectiveAt                 string  `json:"effectiveAt"`
	IsMaterialChange            bool    `json:"isMaterialChange"`
	IsFlaggedForLegalReview     bool    `json:"isFlaggedForLegalReview"`
	CreatedByName               string  `json:"createdByName"`
	CreatedAt                   string  `json:"createdAt"`
	SubmittedByName             *string `json:"submittedByName"`
	SubmittedAt                 *string `json:"submittedAt"`
	PublishedByName             *string `json:"publishedByName"`
	PublishedAt                 *string `json:"publishedAt"`
	ReturnedReason              *string `json:"returnedReason"`
	RolledBackFromVersionNumber *int    `json:"rolledBackFromVersionNumber"`
	NoticeId                    *string `json:"noticeId"`
}

var statusLabels = map[string]string{"draft": "DRAFT", "in_review": "IN_REVIEW", "published": "PUBLISHED", "superseded": "SUPERSEDED"}

func timeText(moment *time.Time) *string {
	if moment == nil {
		return nil
	}
	formatted := moment.UTC().Format(time.RFC3339)
	return &formatted
}

func textOrNil(text string) *string {
	if text == "" {
		return nil
	}
	return &text
}

func ConvertVersionToView(row *ent.LegalVersion) VersionView {
	view := VersionView{
		Id: row.ID.String(), DocumentKey: row.DocumentKey, VersionNumber: row.VersionNumber, Status: statusLabels[string(row.Status)], BodyMarkdown: row.BodyMarkdown, ChangeSummary: row.ChangeSummary,
		EffectiveAt: row.EffectiveAt.UTC().Format(time.RFC3339), IsMaterialChange: row.IsMaterialChange, IsFlaggedForLegalReview: row.IsFlaggedForLegalReview,
		CreatedByName: row.CreatedByName, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339), SubmittedByName: textOrNil(row.SubmittedByName), SubmittedAt: timeText(row.SubmittedAt),
		PublishedByName: textOrNil(row.PublishedByName), PublishedAt: timeText(row.PublishedAt), ReturnedReason: textOrNil(row.ReturnedReason), RolledBackFromVersionNumber: row.RolledBackFromVersionNumber,
	}
	if row.NoticeID != nil {
		notice := row.NoticeID.String()
		view.NoticeId = &notice
	}
	return view
}

type NoticeDraftView struct {
	VersionId     string            `json:"versionId"`
	DocumentTitle string            `json:"documentTitle"`
	Subject       string            `json:"subject"`
	SummaryText   string            `json:"summaryText"`
	WhatChanged   []string          `json:"whatChanged"`
	EffectiveAt   string            `json:"effectiveAt"`
	ReacceptNote  string            `json:"reacceptNote"`
	DocumentUrl   string            `json:"documentUrl"`
	UpdatedByName string            `json:"updatedByName"`
	UpdatedAt     string            `json:"updatedAt"`
	TestSends     []json.RawMessage `json:"testSends"`
}

type NoticeProgressView struct {
	Id                    string  `json:"id"`
	DocumentKey           string  `json:"documentKey"`
	DocumentTitle         string  `json:"documentTitle"`
	VersionId             string  `json:"versionId"`
	VersionNumber         int     `json:"versionNumber"`
	Subject               string  `json:"subject"`
	Status                string  `json:"status"`
	RecipientCount        int     `json:"recipientCount"`
	SentCount             int     `json:"sentCount"`
	ExcludedHardBounces   int     `json:"excludedHardBounces"`
	ExcludedSuppressed    int     `json:"excludedSuppressed"`
	BatchSize             int     `json:"batchSize"`
	RatePerSecond         int     `json:"ratePerSecond"`
	BatchesTotal          int     `json:"batchesTotal"`
	BatchesDone           int     `json:"batchesDone"`
	QueuedAt              string  `json:"queuedAt"`
	QueuedByName          string  `json:"queuedByName"`
	EstimatedCompletionAt *string `json:"estimatedCompletionAt"`
	Provider              string  `json:"provider"`
}

func ConvertNoticeToView(row *ent.LegalNotice) NoticeProgressView {
	definition, _ := DefinitionOf(row.DocumentKey)
	batches := (row.RecipientCount + row.BatchSize - 1) / max(row.BatchSize, 1)
	view := NoticeProgressView{
		Id: row.ID.String(), DocumentKey: row.DocumentKey, DocumentTitle: definition.Title, VersionId: row.VersionID.String(), VersionNumber: row.VersionNumber, Subject: row.Subject,
		Status: map[string]string{"queued": "QUEUED", "sending": "SENDING", "completed": "COMPLETED"}[string(row.Status)], RecipientCount: row.RecipientCount, SentCount: row.SentCount,
		ExcludedHardBounces: row.ExcludedHardBounces, ExcludedSuppressed: row.ExcludedSuppressed, BatchSize: row.BatchSize, RatePerSecond: row.RatePerSecond, BatchesTotal: batches, BatchesDone: row.BatchesDone,
		QueuedAt: row.CreatedAt.UTC().Format(time.RFC3339), QueuedByName: row.QueuedByName, Provider: "AWS SES",
	}
	if remaining := row.RecipientCount - row.SentCount; row.Status != "completed" && row.RatePerSecond > 0 {
		estimate := row.UpdatedAt.Add(time.Duration(remaining/row.RatePerSecond) * time.Second)
		view.EstimatedCompletionAt = timeText(&estimate)
	}
	return view
}
