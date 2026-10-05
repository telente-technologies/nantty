package services

import (
	"context"
	"database/sql"
	"errors"
	"time"

	entsql "entgo.io/ent/dialect/sql"

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

func HealthChangeConflictOptions() []entsql.ConflictOption {
	newerOnly := entsql.ExprP(`"` + monetisationhold.Table + `"."` + monetisationhold.FieldHealthChangedAt + `" <= EXCLUDED."` + monetisationhold.FieldHealthChangedAt + `"`)
	return []entsql.ConflictOption{entsql.ConflictColumns(monetisationhold.FieldID), entsql.ResolveWithNewValues(), entsql.UpdateWhere(newerOnly)}
}

func (holds MonetisationHolds) ApplyAccountHealthChange(ctx context.Context, change AccountHealthChange) error {
	if change.AccountId == "" {
		return nil
	}
	return UpsertNewerHealthChange(ctx, holds.Container.Client(holds.Container.Resources.Database), change, holds.Container.Now().UTC())
}

func UpsertNewerHealthChange(ctx context.Context, client *ent.Client, change AccountHealthChange, now time.Time) error {
	restrictions := append([]string{}, change.Restrictions...)
	err := client.MonetisationHold.Create().SetID(change.AccountId).SetIsPaused(!change.CanMonetise).SetAccountStatus(change.Status).SetRestrictions(restrictions).SetReason(change.Reason).
		SetHealthChangedAt(change.OccurredAt).SetUpdatedAt(now).
		OnConflict(HealthChangeConflictOptions()...).Exec(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	return err
}

func (holds MonetisationHolds) IsMonetisationPaused(ctx context.Context, executor databases.ExecutorQuerier, userId string) (bool, error) {
	paused, err := holds.Container.Client(executor).MonetisationHold.Query().Where(monetisationhold.ID(userId), monetisationhold.IsPaused(true)).Exist(ctx)
	return paused, err
}
