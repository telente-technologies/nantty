package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type BlackBillingEventView struct {
	Id             string         `json:"id"`
	SubscriptionId string         `json:"subscriptionId,omitempty"`
	ApplicationId  string         `json:"applicationId,omitempty"`
	ProfileId      string         `json:"profileId"`
	OwnerUserId    string         `json:"ownerUserId"`
	EventKind      string         `json:"eventKind"`
	ActorKind      string         `json:"actorKind"`
	ActorId        string         `json:"actorId,omitempty"`
	Summary        string         `json:"summary"`
	Metadata       map[string]any `json:"metadata,omitempty"`
	CreatedAt      time.Time      `json:"createdAt"`
}

func (billing Billing) recordBlackBillingEvent(ctx context.Context, executor interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}, event BlackBillingEventView) {
	if executor == nil {
		return
	}
	if event.Id == "" {
		event.Id = uuid.Must(uuid.NewV7()).String()
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = billing.Container.Now().UTC()
	}
	meta, _ := json.Marshal(event.Metadata)
	if len(meta) == 0 {
		meta = []byte("{}")
	}
	_, _ = executor.ExecContext(ctx, `
		INSERT INTO black_billing_events (id, subscription_id, application_id, profile_id, owner_user_id, event_kind, actor_kind, actor_id, summary, metadata, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)`,
		event.Id, event.SubscriptionId, event.ApplicationId, event.ProfileId, event.OwnerUserId, event.EventKind, event.ActorKind, event.ActorId, event.Summary, string(meta), event.CreatedAt,
	)
}

func (billing Billing) listBlackBillingEvents(ctx context.Context, profileId string, limit int) ([]BlackBillingEventView, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	rows, err := billing.Container.Resources.Database.QueryContext(ctx, `
		SELECT id::text, subscription_id, application_id, profile_id, owner_user_id, event_kind, actor_kind, actor_id, summary, metadata::text, created_at
		FROM black_billing_events
		WHERE ($1 = '' OR profile_id = $1)
		ORDER BY created_at DESC LIMIT $2`, profileId, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := []BlackBillingEventView{}
	for rows.Next() {
		var item BlackBillingEventView
		var metaRaw string
		if err := rows.Scan(&item.Id, &item.SubscriptionId, &item.ApplicationId, &item.ProfileId, &item.OwnerUserId, &item.EventKind, &item.ActorKind, &item.ActorId, &item.Summary, &metaRaw, &item.CreatedAt); err != nil {
			return nil, err
		}
		if metaRaw != "" && metaRaw != "{}" {
			_ = json.Unmarshal([]byte(metaRaw), &item.Metadata)
		}
		events = append(events, item)
	}
	return events, rows.Err()
}
