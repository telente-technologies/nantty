package services

import (
	"context"
	"errors"

	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/interfaces"
)

const PayoutVerifiedLevel = 1

func RequirePayoutVerified(ctx context.Context, reader interfaces.VerificationReader, userId string) error {
	status, err := reader.ReadVerificationLevel(ctx, userId)
	if errors.Is(err, adserrors.VerificationRequired) {
		return err
	}
	if err != nil {
		return adserrors.VerificationUnavailable
	}
	if status.Level < PayoutVerifiedLevel {
		return adserrors.VerificationRequired
	}
	return nil
}
