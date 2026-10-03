package integrations

import (
	"context"
	"slices"

	"github.com/google/uuid"

	liveerrors "zudomart/modules/live/src/errors"
)

type RolesProductPinPolicy struct{}

func (RolesProductPinPolicy) CanPinProducts(_ context.Context, _ uuid.UUID, roles []string, _ []uuid.UUID) error {
	if slices.Contains(roles, "seller") {
		return nil
	}
	return liveerrors.Unprocessable("PRODUCTS_REQUIRE_STORE", "Only accounts with a store can pin products.")
}
