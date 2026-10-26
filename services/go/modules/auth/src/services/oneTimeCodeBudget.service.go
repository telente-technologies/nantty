package services

import (
	"context"
	"time"

	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/onetimecode"
)

func WithinOneTimeCodeSendBudget(ctx context.Context, client *ent.Client, destination string, now time.Time, maximum int) (bool, error) {
	if maximum <= 0 {
		return true, nil
	}
	count, err := client.OneTimeCode.Query().
		Where(onetimecode.Destination(destination), onetimecode.CreatedAtGTE(now.Add(-time.Hour)), onetimecode.PurposeIn(onetimecode.PurposeSignup, onetimecode.PurposeReset, onetimecode.PurposeLogin, onetimecode.PurposeEmailVerification)).
		Count(ctx)
	if err != nil {
		return false, err
	}
	return count < maximum, nil
}
