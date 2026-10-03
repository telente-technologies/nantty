package updatecountrypreference

import (
	"context"
	"regexp"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/services"
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
	code := strings.ToUpper(strings.TrimSpace(command.CountryCode))
	if !countryCodePattern.MatchString(code) {
		return usersErrors.Unprocessable("Choose a valid country.")
	}
	row, _, err := services.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return err
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.Profile.UpdateOneID(row.ID).SetCountryCode(code).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "profile.updated", owner.String(), handler.Container.Now(), events.ProfileUpdatedEventData{
			AccountId: owner.String(), ProfileId: row.ID.String(), ChangedFields: []string{"countryCode"},
		})
	})
}
