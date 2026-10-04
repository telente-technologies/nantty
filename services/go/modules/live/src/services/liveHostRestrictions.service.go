package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/livehostrestriction"
	platformevents "zudomart/platform/events"
)

func (service *LiveService) EnsureHostCanGoLive(ctx context.Context, hostId string) error {
	restricted, err := service.Client.LiveHostRestriction.Query().Where(livehostrestriction.ID(hostId), livehostrestriction.CanGoLive(false)).Exist(ctx)
	if err != nil {
		return err
	}
	if restricted {
		return liveerrors.LiveRestricted
	}
	return nil
}

func (service *LiveService) ApplyHostAccountHealth(ctx context.Context, hostId string, canGoLive bool, occurredAt time.Time) error {
	existing, err := service.Client.LiveHostRestriction.Get(ctx, hostId)
	if err != nil && !ent.IsNotFound(err) {
		return err
	}
	if existing != nil && occurredAt.Before(existing.HealthChangedAt) {
		return nil
	}
	return service.Client.LiveHostRestriction.Create().SetID(hostId).SetCanGoLive(canGoLive).SetHealthChangedAt(occurredAt).SetUpdatedAt(service.Now().UTC()).
		OnConflictColumns(livehostrestriction.FieldID).UpdateNewValues().Exec(ctx)
}

func (service *LiveService) HandleAccountHealthChangedMessage(ctx context.Context, body []byte) error {
	var envelope platformevents.EventEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return fmt.Errorf("%w: live event is not an envelope", platformevents.ErrPoisonMessage)
	}
	var data struct {
		AccountId string `json:"accountId"`
		CanGoLive bool   `json:"canGoLive"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil || data.AccountId == "" {
		return fmt.Errorf("%w: accountHealth.changed data is malformed", platformevents.ErrPoisonMessage)
	}
	return service.ApplyHostAccountHealth(ctx, data.AccountId, data.CanGoLive, envelope.OccurredAt)
}
