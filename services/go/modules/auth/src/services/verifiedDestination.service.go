package services

import (
	"context"
	"time"

	authErrors "zudomart/modules/auth/src/errors"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/onetimecode"
	"zudomart/modules/auth/src/utils"
)

func ConsumeVerifiedDestinationTokenInTransaction(ctx context.Context, tx *ent.Tx, purpose onetimecode.Purpose, verifiedToken string, now func() time.Time) (string, error) {
	record, err := tx.OneTimeCode.Query().
		Where(onetimecode.SecretHash(utils.HashOpaqueTokenForStorage(verifiedToken)), onetimecode.PurposeEQ(purpose), onetimecode.ConsumedAtIsNil(), onetimecode.ExpiresAtGT(now())).
		ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return "", authErrors.ErrDestinationNotProven
	}
	if err != nil {
		return "", err
	}
	if err := record.Update().SetConsumedAt(now()).Exec(ctx); err != nil {
		return "", err
	}
	return record.Destination, nil
}
