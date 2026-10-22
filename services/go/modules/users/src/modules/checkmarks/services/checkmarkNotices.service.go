package services

import (
	"context"
	"time"

	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
)

const checkmarkAppealUrl = "https://zudomart.com/settings/verification"

type CheckmarkNotice struct {
	AccountId        string   `json:"accountId"`
	Checkmark        string   `json:"checkmark"`
	AccountName      string   `json:"accountName"`
	ApplicationId    string   `json:"applicationId,omitempty"`
	ReviewWithinDays int      `json:"reviewWithinDays,omitempty"`
	RenewsAt         string   `json:"renewsAt,omitempty"`
	Reasons          []string `json:"reasons,omitempty"`
	ReapplyFrom      string   `json:"reapplyFrom,omitempty"`
	Reason           string   `json:"reason,omitempty"`
	AppealUrl        string   `json:"appealUrl,omitempty"`
	Price            *Price   `json:"price,omitempty"`
	FailedAt         string   `json:"failedAt,omitempty"`
	GraceEndsAt      string   `json:"graceEndsAt,omitempty"`
}

type Price struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

func NoticeBase(profile *ent.Profile, color string) CheckmarkNotice {
	name := profile.DisplayName
	if name == "" {
		name = profile.Handle
	}
	return CheckmarkNotice{AccountId: profile.AccountID.String(), Checkmark: color, AccountName: name}
}

func EnqueueCheckmarkNoticeInTransaction(ctx context.Context, tx *ent.Tx, now time.Time, eventType string, notice CheckmarkNotice) error {
	return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, eventType, notice.AccountId, now, notice)
}

func OneYearFrom(now time.Time) string { return now.AddDate(1, 0, 0).UTC().Format(time.RFC3339) }

func AppealUrl() string { return checkmarkAppealUrl }
