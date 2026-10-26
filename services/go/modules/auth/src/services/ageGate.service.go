package services

import (
	"context"
	"log/slog"
	"time"

	authErrors "nantty/modules/auth/src/errors"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/agegaterefusal"
	"nantty/modules/auth/src/utils"
)

const (
	AgeGateRefusalLifetime   = 24 * time.Hour
	ageGateRefusalSweepEvery = time.Hour
)

func ageGateRefusalHashes(pepper []byte, email, deviceId string) map[agegaterefusal.Kind]string {
	hashes := map[agegaterefusal.Kind]string{}
	if email != "" {
		hashes[agegaterefusal.KindEmail] = HashBlockedIdentifier(pepper, "age-email", email)
	}
	if deviceId != "" {
		hashes[agegaterefusal.KindDevice] = HashBlockedIdentifier(pepper, "age-device", deviceId)
	}
	return hashes
}

func AssertNoRecentAgeGateRefusal(ctx context.Context, client *ent.Client, pepper []byte, email, deviceId string, now time.Time) error {
	for kind, hash := range ageGateRefusalHashes(pepper, email, deviceId) {
		refused, err := client.AgeGateRefusal.Query().Where(agegaterefusal.KindEQ(kind), agegaterefusal.ValueHash(hash), agegaterefusal.ExpiresAtGT(now)).Exist(ctx)
		if err != nil {
			return err
		}
		if refused {
			return authErrors.ErrBelowMinimumAge
		}
	}
	return nil
}

func RecordAgeGateRefusal(ctx context.Context, client *ent.Client, pepper []byte, email, deviceId string, now time.Time) error {
	for kind, hash := range ageGateRefusalHashes(pepper, email, deviceId) {
		if err := client.AgeGateRefusal.Create().SetKind(kind).SetValueHash(hash).SetExpiresAt(now.Add(AgeGateRefusalLifetime)).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func ParseBirthdayOrRefuseUnderMinimumAge(ctx context.Context, client *ent.Client, pepper []byte, raw, email, deviceId string, now time.Time) (time.Time, error) {
	birthday, err := utils.ParseBirthday(raw, now)
	if err != nil {
		return time.Time{}, err
	}
	if !utils.IsBelowMinimumAccountAge(birthday, now) {
		return birthday, nil
	}
	if err := RecordAgeGateRefusal(ctx, client, pepper, email, deviceId, now); err != nil {
		return time.Time{}, err
	}
	return time.Time{}, authErrors.ErrBelowMinimumAge
}

func PurgeExpiredAgeGateRefusals(ctx context.Context, client *ent.Client, now time.Time) (int, error) {
	return client.AgeGateRefusal.Delete().Where(agegaterefusal.ExpiresAtLTE(now)).Exec(ctx)
}

func RunAgeGateRefusalSweeperUntilContextDone(ctx context.Context, client *ent.Client, now func() time.Time, logger *slog.Logger) {
	ticker := time.NewTicker(ageGateRefusalSweepEvery)
	defer ticker.Stop()
	for {
		if _, err := PurgeExpiredAgeGateRefusals(ctx, client, now()); err != nil && ctx.Err() == nil {
			logger.WarnContext(ctx, "age gate refusal sweep failed", slog.Any("error", err))
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
