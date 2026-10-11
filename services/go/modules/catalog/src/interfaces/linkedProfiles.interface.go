package interfaces

import (
	"context"

	"github.com/google/uuid"
)

type LinkedClaim struct {
	Kind      string
	ProfileId uuid.UUID
	StoreId   *uuid.UUID
}

type LinkedProfileRegistry interface {
	Claim(ctx context.Context, accountId uuid.UUID, claim LinkedClaim) error
	Release(ctx context.Context, accountId uuid.UUID, claim LinkedClaim) error
	StatusOf(ctx context.Context, accountId uuid.UUID, kind string, profileId uuid.UUID) (string, error)
	TransferBrand(ctx context.Context, brandId, fromAccountId, toAccountId uuid.UUID) error
}
