package getusernamepolicy

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/modules/usernames/models"
	usernameservices "zudomart/modules/users/src/modules/usernames/services"
	"zudomart/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (models.UsernamePolicyView, error) {
	owner, err := uuid.Parse(query.AccountId)
	if err != nil {
		return models.UsernamePolicyView{}, usersErrors.ErrAccountUnavailable
	}
	row, _, err := services.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return models.UsernamePolicyView{}, err
	}
	window, err := usernameservices.CalculateChangeWindow(ctx, handler.Container, owner)
	if err != nil {
		return models.UsernamePolicyView{}, err
	}
	settings := handler.Container.Settings
	cooldownDays := int(settings.UsernameChangeCooldown.Hours() / 24)
	quarantineDays := int(settings.UsernameQuarantine.Hours() / 24)
	view := models.UsernamePolicyView{
		Username: row.Handle, CanChangeNow: window.NextChangeAvailableAt == nil,
		ChangesRemainingThisYear: max(0, settings.UsernameMaximumChangesYear-window.ChangesUsedThisYear),
		CooldownDays:             cooldownDays, MaxChangesPerYear: settings.UsernameMaximumChangesYear, QuarantineDays: quarantineDays,
		Rules: []string{
			"Usernames are 3-30 characters: lowercase letters, numbers, dots and underscores, with at least one letter.",
			"A username cannot start or end with a dot or contain two dots in a row.",
			fmt.Sprintf("You can change your username once every %d days, up to %d times a year.", cooldownDays, settings.UsernameMaximumChangesYear),
			fmt.Sprintf("Your previous username is held for %d days before anyone else can claim it.", quarantineDays),
			"Names that impersonate people, brands or Zudomart are not allowed, and Zudomart may reclaim a username that breaks the Terms.",
		},
		History: make([]models.UsernameChangeView, 0, len(window.History)),
	}
	if window.NextChangeAvailableAt != nil {
		formatted := window.NextChangeAvailableAt.UTC().Format(time.RFC3339)
		view.NextChangeAvailableAt = &formatted
	}
	for _, change := range window.History {
		view.History = append(view.History, models.UsernameChangeView{From: change.PreviousUsername, To: change.NewUsername, ChangedAt: change.CreatedAt.UTC().Format(time.RFC3339), Reason: string(change.Reason)})
	}
	return view, nil
}
