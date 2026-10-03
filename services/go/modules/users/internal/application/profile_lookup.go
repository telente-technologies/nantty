package application

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/users/internal/ent"
	"zudomart/modules/users/internal/ent/actingprofile"
	"zudomart/modules/users/internal/ent/profile"
	"zudomart/platform/identityports"
)

func (application *UsersApplication) loadActiveAccountSummary(ctx context.Context, accountId uuid.UUID) (identityports.AccountSummary, error) {
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return identityports.AccountSummary{}, err
	}
	summary, found, err := directory.FindAccountSummary(ctx, accountId)
	if err != nil {
		return identityports.AccountSummary{}, err
	}
	if !found || !summary.Active {
		return identityports.AccountSummary{}, errAccountUnavailable
	}
	return summary, nil
}

func (application *UsersApplication) ensurePersonalProfile(ctx context.Context, accountId uuid.UUID) (*ent.Profile, identityports.AccountSummary, error) {
	summary, err := application.loadActiveAccountSummary(ctx, accountId)
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
	created, err := application.createPersonalProfileFromAccount(ctx, summary)
	return created, summary, err
}

func (application *UsersApplication) createPersonalProfileFromAccount(ctx context.Context, summary identityports.AccountSummary) (*ent.Profile, error) {
	var created *ent.Profile
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		var err error
		created, err = tx.Profile.Create().
			SetAccountID(summary.ID).SetKind(profile.KindPersonal).SetHandle(summary.Username).SetDisplayName(truncateRunes(summary.Name, 80)).
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

func (application *UsersApplication) activeProfileIdFor(ctx context.Context, accountId uuid.UUID, personal *ent.Profile) (string, error) {
	selection, err := application.Client.ActingProfile.Query().Where(actingprofile.AccountID(accountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return personal.ID.String(), nil
	}
	if err != nil {
		return "", err
	}
	return selection.ProfileID.String(), nil
}

func (application *UsersApplication) hasActiveCreatorProfile(ctx context.Context, accountId uuid.UUID) (bool, error) {
	return application.Client.Profile.Query().Where(profile.AccountID(accountId), profile.KindEQ(profile.KindCreator), profile.StatusEQ(profile.StatusActive)).Exist(ctx)
}

func truncateRunes(value string, maximum int) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) > maximum {
		return string(runes[:maximum])
	}
	return string(runes)
}
