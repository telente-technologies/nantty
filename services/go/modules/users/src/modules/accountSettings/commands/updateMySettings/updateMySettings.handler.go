package updatemysettings

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent/profile"
	updatecountrypreference "nantty/modules/users/src/modules/profiles/commands/updateCountryPreference"
	"nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	owner, err := uuid.Parse(command.AccountId)
	if err != nil {
		return usersErrors.ErrAccountUnavailable
	}
	if err := rejectUnsupportedChanges(command); err != nil {
		return err
	}
	row, summary, err := services.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return err
	}
	if command.Email != nil && (summary.Email == nil || *summary.Email != *command.Email) {
		return usersErrors.UnprocessableWithCode("EMAIL_CHANGE_UNAVAILABLE", "Email addresses cannot be changed here.")
	}
	if command.CountryCode != nil || command.Theme != nil {
		preference := updatecountrypreference.Command{AccountId: command.AccountId, CountryCode: command.CountryCode, Theme: command.Theme}
		if err := (updatecountrypreference.Handler{Container: handler.Container}).Execute(ctx, preference); err != nil {
			return err
		}
	}
	if command.Language == nil && command.PushNotificationsEnabled == nil {
		return nil
	}
	update := handler.Container.Client.Profile.UpdateOneID(row.ID)
	if command.Language != nil {
		update.SetLanguage(profile.Language(*command.Language))
	}
	if command.PushNotificationsEnabled != nil {
		update.SetPushNotificationsEnabled(*command.PushNotificationsEnabled)
	}
	return update.Exec(ctx)
}

func rejectUnsupportedChanges(command Command) error {
	if command.TwoFactorEnabled != nil && *command.TwoFactorEnabled {
		return usersErrors.UnprocessableWithCode("TWO_FACTOR_UNAVAILABLE", "Two-factor sign-in is not available yet.")
	}
	return nil
}
