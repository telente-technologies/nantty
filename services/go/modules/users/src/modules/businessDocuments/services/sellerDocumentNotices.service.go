package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
)

type SellerDocumentsNotice struct {
	AccountId        string   `json:"accountId"`
	StoreName        string   `json:"storeName"`
	Documents        []string `json:"documents"`
	ReviewWithinDays int      `json:"reviewWithinDays,omitempty"`
	Issues           []string `json:"issues,omitempty"`
}

func EnqueueSellerDocumentsNoticeInTransaction(ctx context.Context, tx *ent.Tx, now time.Time, eventType string, accountId uuid.UUID, notice SellerDocumentsNotice) error {
	if notice.StoreName == "" {
		if store, err := StoreProfileOf(ctx, tx.Client(), accountId); err == nil && store != nil {
			notice.StoreName = store.DisplayName
		}
	}
	if notice.StoreName == "" {
		notice.StoreName = "your store"
	}
	notice.AccountId = accountId.String()
	return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, eventType, accountId.String(), now, notice)
}
