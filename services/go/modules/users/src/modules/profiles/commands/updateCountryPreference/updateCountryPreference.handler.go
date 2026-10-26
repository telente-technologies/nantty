package updatecountrypreference

import (
	"context"
	"regexp"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/modules/users/src/services"
)

var countryCodePattern = regexp.MustCompile(`^[A-Z]{2}$`)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	owner, err := uuid.Parse(command.AccountId)
	if err != nil {
		return usersErrors.ErrAccountUnavailable
	}
	code := ""
	if command.CountryCode != nil {
		code = strings.ToUpper(strings.TrimSpace(*command.CountryCode))
		if !countryCodePattern.MatchString(code) {
			return usersErrors.Unprocessable("Choose a valid country.")
		}
	}
	if command.Theme != nil && profile.ThemeValidator(profile.Theme(*command.Theme)) != nil {
		return usersErrors.Unprocessable("Choose light, dark or system.")
	}
	row, _, err := services.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return err
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.Profile.UpdateOneID(row.ID)
		if command.Theme != nil {
			update.SetTheme(profile.Theme(*command.Theme))
		}
		if code == "" {
			return update.Exec(ctx)
		}
		if err := update.SetCountryCode(code).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "profile.updated", owner.String(), handler.Container.Now(), events.ProfileUpdatedEventData{
			AccountId: owner.String(), ProfileId: row.ID.String(), ChangedFields: []string{"countryCode"},
		})
	})
}
