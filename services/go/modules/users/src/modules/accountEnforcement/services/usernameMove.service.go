package services

import (
	"context"
	"crypto/rand"
	"errors"
	"math/big"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/modules/users/src/generated/ent/usernamechange"
	"nantty/modules/users/src/generated/ent/usernamehold"
	userservices "nantty/modules/users/src/services"
	"nantty/platform/identityports"
)

const autoUsernameAlphabet = "abcdefghjkmnpqrstuvwxyz23456789"

func GenerateUnusedAutoUsername(ctx context.Context, application *container.Container) (string, error) {
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return "", err
	}
	for range 20 {
		suffix := make([]byte, 6)
		for index := range suffix {
			position, err := rand.Int(rand.Reader, big.NewInt(int64(len(autoUsernameAlphabet))))
			if err != nil {
				return "", err
			}
			suffix[index] = autoUsernameAlphabet[position.Int64()]
		}
		candidate := "user_" + string(suffix)
		if taken, err := directory.IsUsernameTaken(ctx, candidate, uuid.Nil); err != nil || taken {
			if err != nil {
				return "", err
			}
			continue
		}
		if held, err := application.Client.UsernameHold.Query().Where(usernamehold.Username(candidate)).Exist(ctx); err != nil || held {
			if err != nil {
				return "", err
			}
			continue
		}
		return candidate, nil
	}
	return "", usersErrors.Conflict("USERNAME_GENERATION_FAILED", "Could not generate a free username. Try again.")
}

func MoveUsername(ctx context.Context, application *container.Container, accountId uuid.UUID, previous, next string, reason usernamechange.Reason, holdPrevious bool) error {
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return err
	}
	if err := directory.RenameAccountUsername(ctx, accountId, next); err != nil {
		if errors.Is(err, identityports.ErrUsernameAlreadyTaken) {
			return usersErrors.Conflict("USERNAME_TAKEN", "That username is taken.")
		}
		return err
	}
	quarantine := userservices.LoadUsernameRules(ctx, application).Quarantine
	err = application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Now()
		if _, err := tx.Profile.Update().Where(profile.AccountID(accountId), profile.KindEQ(profile.KindPersonal)).SetHandle(next).Save(ctx); err != nil {
			return err
		}
		if err := tx.UsernameChange.Create().SetAccountID(accountId).SetPreviousUsername(previous).SetNewUsername(next).SetReason(reason).Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.UsernameHold.Delete().Where(usernamehold.UsernameIn(previous, next), usernamehold.KindEQ(usernamehold.KindQuarantine)).Exec(ctx); err != nil {
			return err
		}
		if !holdPrevious {
			return nil
		}
		return tx.UsernameHold.Create().SetUsername(previous).SetKind(usernamehold.KindQuarantine).SetHeldForAccountID(accountId).SetReason("released").SetExpiresAt(now.Add(quarantine)).Exec(ctx)
	})
	if err != nil {
		_ = directory.RenameAccountUsername(ctx, accountId, previous)
		if ent.IsConstraintError(err) {
			return usersErrors.Conflict("USERNAME_TAKEN", "That username is taken.")
		}
	}
	return err
}
