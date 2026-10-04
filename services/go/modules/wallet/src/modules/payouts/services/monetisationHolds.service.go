package services

import (
	"context"
	"time"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/wallet/src/container"
	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/modules/wallet/src/generated/ent/monetisationhold"
)

type AccountHealthChange struct {
	AccountId    string    `json:"accountId"`
	Status       string    `json:"status"`
	Restrictions []string  `json:"restrictions"`
	CanMonetise  bool      `json:"canMonetise"`
	Reason       string    `json:"reason"`
	OccurredAt   time.Time `json:"-"`
}

type MonetisationHolds struct {
	Container *container.Container
}

func ShouldApplyHealthChange(existing *ent.MonetisationHold, occurredAt time.Time) bool {
	return existing == nil || !occurredAt.Before(existing.HealthChangedAt)
}

func (holds MonetisationHolds) ApplyAccountHealthChange(ctx context.Context, change AccountHealthChange) error {
	if change.AccountId == "" {
		return nil
	}
	client := holds.Container.Client(holds.Container.Resources.Database)
	existing, err := client.MonetisationHold.Get(ctx, change.AccountId)
	if err != nil && !ent.IsNotFound(err) {
		return err
	}
	if existing != nil && !ShouldApplyHealthChange(existing, change.OccurredAt) {
		return nil
	}
	restrictions := append([]string{}, change.Restrictions...)
	return client.MonetisationHold.Create().SetID(change.AccountId).SetIsPaused(!change.CanMonetise).SetAccountStatus(change.Status).SetRestrictions(restrictions).SetReason(change.Reason).
		SetHealthChangedAt(change.OccurredAt).SetUpdatedAt(holds.Container.Now().UTC()).
		OnConflictColumns(monetisationhold.FieldID).UpdateNewValues().Exec(ctx)
}

func (holds MonetisationHolds) IsMonetisationPaused(ctx context.Context, executor databases.ExecutorQuerier, userId string) (bool, error) {
	paused, err := holds.Container.Client(executor).MonetisationHold.Query().Where(monetisationhold.ID(userId), monetisationhold.IsPaused(true)).Exist(ctx)
	return paused, err
}
