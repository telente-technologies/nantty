package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adcreatormonetisationhold"
	platformevents "nantty/platform/events"
)

type CreatorMonetisationHolds struct {
	Client *ent.Client
	Now    func() time.Time
}

func (holds CreatorMonetisationHolds) PausedCreators(ctx context.Context, creatorIds []string) (map[string]bool, error) {
	paused := map[string]bool{}
	if len(creatorIds) == 0 {
		return paused, nil
	}
	rows, err := holds.Client.AdCreatorMonetisationHold.Query().Where(adcreatormonetisationhold.IDIn(creatorIds...), adcreatormonetisationhold.IsPaused(true)).All(ctx)
	for _, row := range rows {
		paused[row.ID] = true
	}
	return paused, err
}

func (holds CreatorMonetisationHolds) Apply(ctx context.Context, accountId string, canMonetise bool, occurredAt time.Time) error {
	existing, err := holds.Client.AdCreatorMonetisationHold.Get(ctx, accountId)
	if err != nil && !ent.IsNotFound(err) {
		return err
	}
	if existing != nil && occurredAt.Before(existing.HealthChangedAt) {
		return nil
	}
	return holds.Client.AdCreatorMonetisationHold.Create().SetID(accountId).SetIsPaused(!canMonetise).SetHealthChangedAt(occurredAt).SetUpdatedAt(holds.Now().UTC()).
		OnConflictColumns(adcreatormonetisationhold.FieldID).UpdateNewValues().Exec(ctx)
}

func (holds CreatorMonetisationHolds) HandleAccountHealthMessage(ctx context.Context, body []byte) error {
	var envelope platformevents.EventEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return fmt.Errorf("%w: not an envelope", platformevents.ErrPoisonMessage)
	}
	if envelope.Type != "accountHealth.changed" {
		return nil
	}
	var data struct {
		AccountId   string `json:"accountId"`
		CanMonetise bool   `json:"canMonetise"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil || data.AccountId == "" {
		return fmt.Errorf("%w: accountHealth.changed data is malformed", platformevents.ErrPoisonMessage)
	}
	return holds.Apply(ctx, data.AccountId, data.CanMonetise, envelope.OccurredAt)
}

func ExcludePausedCreatorsFromTotals(creatorMicros, platformMicros int64, byUser, impressionsByUser map[string]int64, paused map[string]bool) (int64, int64) {
	for creatorId, micros := range byUser {
		if !paused[creatorId] {
			continue
		}
		creatorMicros -= micros
		platformMicros += micros
		delete(byUser, creatorId)
		delete(impressionsByUser, creatorId)
	}
	return creatorMicros, platformMicros
}

func ExcludePausedCreatorsFromConsumption(weights []ConsumptionWeight, paused map[string]bool) []ConsumptionWeight {
	kept := make([]ConsumptionWeight, 0, len(weights))
	for _, weight := range weights {
		if !paused[weight.CreatorUserId] {
			kept = append(kept, weight)
		}
	}
	return kept
}
