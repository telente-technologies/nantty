package services

import (
	"context"
	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/actingprofile"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/platform/identityports"
)

func LoadActiveAccountSummary(ctx context.Context, accountId uuid.UUID) (identityports.AccountSummary, error) {
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return identityports.AccountSummary{}, err
	}
	summary, found, err := directory.FindAccountSummary(ctx, accountId)
	if err != nil {
		return identityports.AccountSummary{}, err
	}
	if !found || (!summary.Active && summary.Status != "suspended") {
		return identityports.AccountSummary{}, usersErrors.ErrAccountUnavailable
	}
	return summary, nil
}

func EnsurePersonalProfile(ctx context.Context, application *container.Container, accountId uuid.UUID) (*ent.Profile, identityports.AccountSummary, error) {
	summary, err := LoadActiveAccountSummary(ctx, accountId)
	if err != nil {
		return nil, summary, err
	}
	existing, err := application.Client.Profile.Query().Where(profile.AccountID(accountId), profile.KindEQ(profile.KindPersonal)).Only(ctx)
	if err == nil {
		return existing, summary, nil
	}
	if !ent.IsNotFound(err) {
		return nil, summary, err
	}
	created, err := CreatePersonalProfileFromAccount(ctx, application, summary)
	return created, summary, err
}

func CreatePersonalProfileFromAccount(ctx context.Context, application *container.Container, summary identityports.AccountSummary) (*ent.Profile, error) {
	var created *ent.Profile
	err := application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		var err error
		created, err = tx.Profile.Create().
			SetAccountID(summary.ID).SetKind(profile.KindPersonal).SetHandle(summary.Username).SetDisplayName(TruncateRunes(summary.Name, 80)).
			Save(ctx)
		if err != nil {
			return err
		}
		return tx.UsernameChange.Create().SetAccountID(summary.ID).SetPreviousUsername(summary.Username).SetNewUsername(summary.Username).SetReason("signup").Exec(ctx)
	})
	if ent.IsConstraintError(err) {
		return application.Client.Profile.Query().Where(profile.AccountID(summary.ID), profile.KindEQ(profile.KindPersonal)).Only(ctx)
	}
	return created, err
}

func ActiveProfileIdFor(ctx context.Context, application *container.Container, accountId uuid.UUID, personal *ent.Profile) (string, error) {
	selection, err := application.Client.ActingProfile.Query().Where(actingprofile.AccountID(accountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return personal.ID.String(), nil
	}
	if err != nil {
		return "", err
	}
	return selection.ProfileID.String(), nil
}

func TruncateRunes(value string, maximum int) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) > maximum {
		return string(runes[:maximum])
	}
	return string(runes)
}

func ListActiveProfilesOfAccount(ctx context.Context, application *container.Container, accountId uuid.UUID) ([]*ent.Profile, error) {
	return application.Client.Profile.Query().
		Where(profile.AccountID(accountId), profile.StatusEQ(profile.StatusActive)).
		WithCategories().
		Order(ent.Asc(profile.FieldCreatedAt)).
		All(ctx)
}

func OrError(err error, fallback error) error {
	if err != nil {
		return err
	}
	return fallback
}
