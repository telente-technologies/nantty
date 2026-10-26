package services

import (
	"context"

	"github.com/google/uuid"

	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adboost"
	"nantty/platform/httpserver"
)

func LoadOwnedBoostForUpdate(ctx context.Context, tx *ent.Tx, boostId, userId uuid.UUID) (*ent.AdBoost, error) {
	boost, err := tx.AdBoost.Query().Where(adboost.ID(boostId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, adserrors.NotFound
	}
	if err != nil {
		return nil, err
	}
	if boost.UserID != userId {
		return nil, httpserver.ErrForbidden
	}
	return boost, nil
}

func RequireBoostOwner(ctx context.Context, client *ent.Client, boostId, userId uuid.UUID) (*ent.AdBoost, error) {
	boost, err := client.AdBoost.Get(ctx, boostId)
	if ent.IsNotFound(err) {
		return nil, adserrors.NotFound
	}
	if err != nil {
		return nil, err
	}
	if boost.UserID != userId {
		return nil, httpserver.ErrForbidden
	}
	return boost, nil
}
