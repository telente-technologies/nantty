package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/platform/identityports"
)

const CreatorAccountRole = "creator"

func GrantCreatorRoleToAccount(ctx context.Context, accountId uuid.UUID) error {
	enforcement, err := identityports.Default.AccountEnforcement()
	if err != nil {
		return err
	}
	return enforcement.SetAccountRole(ctx, accountId, CreatorAccountRole, true)
}
